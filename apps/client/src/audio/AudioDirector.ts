import type { VehicleDefinition } from '@velocity-island/shared';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/GameEvents';
import { AudioEngine } from './AudioEngine';
import { EngineSound } from './EngineSound';
import { SfxLibrary } from './SfxLibrary';
import { MusicDirector, type MusicIntensity } from './MusicDirector';
import { HapticsManager } from './HapticsManager';

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  vibrationEnabled: boolean;
}

/** Wires the WebAudio synthesis layer (engine loops, one-shot SFX, generative music,
 * haptics) to gameplay events. AudioContext can't start without a user gesture, so
 * everything here is a no-op until `ensureStarted()` resolves after the first input. */
export class AudioDirector {
  private audioEngine: AudioEngine | null = null;
  private sfx: SfxLibrary | null = null;
  private music: MusicDirector | null = null;
  private readonly haptics = new HapticsManager();
  private readonly engineSounds = new Map<string, EngineSound>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor(events: EventBus<GameEventMap>) {
    this.unsubscribers.push(
      events.on('vehicleCollision', ({ strength, playerId }) => {
        this.sfx?.collision(strength);
        if (playerId === 'player') this.haptics.collision(strength);
      }),
      events.on('boostActivated', ({ playerId }) => {
        this.sfx?.boost();
        if (playerId === 'player') this.haptics.boost();
      }),
      events.on('powerUpPickedUp', () => this.sfx?.powerUpPickup()),
      events.on('powerUpUsed', ({ playerId }) => {
        this.sfx?.powerUpUse();
        if (playerId === 'player') this.haptics.drift();
      }),
      events.on('raceCountdownTick', ({ value }) => {
        if (value !== null) this.sfx?.countdownBeep(value === 0);
      }),
      events.on('raceFinished', ({ playerId, position }) => {
        if (playerId !== 'player') return;
        this.sfx?.finish(position === 1);
        this.haptics.finish();
        this.music?.setIntensity('finished');
      }),
      events.on('lapCompleted', ({ playerId, lap, totalLaps }) => {
        if (playerId !== 'player') return;
        if (lap >= totalLaps - 1) this.music?.setIntensity('finalLap');
      }),
    );
  }

  async ensureStarted(settings: AudioSettings): Promise<void> {
    if (!this.audioEngine) {
      this.audioEngine = new AudioEngine();
      this.sfx = new SfxLibrary(this.audioEngine);
      this.music = new MusicDirector(this.audioEngine);
      this.music.start();
    }
    await this.audioEngine.resume();
    this.applySettings(settings);
  }

  applySettings(settings: AudioSettings): void {
    this.audioEngine?.setVolumes(settings.masterVolume, settings.musicVolume, settings.sfxVolume);
    this.haptics.setEnabled(settings.vibrationEnabled);
  }

  registerVehicle(playerId: string, definition: VehicleDefinition): void {
    if (!this.audioEngine || this.engineSounds.has(playerId)) return;
    const engine = new EngineSound(this.audioEngine, definition);
    engine.start();
    this.engineSounds.set(playerId, engine);
  }

  updateVehicle(playerId: string, speedRatio: number, throttle: number, isBoosting: boolean, distanceAttenuation: number): void {
    const engine = this.engineSounds.get(playerId);
    engine?.update(speedRatio, throttle * distanceAttenuation, isBoosting);
  }

  setMusicIntensity(intensity: MusicIntensity): void {
    this.music?.setIntensity(intensity);
  }

  driftTick(): void {
    this.sfx?.driftLoopTick();
  }

  brake(): void {
    this.sfx?.brake();
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    for (const engine of this.engineSounds.values()) engine.stop();
    this.engineSounds.clear();
    this.music?.dispose();
    this.audioEngine?.dispose();
  }
}
