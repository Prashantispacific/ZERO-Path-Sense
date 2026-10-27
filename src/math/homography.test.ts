import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGyroDerotation,
  derotatePoint,
  calculateAccelerationVariance,
  classifyBucket,
  classifyHazard,
  calculateMedianFlow,
  evaluateLookAheadPoints,
  evaluateBucketDebounce,
} from './homography';

test('Gyroscope derotation formula calculates correct pixel shifts', () => {
  // dt = 0.033s (approx 30fps), focalLengthPx = 300px
  // wx = 0.2 rad/s (pitch), wy = 0.1 rad/s (yaw/roll)
  const shift = calculateGyroDerotation(0.2, 0.1, 0.033, 300);
  // dx_rot = wy * dt * f = 0.1 * 0.033 * 300 = 0.99
  // dy_rot = wx * dt * f = 0.2 * 0.033 * 300 = 1.98
  assert.ok(Math.abs(shift.dx - 0.99) < 0.001);
  assert.ok(Math.abs(shift.dy - 1.98) < 0.001);

  const originalPt = { x: 100, y: 150 };
  const derotated = derotatePoint(originalPt, shift);
  assert.ok(Math.abs(derotated.x - 99.01) < 0.001);
  assert.ok(Math.abs(derotated.y - 148.02) < 0.001);
});

test('Acceleration variance correctly identifies stationary vs walking motion', () => {
  const stationaryAccel = [0.02, 0.01, 0.03, 0.02, 0.01, 0.02];
  const walkingAccel = [0.1, 2.4, -1.8, 3.2, -2.1, 0.5];

  const statVar = calculateAccelerationVariance(stationaryAccel);
  const walkVar = calculateAccelerationVariance(walkingAccel);

  assert.ok(statVar < 0.01, `Stationary variance was ${statVar}`);
  assert.ok(walkVar > 2.0, `Walking variance was ${walkVar}`);
});

test('Bucket classification partitions frame into Left, Center, Right thirds', () => {
  const W = 240; // portrait width
  assert.equal(classifyBucket(50, W), 'LEFT');
  assert.equal(classifyBucket(79.9, W), 'LEFT');
  assert.equal(classifyBucket(80, W), 'CENTER');
  assert.equal(classifyBucket(120, W), 'CENTER');
  assert.equal(classifyBucket(160, W), 'CENTER');
  assert.equal(classifyBucket(161, W), 'RIGHT');
  assert.equal(classifyBucket(230, W), 'RIGHT');
});

test('Hazard classification flags elevated obstacles vs depressions', () => {
  // residualY > 0 -> faster downward optical flow than flat ground -> ELEVATED
  assert.equal(classifyHazard(5.2, true), 'ELEVATED');
  // residualY < 0 -> slower downward flow -> DEPRESSION / pothole
  assert.equal(classifyHazard(-4.1, true), 'DEPRESSION');
  // Non-anomaly returns NONE
  assert.equal(classifyHazard(5.2, false), 'NONE');
});

test('Median flow computation handles odd and even arrays', () => {
  assert.equal(calculateMedianFlow([1.0, 3.0, 2.0]), 2.0);
  assert.equal(calculateMedianFlow([1.0, 2.0, 4.0, 5.0]), 3.0);
});

test('Evaluate Look-Ahead points marks points exceeding anomaly threshold', () => {
  const prev = [{ x: 50, y: 140 }, { x: 120, y: 150 }];
  const derotated = [{ x: 50, y: 150 }, { x: 120, y: 175 }]; // point 1 shifted by +10y, point 2 shifted by +25y
  const expected = [{ x: 50, y: 149 }, { x: 120, y: 152 }]; // point 1 expected +9y, point 2 expected +2y

  const evaluated = evaluateLookAheadPoints(prev, derotated, expected, 5.0, 240, 0.45);
  assert.equal(evaluated.length, 2);

  // Point 0: residual = (0, 1) -> norm = 1.0, ratio = 1.0 / 5.0 = 0.20 <= 0.45 (Normal inlier)
  assert.equal(evaluated[0].isAnomaly, false);
  assert.equal(evaluated[0].hazardType, 'NONE');

  // Point 1: residual = (0, 23) -> norm = 23, ratio = 23 / 5.0 = 4.6 > 0.45 (Anomaly!)
  assert.equal(evaluated[1].isAnomaly, true);
  assert.equal(evaluated[1].hazardType, 'ELEVATED');
  assert.equal(evaluated[1].bucket, 'CENTER');
});

test('Temporal debouncer requires 3 consecutive frames with >=35% anomaly to trigger', () => {
  const dummyPoints = (anomalyCount: number, total: number) => {
    const list = [];
    for (let i = 0; i < total; i++) {
      const isAnomaly = i < anomalyCount;
      list.push({
        x: 40, // Left bucket
        y: 150,
        residualX: 0,
        residualY: isAnomaly ? 6.0 : 0.2,
        normResidual: isAnomaly ? 6.0 : 0.2,
        ratio: isAnomaly ? 0.8 : 0.05,
        isAnomaly,
        hazardType: isAnomaly ? ('ELEVATED' as const) : ('NONE' as const),
        bucket: 'LEFT' as const,
      });
    }
    return list;
  };

  // Frame 1: 4 out of 10 anomalous (40% >= 35%)
  let counts = { LEFT: 0, CENTER: 0, RIGHT: 0 };
  let res = evaluateBucketDebounce(dummyPoints(4, 10), counts, 3, 35.0);
  assert.equal(res.buckets.LEFT.isTriggered, false);
  assert.equal(res.updatedConsecutiveCounts.LEFT, 1);

  // Frame 2: 4 out of 10 anomalous
  counts = res.updatedConsecutiveCounts;
  res = evaluateBucketDebounce(dummyPoints(4, 10), counts, 3, 35.0);
  assert.equal(res.buckets.LEFT.isTriggered, false);
  assert.equal(res.updatedConsecutiveCounts.LEFT, 2);

  // Frame 3: 4 out of 10 anomalous -> Now consecutive count = 3 >= 3 -> TRIGGERED!
  counts = res.updatedConsecutiveCounts;
  res = evaluateBucketDebounce(dummyPoints(4, 10), counts, 3, 35.0);
  assert.equal(res.buckets.LEFT.isTriggered, true);
  assert.equal(res.updatedConsecutiveCounts.LEFT, 3);

  // Frame 4: normal frame (only 1 out of 10 anomalous = 10% < 35%) -> debouncer resets to 0!
  counts = res.updatedConsecutiveCounts;
  res = evaluateBucketDebounce(dummyPoints(1, 10), counts, 3, 35.0);
  assert.equal(res.buckets.LEFT.isTriggered, false);
  assert.equal(res.updatedConsecutiveCounts.LEFT, 0);
});
