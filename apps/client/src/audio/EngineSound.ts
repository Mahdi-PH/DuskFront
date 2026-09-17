import type { VehicleDefinition } from '@velocity-island/shared';
import type { AudioEngine } from './AudioEngine';

/** Procedural per-vehicle engine loop: two detuned sawtooth oscillators through a
 * throttle-driven lowpass filter, plus a touch of filtered noise for grit. Base pitch
 * and detune vary with the vehicle's mass/top speed so heavier karts sound lower and
 * gruffer than light ones — no audio samples involved. */
export class EngineSound {
  private readonly osc1: OscillatorNode;
  private readonly osc2: OscillatorNode;
  private readonly noiseSource: AudioBufferSourceNode;
  private readonly filter: BiquadFilterNode;
  private readonly noiseFilter: BiquadFilterNode;
  private readonly gain: GainNode;
  private readonly noiseGain: GainNode;
  private readonly baseFreq: number;
  private started = false;

  constructor(
    private readonly audioEngine: AudioEngine,
    definition: VehicleDefinition,
  ) {
    const ctx = audioEngine.context;
    this.baseFreq = 55 + (2000 - definition.physics.mass) / 20;

    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'sawtooth';
    this.osc2.detune.value = 12;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0.7;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;

    this.noiseSource = audioEngine.createNoiseSource();
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.frequency.value = 800;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;

    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.gain);
    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.gain);
    this.gain.connect(audioEngine.sfxGain);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.osc1.frequency.value = this.baseFreq;
    this.osc2.frequency.value = this.baseFreq;
    this.osc1.start();
    this.osc2.start();
    this.noiseSource.start();
  }

  /** Called once per render frame with the vehicle's current speed/throttle state. */
  update(speedRatio: number, throttle: number, isBoosting: boolean): void {
    if (!this.started) return;
    const now = this.audioEngine.context.currentTime;
    const clampedSpeed = Math.min(1, Math.max(0, speedRatio));
    const targetFreq = this.baseFreq * (1 + clampedSpeed * 2.4 + (isBoosting ? 0.6 : 0));
    this.osc1.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.osc2.frequency.setTargetAtTime(targetFreq * 1.003, now, 0.08);

    const targetCutoff = 350 + clampedSpeed * 2600 + throttle * 500;
    this.filter.frequency.setTargetAtTime(targetCutoff, now, 0.1);

    const targetGain = 0.05 + throttle * 0.09 + clampedSpeed * 0.05;
    this.gain.gain.setTargetAtTime(targetGain, now, 0.1);

    this.noiseFilter.frequency.setTargetAtTime(600 + clampedSpeed * 1200, now, 0.1);
    this.noiseGain.gain.setTargetAtTime(0.01 + throttle * 0.02, now, 0.1);
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    try {
      this.osc1.stop();
      this.osc2.stop();
      this.noiseSource.stop();
    } catch {
      // Already stopped — safe to ignore.
    }
  }
}
