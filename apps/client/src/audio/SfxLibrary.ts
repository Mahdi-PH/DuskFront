import type { AudioEngine } from './AudioEngine';

function envelope(gain: GainNode, ctx: AudioContext, peak: number, attack: number, release: number): void {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);
}

/** One-shot procedural sound effects, all synthesized on demand (no audio files):
 * drift screech, brake chirp, collision thud, boost whoosh, power-up pickup/use chime,
 * explosion, and a short victory/defeat finish sting. */
export class SfxLibrary {
  constructor(private readonly audioEngine: AudioEngine) {}

  private playNoiseBurst(peak: number, durationSec: number, filterFreq: number, filterType: BiquadFilterType = 'bandpass'): void {
    const ctx = this.audioEngine.context;
    const source = this.audioEngine.createNoiseSource();
    source.loop = false;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioEngine.sfxGain);
    envelope(gain, ctx, peak, 0.01, durationSec);
    source.start();
    source.stop(ctx.currentTime + durationSec + 0.05);
  }

  private playTone(freqStart: number, freqEnd: number, durationSec: number, peak: number, type: OscillatorType = 'sine'): void {
    const ctx = this.audioEngine.context;
    const osc = ctx.createOscillator();
    osc.type = type;
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(this.audioEngine.sfxGain);
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + durationSec);
    envelope(gain, ctx, peak, 0.01, durationSec);
    osc.start();
    osc.stop(now + durationSec + 0.05);
  }

  driftLoopTick(): void {
    this.playNoiseBurst(0.05, 0.08, 1400, 'highpass');
  }

  brake(): void {
    this.playNoiseBurst(0.12, 0.18, 900, 'bandpass');
  }

  collision(strength: number): void {
    this.playNoiseBurst(0.15 + strength * 0.25, 0.25, 300, 'lowpass');
    this.playTone(180, 60, 0.2, 0.1 + strength * 0.2, 'triangle');
  }

  boost(): void {
    this.playTone(220, 900, 0.5, 0.18, 'sawtooth');
    this.playNoiseBurst(0.1, 0.4, 2000, 'highpass');
  }

  powerUpPickup(): void {
    const ctx = this.audioEngine.context;
    const notes = [660, 880, 1100];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.audioEngine.sfxGain);
      const startTime = ctx.currentTime + i * 0.06;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  powerUpUse(): void {
    this.playTone(440, 200, 0.15, 0.14, 'square');
  }

  explosion(): void {
    this.playNoiseBurst(0.3, 0.5, 220, 'lowpass');
    this.playTone(120, 30, 0.4, 0.2, 'sawtooth');
  }

  finish(victory: boolean): void {
    const ctx = this.audioEngine.context;
    const notes = victory ? [523, 659, 784, 1046] : [392, 349, 293];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.audioEngine.sfxGain);
      const startTime = ctx.currentTime + i * 0.15;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  countdownBeep(isGo: boolean): void {
    this.playTone(isGo ? 880 : 440, isGo ? 1400 : 440, isGo ? 0.3 : 0.12, 0.18, 'square');
  }
}
