import React, { useState, useEffect } from 'react';
import { playDirectionalHaptic } from '../utils/audioHaptics';
import {
  Smartphone,
  Eye,
  Activity,
  Layers,
  Zap,
  ShieldCheck,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export const DoomscrollOverlaySimulator: React.FC = () => {
  const [activeEdge, setActiveEdge] = useState<'LEFT' | 'CENTER' | 'RIGHT' | null>(null);
  const [activeHazard, setActiveHazard] = useState<'ELEVATED' | 'DEPRESSION'>('ELEVATED');
  const [showAnchorInspection, setShowAnchorInspection] = useState<boolean>(true);
  const [hapticLog, setHapticLog] = useState<string[]>([]);
  const [autoHazardInterval, setAutoHazardInterval] = useState<boolean>(false);

  // Trigger Edge Glow & Haptic feedback
  const triggerHazard = (bucket: 'LEFT' | 'CENTER' | 'RIGHT', hazard: 'ELEVATED' | 'DEPRESSION') => {
    setActiveEdge(bucket);
    setActiveHazard(hazard);
    playDirectionalHaptic(bucket);

    const logEntry =
      bucket === 'LEFT'
        ? `[${new Date().toLocaleTimeString()}] LEFT: Double sharp tick [0, 35, 40, 35] ms -> ${hazard}`
        : bucket === 'RIGHT'
        ? `[${new Date().toLocaleTimeString()}] RIGHT: Single firm pulse [0, 110] ms -> ${hazard}`
        : `[${new Date().toLocaleTimeString()}] CENTER: Urgent triple pulse [0, 50, 30, 50, 30, 80] ms -> ${hazard}`;

    setHapticLog((prev) => [logEntry, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setActiveEdge((curr) => (curr === bucket ? null : curr));
    }, 1800);
  };

  useEffect(() => {
    if (!autoHazardInterval) return;
    const interval = setInterval(() => {
      const buckets: ('LEFT' | 'CENTER' | 'RIGHT')[] = ['LEFT', 'CENTER', 'RIGHT'];
      const chosen = buckets[Math.floor(Math.random() * buckets.length)];
      const type = chosen === 'CENTER' ? 'DEPRESSION' : 'ELEVATED';
      triggerHazard(chosen, type);
    }, 4500);
    return () => clearInterval(interval);
  }, [autoHazardInterval]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Phone Screen Frame */}
      <div className="lg:col-span-5 flex flex-col items-center">
        <div className="text-center mb-3">
          <div className="text-xs font-mono text-sky-400 font-semibold uppercase tracking-wider">
            Vivo T3 5G • Android 16 (OriginOS 6)
          </div>
          <div className="text-[11px] text-slate-400">
            Simulating Background Doomscroll Overlay with Foreground Camera Service
          </div>
        </div>

        {/* Physical Device Frame */}
        <div className="relative w-[310px] h-[620px] bg-black rounded-[42px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-4 border-slate-700 select-none">
          {/* Dynamic Island / Camera Notch */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-40 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700"></div>
          </div>

          {/* Android 16 Keep-Alive 1x1 Anchor Visualizer */}
          <div
            className={`absolute top-4 left-4 z-50 transition-all ${
              showAnchorInspection
                ? 'p-1.5 bg-emerald-500/90 text-[9px] font-mono font-bold text-black rounded border border-white shadow-lg animate-pulse'
                : 'w-[1px] h-[1px] opacity-10 bg-emerald-400'
            }`}
            title="Android 16 TYPE_APPLICATION_OVERLAY 1x1 anchor keeps app user-visible"
          >
            {showAnchorInspection ? '1x1 ANCHOR (ACTIVE)' : ''}
          </div>

          {/* Phone Display Content (Simulated Doomscroll Social App) */}
          <div className="relative w-full h-full bg-slate-950 rounded-[34px] overflow-hidden flex flex-col text-slate-100">
            {/* Status Bar */}
            <div className="h-8 px-6 pt-2 flex justify-between items-center text-[10px] text-slate-400 font-mono z-20">
              <span>09:41</span>
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>5G</span>
                <span>88%</span>
              </div>
            </div>

            {/* Simulated App Header */}
            <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Feed</span>
              <span className="text-[10px] text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-800/50">
                PathSense Active (BG)
              </span>
            </div>

            {/* Social Feed Content (Simulating user doomscrolling while walking) */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs font-sans">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-sky-600"></div>
                  <div>
                    <div className="font-semibold text-slate-200">Alex_Explorer</div>
                    <div className="text-[10px] text-slate-400">Walking down Main St...</div>
                  </div>
                </div>
                <div className="h-28 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                  Doomscrolling through posts...
                </div>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600"></div>
                  <div>
                    <div className="font-semibold text-slate-200">UrbanTech_News</div>
                    <div className="text-[10px] text-slate-400">12 min ago</div>
                  </div>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Notice how PathSense protects you without interrupting your screen reading. If your camera catches an upcoming sidewalk drop, the edge glow & directional haptics alert you!
                </p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-purple-600"></div>
                  <div>
                    <div className="font-semibold text-slate-200">Dev_OriginOS</div>
                    <div className="text-[10px] text-slate-400">Just now</div>
                  </div>
                </div>
                <div className="h-20 bg-slate-800/60 rounded-lg flex items-center justify-center text-slate-500 text-[11px]">
                  OriginOS 6 CameraX Stream Running at 30 FPS
                </div>
              </div>
            </div>

            {/* ----------------- SCREEN EDGE GLOW OVERLAYS ----------------- */}
            {/* Left Edge Glow Bar */}
            {activeEdge === 'LEFT' && (
              <div
                className={`absolute top-0 left-0 bottom-0 w-8 pointer-events-none transition-all duration-150 z-30 ${
                  activeHazard === 'ELEVATED'
                    ? 'bg-gradient-to-r from-amber-500/90 via-amber-500/40 to-transparent shadow-[0_0_30px_rgba(245,158,11,0.8)]'
                    : 'bg-gradient-to-r from-red-600/95 via-red-600/40 to-transparent shadow-[0_0_30px_rgba(239,68,68,0.8)]'
                }`}
              />
            )}

            {/* Right Edge Glow Bar */}
            {activeEdge === 'RIGHT' && (
              <div
                className={`absolute top-0 right-0 bottom-0 w-8 pointer-events-none transition-all duration-150 z-30 ${
                  activeHazard === 'ELEVATED'
                    ? 'bg-gradient-to-l from-amber-500/90 via-amber-500/40 to-transparent shadow-[0_0_30px_rgba(245,158,11,0.8)]'
                    : 'bg-gradient-to-l from-red-600/95 via-red-600/40 to-transparent shadow-[0_0_30px_rgba(239,68,68,0.8)]'
                }`}
              />
            )}

            {/* Center / Bottom Edge Glow & Vignette (Pothole / Drop) */}
            {activeEdge === 'CENTER' && (
              <>
                <div
                  className={`absolute left-0 right-0 bottom-0 h-16 pointer-events-none transition-all duration-150 z-30 ${
                    activeHazard === 'DEPRESSION'
                      ? 'bg-gradient-to-t from-red-600/95 via-red-600/50 to-transparent shadow-[0_0_40px_rgba(239,68,68,0.9)]'
                      : 'bg-gradient-to-t from-amber-500/90 via-amber-500/40 to-transparent shadow-[0_0_40px_rgba(245,158,11,0.9)]'
                  }`}
                />
                <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none bg-gradient-to-b from-red-600/60 to-transparent z-30" />
              </>
            )}

            {/* Active Hazard Banner Notification (In-device HUD) */}
            {activeEdge && (
              <div className="absolute top-10 left-3 right-3 bg-slate-900/95 border border-red-500/60 rounded-xl p-2.5 shadow-2xl flex items-center justify-between z-30 animate-bounce">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      activeHazard === 'ELEVATED' ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                  ></span>
                  <div>
                    <div className="text-[11px] font-bold text-white uppercase tracking-wider">
                      {activeEdge} HAZARD: {activeHazard}
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Step clear in {activeEdge.toLowerCase()} path
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-sky-400">
                  {activeEdge === 'LEFT' ? '2 Ticks' : activeEdge === 'RIGHT' ? '1 Long Pulse' : '3 Rapid Pulses'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls & Android 16 System Architecture Inspector */}
      <div className="lg:col-span-7 flex flex-col gap-5">
        {/* Interactive Hazard Trigger Testing */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Simulate Walking Hazards (Edge Alert & Haptics)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Click each button below to trigger the exact screen-edge glow bar and directional haptic waveform synthesized via Web Audio API.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => triggerHazard('LEFT', 'ELEVATED')}
              className="p-3 bg-slate-950 border border-amber-500/40 hover:border-amber-400 rounded-xl text-left transition-all group"
            >
              <div className="text-xs font-bold text-amber-400 flex items-center justify-between mb-1">
                <span>LEFT HAZARD</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300">
                  2 Ticks
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">Raised Brick / Curb</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Waveform: [0, 35, 40, 35] ms
              </div>
            </button>

            <button
              type="button"
              onClick={() => triggerHazard('CENTER', 'DEPRESSION')}
              className="p-3 bg-slate-950 border border-red-500/50 hover:border-red-400 rounded-xl text-left transition-all group"
            >
              <div className="text-xs font-bold text-red-400 flex items-center justify-between mb-1">
                <span>CENTER HAZARD</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300">
                  3 Pulses
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">Deep Pothole / Drop</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Waveform: [0, 50, 30, 50, 30, 80] ms
              </div>
            </button>

            <button
              type="button"
              onClick={() => triggerHazard('RIGHT', 'ELEVATED')}
              className="p-3 bg-slate-950 border border-sky-500/40 hover:border-sky-400 rounded-xl text-left transition-all group"
            >
              <div className="text-xs font-bold text-sky-400 flex items-center justify-between mb-1">
                <span>RIGHT HAZARD</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-300">
                  1 Firm Pulse
                </span>
              </div>
              <div className="text-[11px] text-slate-300 font-medium">Broken Sidewalk Edge</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                Waveform: [0, 110] ms
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between mt-4 pt-3 border-t border-slate-800 gap-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={autoHazardInterval}
                onChange={(e) => setAutoHazardInterval(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 accent-sky-500"
              />
              <span>Auto-simulate random hazards every 4.5s</span>
            </label>

            <button
              type="button"
              onClick={() => setShowAnchorInspection(!showAnchorInspection)}
              className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono"
            >
              <Eye className="w-3.5 h-3.5" />
              {showAnchorInspection ? 'Hide 1x1 Anchor Badge' : 'Inspect 1x1 Anchor Badge'}
            </button>
          </div>
        </div>

        {/* Android 16 OriginOS 6 Camera Keep-Alive Rationale Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Android 16 & OriginOS 6 Background Camera Mechanism
          </h3>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-mono">1x1 Pixel Transparent Anchor:</strong>{' '}
                Android 16 enforces strict camera privacy mutes for background apps. By adding a 1x1 pixel view with{' '}
                <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">alpha = 0.01</code> using{' '}
                <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">TYPE_APPLICATION_OVERLAY</code> and{' '}
                <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">FLAG_NOT_FOCUSABLE</code>, the WindowManager treats the app as having an active user-visible surface, allowing CameraX to stream continuously without being throttled or terminated.
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sky-300 font-mono">Non-Intrusive Edge Glow:</strong>{' '}
                Instead of obstructive popups, PathSense illuminates the exact screen border (Left, Center/Bottom, Right) with an animated gradient shader so the user's attention is intuitively directed to avoid stepping into the obstacle.
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-purple-300 font-mono">Directional Haptic Waveforms:</strong>{' '}
                Uses Android 8.0+ <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">VibrationEffect.createWaveform()</code> with precise millisecond timings and 0-255 amplitudes, giving clear muscle memory feedback even if the user does not look at the phone screen.
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Haptics Waveform Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-300 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Haptic Waveform Execution Log
            </span>
            <span className="text-[11px] text-slate-500 font-mono">VibrationEffect.createWaveform</span>
          </div>

          <div className="bg-slate-950 rounded-lg p-2.5 font-mono text-[11px] text-slate-400 space-y-1 min-h-[85px] border border-slate-800">
            {hapticLog.length === 0 ? (
              <div className="text-slate-600 italic">No haptic triggers yet. Click any button above to test.</div>
            ) : (
              hapticLog.map((log, idx) => (
                <div key={idx} className="text-slate-300">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
