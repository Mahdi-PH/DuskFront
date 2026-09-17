import type { AudioEngine } from './AudioEngine';

export type MusicIntensity = 'normal' | 'finalLap' | 'finished';

const CHORD_PROGRESSION_HZ: number[][] = [
  [220, 277.18, 329.63], // A minor-ish tropical triad
  [246.94, 311.13, 369.99],
  [261.63, 329.63, 392.0],
  [196.0, 246.94, 293.66],
];

interface IntensityProfile {
  bpm: number;
  arpNotes: number;
  gain: number;
  filterHz: number;
}

const PROFILES: Record<MusicIntensity, IntensityProfile> = {
  normal: { bpm: 96, arpNotes: 3, gain: 0.05, filterHz: 1400 },
  finalLap: { bpm: 128, arpNotes: 4, gain: 0.075, filterHz: 2400 },
  finished: { bpm: 80, arpNotes: 3, gain: 0.04, filterHz: 900 },
};

/** A tiny generative music engine: an arpeggiated chord progression scheduled ahead of
 * time (the standard WebAudio lookahead-scheduler pattern), so tempo/brightness/density
 * can shift live between "normal", "final lap" and "finished" without any audio files
 * or a hard loop-point seam. */
export class MusicDirector {
  private intensity: MusicIntensity = 'normal';
  private schedulerHandle: number | null = null;
  private nextNoteTime = 0;
  private chordIndex = 0;
  private noteIndex = 0;
  private readonly filter: BiquadFilterNode;
  private readonly gain: GainNode;

  constructor(private readonly audioEngine: AudioEngine) {
    const ctx = audioEngine.context;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = PROFILES.normal.filterHz;
    this.gain = ctx.createGain();
    this.gain.gain.value = PROFILES.normal.gain;
    this.filter.connect(this.gain);
    this.gain.connect(audioEngine.musicGain);
  }

  setIntensity(intensity: MusicIntensity): void {
    if (this.intensity === intensity) return;
    this.intensity = intensity;
    const profile = PROFILES[intensity];
    const now = this.audioEngine.context.currentTime;
    this.filter.frequency.setTargetAtTime(profile.filterHz, now, 1.2);
    this.gain.gain.setTargetAtTime(profile.gain, now, 1.2);
  }

  start(): void {
    if (this.schedulerHandle !== null) return;
    this.nextNoteTime = this.audioEngine.context.currentTime;
    this.schedulerHandle = window.setInterval(() => this.scheduler(), 25);
  }

  stop(): void {
    if (this.schedulerHandle !== null) {
      window.clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }

  private scheduler(): void {
    const scheduleAheadSec = 0.12;
    while (this.nextNoteTime < this.audioEngine.context.currentTime + scheduleAheadSec) {
      this.scheduleNote(this.nextNoteTime);
      const profile = PROFILES[this.intensity];
      const secondsPerBeat = 60 / profile.bpm;
      this.nextNoteTime += secondsPerBeat / 2;
    }
  }

  private scheduleNote(time: number): void {
    const profile = PROFILES[this.intensity];
    const chord = CHORD_PROGRESSION_HZ[this.chordIndex]!;
    const freq = chord[this.noteIndex % chord.length]! * (this.noteIndex % (chord.length * 2) < chord.length ? 1 : 2);

    const ctx = this.audioEngine.context;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const noteGain = ctx.createGain();
    osc.connect(noteGain);
    noteGain.connect(this.filter);
    noteGain.gain.setValueAtTime(0, time);
    noteGain.gain.linearRampToValueAtTime(1, time + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.start(time);
    osc.stop(time + 0.4);

    this.noteIndex += 1;
    if (this.noteIndex >= profile.arpNotes * 2) {
      this.noteIndex = 0;
      this.chordIndex = (this.chordIndex + 1) % CHORD_PROGRESSION_HZ.length;
    }
  }

  dispose(): void {
    this.stop();
  }
}
