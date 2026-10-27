/**
 * PathSense Pure Mathematical & Logic Engine
 * Mirrors the Kotlin Android HomographyObstacleEngine & ImuTracker pipelines
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector2D {
  dx: number;
  dy: number;
}

export type HazardType = 'NONE' | 'ELEVATED' | 'DEPRESSION';
export type BucketId = 'LEFT' | 'CENTER' | 'RIGHT';
export type EngineState = 'WALKING' | 'STATIONARY' | 'LOW_TEXTURE_PAUSED' | 'UNSTABLE_PLANE' | 'HAZARD_DETECTED' | 'HAZARD_ALERT';

export interface AnomalyPoint {
  x: number;
  y: number;
  residualX: number;
  residualY: number;
  normResidual: number;
  ratio: number;
  isAnomaly: boolean;
  hazardType: HazardType;
  bucket: BucketId;
}

export interface BucketStats {
  bucket: BucketId;
  totalPoints: number;
  anomalyPoints: number;
  anomalyPercentage: number;
  dominantHazard: HazardType;
  consecutiveTriggerFrames: number;
  isTriggered: boolean;
}

/**
 * Derotates optical flow vector by subtracting rotational displacement induced by phone pitch/roll
 * dx_rot = wy * dt * focalLengthPx
 * dy_rot = wx * dt * focalLengthPx
 */
export function calculateGyroDerotation(
  wxRadPerSec: number,
  wyRadPerSec: number,
  dtSec: number,
  focalLengthPx: number
): Vector2D {
  return {
    dx: wyRadPerSec * dtSec * focalLengthPx,
    dy: wxRadPerSec * dtSec * focalLengthPx,
  };
}

export function derotatePoint(currPt: Point2D, rotShift: Vector2D): Point2D {
  return {
    x: currPt.x - rotShift.dx,
    y: currPt.y - rotShift.dy,
  };
}

/**
 * Calculates rolling variance of vertical/forward acceleration over a window
 */
export function calculateAccelerationVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const sumSq = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
  return sumSq / (values.length - 1);
}

/**
 * Classifies an x coordinate in portrait frame [0, width] into 3 horizontal buckets
 */
export function classifyBucket(x: number, frameWidth: number): BucketId {
  const third = frameWidth / 3.0;
  if (x < third) return 'LEFT';
  if (x <= 2 * third) return 'CENTER';
  return 'RIGHT';
}

/**
 * Classifies hazard type based on residual vector y component
 * Faster downward flow (residualY > 0) -> elevated obstacle (approaches camera faster)
 * Slower downward flow (residualY < 0) -> depression / drop / pothole
 */
export function classifyHazard(residualY: number, isAnomaly: boolean): HazardType {
  if (!isAnomaly) return 'NONE';
  return residualY > 0 ? 'ELEVATED' : 'DEPRESSION';
}

/**
 * Median flow magnitude calculation
 */
export function calculateMedianFlow(flowMagnitudes: number[]): number {
  if (flowMagnitudes.length === 0) return 0;
  const sorted = [...flowMagnitudes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Evaluates points in Look-Ahead zone against flat-ground homography projection
 */
export function evaluateLookAheadPoints(
  lookAheadPrev: Point2D[],
  lookAheadCurrDerotated: Point2D[],
  lookAheadExpected: Point2D[],
  medianFlowMag: number,
  frameWidth: number,
  anomalyThreshold: number = 0.45
): AnomalyPoint[] {
  const count = Math.min(lookAheadPrev.length, lookAheadCurrDerotated.length, lookAheadExpected.length);
  const results: AnomalyPoint[] = [];

  const effectiveMedian = Math.max(medianFlowMag, 1.0);

  for (let i = 0; i < count; i++) {
    const curr = lookAheadCurrDerotated[i];
    const exp = lookAheadExpected[i];
    const residualX = curr.x - exp.x;
    const residualY = curr.y - exp.y;
    const normResidual = Math.sqrt(residualX * residualX + residualY * residualY);
    const ratio = normResidual / effectiveMedian;
    const isAnomaly = ratio > anomalyThreshold;
    const hazardType = classifyHazard(residualY, isAnomaly);
    const bucket = classifyBucket(curr.x, frameWidth);

    results.push({
      x: curr.x,
      y: curr.y,
      residualX,
      residualY,
      normResidual,
      ratio,
      isAnomaly,
      hazardType,
      bucket,
    });
  }

  return results;
}

/**
 * Evaluates temporal debounce for each bucket
 * Alert triggers if >= 35% of points in bucket are anomalous for required consecutive frames (e.g. 3)
 */
export function evaluateBucketDebounce(
  points: AnomalyPoint[],
  previousConsecutiveCounts: Record<BucketId, number>,
  debounceThreshold: number = 3,
  triggerPercentage: number = 35.0
): {
  buckets: Record<BucketId, BucketStats>;
  updatedConsecutiveCounts: Record<BucketId, number>;
} {
  const buckets: Record<BucketId, BucketStats> = {
    LEFT: { bucket: 'LEFT', totalPoints: 0, anomalyPoints: 0, anomalyPercentage: 0, dominantHazard: 'NONE', consecutiveTriggerFrames: 0, isTriggered: false },
    CENTER: { bucket: 'CENTER', totalPoints: 0, anomalyPoints: 0, anomalyPercentage: 0, dominantHazard: 'NONE', consecutiveTriggerFrames: 0, isTriggered: false },
    RIGHT: { bucket: 'RIGHT', totalPoints: 0, anomalyPoints: 0, anomalyPercentage: 0, dominantHazard: 'NONE', consecutiveTriggerFrames: 0, isTriggered: false },
  };

  const elevatedCounts: Record<BucketId, number> = { LEFT: 0, CENTER: 0, RIGHT: 0 };
  const depressionCounts: Record<BucketId, number> = { LEFT: 0, CENTER: 0, RIGHT: 0 };

  for (const pt of points) {
    const b = buckets[pt.bucket];
    b.totalPoints++;
    if (pt.isAnomaly) {
      b.anomalyPoints++;
      if (pt.hazardType === 'ELEVATED') elevatedCounts[pt.bucket]++;
      if (pt.hazardType === 'DEPRESSION') depressionCounts[pt.bucket]++;
    }
  }

  const updatedConsecutiveCounts: Record<BucketId, number> = { ...previousConsecutiveCounts };

  (['LEFT', 'CENTER', 'RIGHT'] as BucketId[]).forEach((bucketKey) => {
    const b = buckets[bucketKey];
    b.anomalyPercentage = b.totalPoints > 0 ? (b.anomalyPoints / b.totalPoints) * 100 : 0;

    if (b.anomalyPoints > 0) {
      b.dominantHazard = elevatedCounts[bucketKey] >= depressionCounts[bucketKey] ? 'ELEVATED' : 'DEPRESSION';
    } else {
      b.dominantHazard = 'NONE';
    }

    if (b.totalPoints >= 3 && b.anomalyPercentage >= triggerPercentage) {
      updatedConsecutiveCounts[bucketKey] = (previousConsecutiveCounts[bucketKey] || 0) + 1;
    } else {
      updatedConsecutiveCounts[bucketKey] = 0;
    }

    b.consecutiveTriggerFrames = updatedConsecutiveCounts[bucketKey];
    b.isTriggered = b.consecutiveTriggerFrames >= debounceThreshold;
  });

  return { buckets, updatedConsecutiveCounts };
}
