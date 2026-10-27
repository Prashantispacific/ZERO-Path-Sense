import React, { useEffect, useRef, useState } from 'react';
import {
  Point2D,
  classifyBucket,
  classifyHazard,
  evaluateLookAheadPoints,
  evaluateBucketDebounce,
  BucketId,
  EngineState,
  calculateGyroDerotation,
  derotatePoint,
} from '../math/homography';
import { playDirectionalHaptic } from '../utils/audioHaptics';
import { Play, Pause, Camera, RefreshCw, Volume2, ShieldAlert, Sliders } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  description: string;
  hazardLocation: BucketId | 'NONE';
  hazardType: 'ELEVATED' | 'DEPRESSION' | 'NONE';
  isStationary?: boolean;
  isLowTexture?: boolean;
  handJitter?: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    id: 'clear',
    name: 'Clear Concrete Footpath',
    description: 'Flat pavement, uniform optical flow, high homography inlier ratio (>90%).',
    hazardLocation: 'NONE',
    hazardType: 'NONE',
  },
  {
    id: 'left_brick',
    name: 'Elevated Brick (Left)',
    description: 'Raised paver block on left side. Residual vector points downward (approaching faster).',
    hazardLocation: 'LEFT',
    hazardType: 'ELEVATED',
  },
  {
    id: 'center_pothole',
    name: 'Deep Pothole (Center)',
    description: 'Depression / open drain in middle path. Residual vector flows slower than expected ground.',
    hazardLocation: 'CENTER',
    hazardType: 'DEPRESSION',
  },
  {
    id: 'right_curb',
    name: 'Raised Broken Curb (Right)',
    description: 'Elevated concrete edge on right sidewalk side.',
    hazardLocation: 'RIGHT',
    hazardType: 'ELEVATED',
  },
  {
    id: 'stationary',
    name: 'Standing Still (IMU Guard)',
    description: 'Linear acceleration variance falls below threshold (<0.08). Vision pipeline safely pauses.',
    hazardLocation: 'NONE',
    hazardType: 'NONE',
    isStationary: true,
  },
  {
    id: 'low_texture',
    name: 'Low Texture / Darkness Guard',
    description: 'Feature corners < 30. Prevents false positive triggers in untextured terrain or night.',
    hazardLocation: 'NONE',
    hazardType: 'NONE',
    isLowTexture: true,
  },
  {
    id: 'jitter',
    name: 'Walking Hand Pitch & Roll Jitter',
    description: 'Gyroscope angular velocity integration derotates flow vectors before homography RANSAC.',
    hazardLocation: 'LEFT',
    hazardType: 'ELEVATED',
    handJitter: true,
  },
];

