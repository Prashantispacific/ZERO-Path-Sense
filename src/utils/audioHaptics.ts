/**
 * Directional Haptics Audio Synthesizer
 * Plays high-fidelity tactile audio pulses mirroring the Android VibrationEffect waveforms:
 * - LEFT: Double short sharp tick ([0, 35, 40, 35], amplitudes [0, 255, 0, 255])
 * - RIGHT: Single long firm pulse ([0, 110], amplitude [0, 255])
 * - CENTER: Urgent triple pulse ([0, 50, 30, 50, 30, 80], amplitudes [0, 255, 0, 255, 0, 255])
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playPulse(freq: number, durationMs: number, delayMs: number, volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    const startTime = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, startTime + durationMs / 1000);

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationMs / 1000);
  } catch (e) {
    console.warn('Audio feedback failed', e);
  }
}

export function playDirectionalHaptic(bucket: 'LEFT' | 'CENTER' | 'RIGHT') {
  // Trigger physical vibration if supported by mobile browser
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (bucket === 'LEFT') {
        navigator.vibrate([35, 40, 35]);
      } else if (bucket === 'RIGHT') {
        navigator.vibrate(110);
      } else {
        navigator.vibrate([50, 30, 50, 30, 80]);
      }
    } catch {
      // Ignored
    }
  }

  // Synthesize acoustic tactile transducer sound
  if (bucket === 'LEFT') {
    // Double sharp tick
    playPulse(180, 35, 0, 0.9);
    playPulse(180, 35, 75, 0.9);
  } else if (bucket === 'RIGHT') {
    // Single firm pulse
    playPulse(140, 110, 0, 0.85);
  } else {
    // Urgent triple pulse
    playPulse(220, 50, 0, 1.0);
    playPulse(240, 50, 80, 1.0);
    playPulse(260, 80, 160, 1.0);
  }
}
