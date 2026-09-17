/** Owns the single shared AudioContext and the master/music/sfx gain graph. All sound
 * in the game is synthesized with WebAudio oscillators/noise buffers — no external
 * audio assets — so this is also where a shared white-noise buffer (used by tire
 * screech, collisions, explosions, boost whoosh) lives to avoid re-generating it. */
export class AudioEngine {
  readonly context: AudioContext;
  readonly masterGain: GainNode;
  readonly musicGain: GainNode;
  readonly sfxGain: GainNode;
  readonly noiseBuffer: AudioBuffer;

  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new Ctx();

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);

    this.noiseBuffer = this.createNoiseBuffer(2);
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  createNoiseSource(): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    return source;
  }

  setVolumes(master: number, music: number, sfx: number): void {
    const now = this.context.currentTime;
    this.masterGain.gain.setTargetAtTime(master, now, 0.05);
    this.musicGain.gain.setTargetAtTime(music, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(sfx, now, 0.05);
  }

  /** Browsers require a user gesture before audio can start; call this from the first
   * pointerdown/keydown the game sees. */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  dispose(): void {
    void this.context.close();
  }
}