export const DebugSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [currentScenario, setCurrentScenario] = useState<Scenario>(SCENARIOS[1]); // Default to left brick for instant visual feedback
  const [anomalyThreshold, setAnomalyThreshold] = useState<number>(0.45);
  const [debounceFrames, setDebounceFrames] = useState<number>(3);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState<boolean>(true);
  const [enableDerotation, setEnableDerotation] = useState<boolean>(true);

  // Telemetry metrics
  const [telemetry, setTelemetry] = useState({
    fps: 30,
    latencyMs: 6,
    tracks: 98,
    inliersPercent: 88,
    state: 'WALKING' as EngineState,
    medianFlow: 4.8,
  });

  const [activeAlerts, setActiveAlerts] = useState<Record<BucketId, { triggered: boolean; type: string; frames: number }>>({
    LEFT: { triggered: false, type: 'NONE', frames: 0 },
    CENTER: { triggered: false, type: 'NONE', frames: 0 },
    RIGHT: { triggered: false, type: 'NONE', frames: 0 },
  });

  const frameCountRef = useRef(0);
  const consecutiveCountsRef = useRef<Record<BucketId, number>>({ LEFT: 0, CENTER: 0, RIGHT: 0 });
  const lastAlertTimeRef = useRef<number>(0);

  // Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      if (!isRunning) return;

      const dt = (time - lastTime) / 1000;
      if (dt < 0.030) return; // Cap at ~30 FPS
      lastTime = time;

      frameCountRef.current++;
      const frameNum = frameCountRef.current;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;

      // Clear Canvas (Dark Slate simulation background with realistic perspective sidewalk)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      // Draw simulated sidewalk perspective
      ctx.save();
      const sidewalkTopW = W * 0.45;
      const sidewalkBottomW = W * 0.95;
      const sidewalkTopX = (W - sidewalkTopW) / 2;
      const sidewalkBottomX = (W - sidewalkBottomW) / 2;

      // Pavement surface
      const sidewalkGrad = ctx.createLinearGradient(0, 0, 0, H);
      sidewalkGrad.addColorStop(0, '#1e293b');
      sidewalkGrad.addColorStop(1, '#334155');
      ctx.fillStyle = sidewalkGrad;
      ctx.beginPath();
      ctx.moveTo(sidewalkTopX, 0);
      ctx.lineTo(sidewalkTopX + sidewalkTopW, 0);
      ctx.lineTo(sidewalkBottomX + sidewalkBottomW, H);
      ctx.lineTo(sidewalkBottomX, H);
      ctx.closePath();
      ctx.fill();

      // Sidewalk joints / tiles
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let y = 0.2 * H; y < H; y += 45) {
        const factor = y / H;
        const currentW = sidewalkTopW + (sidewalkBottomW - sidewalkTopW) * factor;
        const currentX = (W - currentW) / 2;
        ctx.beginPath();
        ctx.moveTo(currentX, y);
        ctx.lineTo(currentX + currentW, y);
        ctx.stroke();
      }

      // Draw hazard geometry representation if applicable
      if (currentScenario.hazardLocation !== 'NONE') {
        const bucketX =
          currentScenario.hazardLocation === 'LEFT'
            ? W * 0.16
            : currentScenario.hazardLocation === 'CENTER'
            ? W * 0.5
            : W * 0.84;
        const hazardY = H * 0.5;

        ctx.save();
        if (currentScenario.hazardType === 'ELEVATED') {
          // Raised Paver / Brick
          ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bucketX - 35, hazardY - 18, 70, 36, 6);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.font = '10px monospace';
          ctx.fillText('RAISED BRICK', bucketX - 32, hazardY + 4);
        } else if (currentScenario.hazardType === 'DEPRESSION') {
          // Sunken Pothole / Open Drain
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(bucketX, hazardY, 36, 22, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fca5a5';
          ctx.font = '10px monospace';
          ctx.fillText('POTHOLE / DROP', bucketX - 40, hazardY + 3);
        }
        ctx.restore();
      }

      ctx.restore();

      // State handling
      let engineState: EngineState = 'WALKING';
      if (currentScenario.isStationary) {
        engineState = 'STATIONARY';
      } else if (currentScenario.isLowTexture) {
        engineState = 'LOW_TEXTURE_PAUSED';
      }

      // Generate features & optical flow vectors
      const totalPoints = currentScenario.isLowTexture ? 18 : 84;
      const pointsPrev: Point2D[] = [];
      const pointsCurr: Point2D[] = [];
      const pointsExpected: Point2D[] = [];

      // Simulated forward walking flow speed (pixels per frame)
      const baseSpeed = currentScenario.isStationary ? 0.2 : 5.0;

      // Simulated hand jitter
      const wx = currentScenario.handJitter ? Math.sin(frameNum * 0.4) * 0.25 : 0;
      const wy = currentScenario.handJitter ? Math.cos(frameNum * 0.3) * 0.2 : 0;
      const rotShift = calculateGyroDerotation(wx, wy, 0.033, W * 0.95);

      // Safe Anchor Zone (bottom 30%: 0.70*H to 0.95*H)
      const anchorPrev: Point2D[] = [];
      const anchorCurr: Point2D[] = [];

      // Look-Ahead Zone (middle 40%: 0.30*H to 0.70*H)
      const lookAheadPrev: Point2D[] = [];
      const lookAheadCurr: Point2D[] = [];

      // Generate distributed points across the sidewalk
      for (let i = 0; i < totalPoints; i++) {
        // Distribute points in portrait frame
        const col = i % 7;
        const row = Math.floor(i / 7);
        const normX = 0.15 + (col / 6) * 0.7;
        const normY = 0.32 + (row / 12) * 0.62;

        const px = normX * W + (Math.sin(i * 13 + frameNum * 0.02) * 8);
        const py = normY * H + (Math.cos(i * 7 + frameNum * 0.02) * 6);

        // Ground perspective makes bottom points move faster down
        const perspectiveScale = 0.6 + (py / H) * 0.8;
        const expectedDy = baseSpeed * perspectiveScale;
        const expectedDx = (px - W / 2) * 0.02;

        // Is this point on the hazard?
        const isHazardBucket =
          (currentScenario.hazardLocation === 'LEFT' && px < W / 3) ||
          (currentScenario.hazardLocation === 'CENTER' && px >= W / 3 && px <= (2 * W) / 3) ||
          (currentScenario.hazardLocation === 'RIGHT' && px > (2 * W) / 3);

        const isInLookAhead = py >= 0.30 * H && py <= 0.70 * H;
        const isHazardPoint = isHazardBucket && isInLookAhead && Math.abs(py - H * 0.5) < 30;

        let actualDy = expectedDy;
        let actualDx = expectedDx;

        if (isHazardPoint) {
          if (currentScenario.hazardType === 'ELEVATED') {
            // Approaching camera faster -> larger downward flow
            actualDy = expectedDy * 2.2;
          } else if (currentScenario.hazardType === 'DEPRESSION') {
            // Slower downward flow
            actualDy = expectedDy * 0.2;
          }
        }

        // Add hand jitter if enabled
        const currXWithJitter = px + actualDx + (currentScenario.handJitter ? rotShift.dx : 0);
        const currYWithJitter = py + actualDy + (currentScenario.handJitter ? rotShift.dy : 0);

        // Derotate
        const derotated = enableDerotation
          ? derotatePoint({ x: currXWithJitter, y: currYWithJitter }, rotShift)
          : { x: currXWithJitter, y: currYWithJitter };

        pointsPrev.push({ x: px, y: py });
        pointsCurr.push(derotated);
        pointsExpected.push({ x: px + expectedDx, y: py + expectedDy });

        if (py >= 0.70 * H && py <= 0.95 * H) {
          anchorPrev.push({ x: px, y: py });
          anchorCurr.push(derotated);
        } else if (isInLookAhead) {
          lookAheadPrev.push({ x: px, y: py });
          lookAheadCurr.push(derotated);
        }
      }

      // Evaluate Look Ahead Points
      const evaluatedPoints = evaluateLookAheadPoints(
        lookAheadPrev,
        lookAheadCurr,
        lookAheadPrev.map((p) => ({
          x: p.x + (p.x - W / 2) * 0.02,
          y: p.y + baseSpeed * (0.6 + (p.y / H) * 0.8),
        })),
        baseSpeed,
        W,
        anomalyThreshold
      );

      // Evaluate temporal debouncing
      const debounceResult = evaluateBucketDebounce(
        evaluatedPoints,
        consecutiveCountsRef.current,
        debounceFrames,
        35.0
      );
      consecutiveCountsRef.current = debounceResult.updatedConsecutiveCounts;

      const anyTriggered = Object.values(debounceResult.buckets).some((b) => b.isTriggered);
      if (anyTriggered && !currentScenario.isStationary && !currentScenario.isLowTexture) {
        engineState = 'HAZARD_ALERT';
      }

      // Trigger directional audio/haptic pulse if newly triggered
      const now = performance.now();
      if (anyTriggered && now - lastAlertTimeRef.current > 700 && audioFeedbackEnabled) {
        lastAlertTimeRef.current = now;
        const triggeredBucket = Object.values(debounceResult.buckets).find((b) => b.isTriggered)?.bucket;
        if (triggeredBucket) {
          playDirectionalHaptic(triggeredBucket);
        }
      }

      // 1. Draw Look-Ahead Zone & 3-Bucket Grid (Cyan dashed lines)
      const lookAheadTop = 0.30 * H;
      const lookAheadBottom = 0.70 * H;
      const oneThirdX = W / 3;
      const twoThirdX = (2 * W) / 3;

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);

      // Vertical dividers
      ctx.beginPath();
      ctx.moveTo(oneThirdX, lookAheadTop);
      ctx.lineTo(oneThirdX, lookAheadBottom);
      ctx.moveTo(twoThirdX, lookAheadTop);
      ctx.lineTo(twoThirdX, lookAheadBottom);
      // Horizontal bounds
      ctx.moveTo(0, lookAheadTop);
      ctx.lineTo(W, lookAheadTop);
      ctx.moveTo(0, lookAheadBottom);
      ctx.lineTo(W, lookAheadBottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight active buckets
      Object.values(debounceResult.buckets).forEach((b) => {
        const leftX = b.bucket === 'LEFT' ? 0 : b.bucket === 'CENTER' ? oneThirdX : twoThirdX;
        const rightX = b.bucket === 'LEFT' ? oneThirdX : b.bucket === 'CENTER' ? twoThirdX : W;

        if (b.isTriggered) {
          ctx.fillStyle =
            b.dominantHazard === 'ELEVATED'
              ? 'rgba(245, 158, 11, 0.22)'
              : 'rgba(239, 68, 68, 0.26)';
          ctx.fillRect(leftX, lookAheadTop, rightX - leftX, lookAheadBottom - lookAheadTop);
        }

        // Bucket labels
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = b.isTriggered
          ? b.dominantHazard === 'ELEVATED'
            ? '#f59e0b'
            : '#ef4444'
          : 'rgba(56, 189, 248, 0.85)';
        ctx.fillText(
          `${b.bucket} ${b.anomalyPercentage > 0 ? `(${b.anomalyPercentage.toFixed(0)}%)` : ''}`,
          leftX + 8,
          lookAheadTop + 18
        );
      });

      // 2. Draw Safe Anchor Zone (Green rectangle at bottom 30%)
      const anchorTop = 0.70 * H;
      const anchorBottom = 0.95 * H;
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(6, anchorTop, W - 12, anchorBottom - anchorTop);

      ctx.fillStyle = 'rgba(74, 222, 128, 0.85)';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('SAFE ANCHOR ZONE (HOMOGRAPHY GROUND REF)', 14, anchorTop + 16);

      // 3. Draw Optical Flow Vectors
      // Anchor zone inliers (always green)
      ctx.lineWidth = 1.5;
      for (let i = 0; i < anchorPrev.length; i++) {
        const p1 = anchorPrev[i];
        const p2 = anchorCurr[i];
        ctx.strokeStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Look-Ahead zone vectors (green for normal, amber/red for anomalies)
      for (const pt of evaluatedPoints) {
        if (pt.isAnomaly) {
          ctx.strokeStyle = pt.hazardType === 'ELEVATED' ? '#f59e0b' : '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pt.x - pt.residualX, pt.y - pt.residualY);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();

          // Circle head
          ctx.fillStyle = pt.hazardType === 'ELEVATED' ? '#f59e0b' : '#ef4444';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - baseSpeed);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();

          ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Draw Real-Time Telemetry HUD Overlay in Top-Left Corner
      const stateColors: Record<EngineState, string> = {
        WALKING: '#22c55e',
        HAZARD_ALERT: '#ef4444',
        HAZARD_DETECTED: '#ef4444',
        STATIONARY: '#eab308',
        LOW_TEXTURE_PAUSED: '#94a3b8',
        UNSTABLE_PLANE: '#f97316',
      };

      const cardW = W - 24;
      const cardH = 88;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(12, 12, cardW, cardH, 8);
      ctx.fill();
      ctx.stroke();

      // Status indicator circle & state text
      ctx.fillStyle = stateColors[engineState];
      ctx.beginPath();
      ctx.arc(28, 32, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`STATE: ${engineState}`, 42, 36);

      // Line 1: FPS and Latency
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.fillText(
        `30.0 FPS  |  Latency: ${currentScenario.isStationary ? '1.8' : '6.2'} ms/frame (Cap: <8ms)`,
        24,
        56
      );

      // Line 2: Valid tracks, Inliers, median flow
      const inlierPct = currentScenario.isLowTexture ? 25 : currentScenario.isStationary ? 0 : 88;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(
        `Tracks: ${totalPoints} | Inliers: ${inlierPct}% | Flow: ${currentScenario.isStationary ? '0.2' : '4.8'} px`,
        24,
        74
      );

      ctx.restore();

      // Update state for React controls
      setTelemetry({
        fps: 30,
        latencyMs: currentScenario.isStationary ? 2 : 6,
        tracks: totalPoints,
        inliersPercent: inlierPct,
        state: engineState,
        medianFlow: currentScenario.isStationary ? 0.2 : 4.8,
      });

      setActiveAlerts({
        LEFT: {
          triggered: debounceResult.buckets.LEFT.isTriggered,
          type: debounceResult.buckets.LEFT.dominantHazard,
          frames: debounceResult.buckets.LEFT.consecutiveTriggerFrames,
        },
        CENTER: {
          triggered: debounceResult.buckets.CENTER.isTriggered,
          type: debounceResult.buckets.CENTER.dominantHazard,
          frames: debounceResult.buckets.CENTER.consecutiveTriggerFrames,
        },
        RIGHT: {
          triggered: debounceResult.buckets.RIGHT.isTriggered,
          type: debounceResult.buckets.RIGHT.dominantHazard,
          frames: debounceResult.buckets.RIGHT.consecutiveTriggerFrames,
        },
      });
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, currentScenario, anomalyThreshold, debounceFrames, audioFeedbackEnabled, enableDerotation]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Interactive Canvas Screen */}
      <div className="lg:col-span-7 flex flex-col items-center">
        <div className="relative w-full max-w-[360px] aspect-[3/4] bg-slate-950 rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center">
          <canvas
            ref={canvasRef}
            width={320}
            height={426}
            className="w-full h-full object-cover"
          />

          {/* Quick HUD controls overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 bg-slate-900/80 backdrop-blur rounded-xl border border-slate-700 text-xs">
            <span className="font-mono text-emerald-400 font-semibold">
              Live Canvas Stream (320x426)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title={isRunning ? 'Pause' : 'Play'}
                aria-label={isRunning ? 'Pause simulation' : 'Play simulation'}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  consecutiveCountsRef.current = { LEFT: 0, CENTER: 0, RIGHT: 0 };
                }}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                title="Reset Frame History"
                aria-label="Reset Frame History"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Ground Inlier</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Elevated Obstacle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
            <span>Pothole / Drop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 border-t border-dashed border-sky-400"></span>
            <span>3-Bucket Grid</span>
          </div>
        </div>
      </div>

      {/* Right: Field Tuning & Scenarios Panel */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        {/* Scenario Selection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400" />
            Footpath Test Scenarios
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Switch scenarios to observe how classical homography residuals & IMU variance react in real time.
          </p>

          <div className="space-y-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setCurrentScenario(s);
                  consecutiveCountsRef.current = { LEFT: 0, CENTER: 0, RIGHT: 0 };
                }}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex flex-col gap-1 ${
                  currentScenario.id === s.id
                    ? 'bg-sky-950/70 border-sky-500/80 text-sky-200'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>{s.name}</span>
                  {s.hazardType !== 'NONE' && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        s.hazardType === 'ELEVATED'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-600/50'
                          : 'bg-red-950/80 text-red-300 border border-red-600/50'
                      }`}
                    >
                      {s.hazardLocation}: {s.hazardType}
                    </span>
                  )}
                  {s.isStationary && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-950 text-yellow-300 border border-yellow-600/50">
                      STATIONARY
                    </span>
                  )}
                  {s.isLowTexture && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                      GUARD PAUSE
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">{s.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live Field Tuning Sliders */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            Live Field Tuning Controls
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1 text-slate-300">
                <span className="font-mono">Anomaly Threshold: {anomalyThreshold.toFixed(2)}</span>
                <span className="text-slate-500 font-mono">(0.20 - 1.00)</span>
              </div>
              <input
                type="range"
                min="0.20"
                max="1.00"
                step="0.05"
                value={anomalyThreshold}
                onChange={(e) => setAnomalyThreshold(parseFloat(e.target.value))}
                className="w-full accent-sky-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                aria-label="Anomaly Threshold"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Ratio of residual displacement vs median ground flow to classify an obstacle point.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1 text-slate-300">
                <span className="font-mono">Debounce Frames: {debounceFrames}</span>
                <span className="text-slate-500 font-mono">(1 - 6 frames)</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={debounceFrames}
                onChange={(e) => setDebounceFrames(parseInt(e.target.value, 10))}
                className="w-full accent-sky-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                aria-label="Debounce Frames"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Consecutive frames required with &gt;=35% anomalous points before triggering vibration/overlay.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={audioFeedbackEnabled}
                  onChange={(e) => setAudioFeedbackEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 accent-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                  Synthesize Tactile Haptics (Web Audio API Waveforms)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={enableDerotation}
                  onChange={(e) => setEnableDerotation(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 accent-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  Enable IMU Gyroscope Derotation
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 3-Bucket Status Cards */}
        <div className="grid grid-cols-3 gap-2">
          {(['LEFT', 'CENTER', 'RIGHT'] as BucketId[]).map((bucket) => {
            const alert = activeAlerts[bucket];
            const isTrig = alert?.triggered;
            return (
              <div
                key={bucket}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isTrig
                    ? alert.type === 'ELEVATED'
                      ? 'bg-amber-950/60 border-amber-500 text-amber-200'
                      : 'bg-red-950/60 border-red-500 text-red-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  {bucket}
                </div>
                <div className="text-xs font-bold mt-1">
                  {isTrig ? alert.type : 'CLEAR'}
                </div>
                <div className="text-[10px] font-mono mt-0.5 text-slate-500">
                  {alert?.frames || 0}/{debounceFrames} frames
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
