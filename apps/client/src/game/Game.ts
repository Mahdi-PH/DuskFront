import type { AIDifficulty } from '@velocity-island/shared';
import { getVehicleById, RACE_BALANCE } from '@velocity-island/shared';
import { SceneManager } from '../core/SceneManager';
import { Clock } from '../core/Clock';
import { EventBus } from '../core/EventBus';
import { PhysicsWorld, initPhysics } from '../physics/PhysicsWorld';
import { CollisionSystem } from '../physics/CollisionSystem';
import { VehicleController } from '../vehicles/VehicleController';
import { VehicleView } from '../vehicles/VehicleView';
import { EffectsManager } from '../render/EffectsManager';
import { GRAPHICS_PROFILES, detectDefaultQuality, type GraphicsProfile } from '../render/GraphicsSettings';
import { getTrackRuntimeDefinition, getTrackSkyPresetId } from '../tracks/TrackRegistry';
import { buildTrack, type BuiltTrack } from '../tracks/TrackBuilder';
import { RaceManager } from './RaceManager';
import { PowerUpSystem } from '../powerups/PowerUpSystem';
import { AIController } from '../ai/AIController';
import { InputManager } from '../input/InputManager';
import { TouchControls } from '../input/TouchControls';
import { RaceHUD } from '../ui/RaceHUD';
import type { GameEventMap } from './GameEvents';

const BOT_NAMES = ['ZENITH', 'ROCKET', 'BLAZE', 'VORTEX', 'PIXEL', 'SHADOW', 'NOVA'];
const RACER_COLORS = ['#2fd9c9', '#ff5c6c', '#ff7a3d', '#1e6fb8', '#2fb872', '#faf6ee', '#9d7bff', '#38e0ff'];

export interface RaceSetupOptions {
  trackId: string;
  vehicleId: string;
  colorwayId: string;
  laps: number;
  botCount: number;
  aiDifficulty: AIDifficulty;
}

interface BotEntry {
  ai: AIController;
  playerId: string;
}

/** Top-level single-player race orchestrator: owns the render/physics loop and wires
 * together every gameplay system (vehicles, track, AI, power-ups, collisions, HUD).
 * The Colyseus-driven multiplayer path reuses RaceManager/PowerUpSystem but replaces
 * local input + physics authority with server snapshots (see network/ once implemented). */
export class Game {
  private readonly sceneManager: SceneManager;
  private readonly physicsWorld: PhysicsWorld;
  private readonly clock = new Clock();
  private readonly events = new EventBus<GameEventMap>();
  private readonly collisionSystem = new CollisionSystem();
  private readonly inputManager = new InputManager();
  private readonly touchControls: TouchControls;
  private readonly effects: EffectsManager;
  private readonly hud: RaceHUD;

  private track!: BuiltTrack;
  private raceManager!: RaceManager;
  private powerUps!: PowerUpSystem;
  private localPlayerId = 'player';
  private views = new Map<string, VehicleView>();
  private bots: BotEntry[] = [];
  private graphicsProfile: GraphicsProfile;
  private rafHandle: number | null = null;
  private lastUsePowerUpInput = false;
  private displayNames = new Map<string, string>();

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.graphicsProfile = GRAPHICS_PROFILES[detectDefaultQuality()];
    this.sceneManager = new SceneManager(canvas, this.graphicsProfile, 'sunset');
    this.physicsWorld = new PhysicsWorld();
    this.effects = new EffectsManager(this.sceneManager.scene, this.graphicsProfile);
    this.touchControls = new TouchControls(uiContainer);
    this.touchControls.subscribe((state) => this.inputManager.setTouchState(state));
    this.hud = new RaceHUD(uiContainer);
  }

  static async create(canvas: HTMLCanvasElement, uiContainer: HTMLElement): Promise<Game> {
    await initPhysics();
    return new Game(canvas, uiContainer);
  }

  get eventBus(): EventBus<GameEventMap> {
    return this.events;
  }

  setGraphicsProfile(profile: GraphicsProfile): void {
    this.graphicsProfile = profile;
    this.sceneManager.applyGraphicsProfile(profile);
    this.effects.applyGraphicsProfile(profile);
  }

  startRace(options: RaceSetupOptions): void {
    const runtimeDef = getTrackRuntimeDefinition(options.trackId);
    this.sceneManager.setSkyPreset(getTrackSkyPresetId(options.trackId));
    this.track = buildTrack(runtimeDef, this.physicsWorld, this.sceneManager.scene);
    this.hud.setTrackCurve(this.track.curve);

    this.raceManager = new RaceManager(this.track, options.laps, this.events);
    this.powerUps = new PowerUpSystem(this.track, this.sceneManager.scene, this.effects, this.events);

    const vehicleDef = getVehicleById(options.vehicleId);
    const localController = new VehicleController(this.physicsWorld, vehicleDef, this.track.startGrid[0]!.position, this.track.startGrid[0]!.yawRad);
    const localView = new VehicleView(localController, options.colorwayId, this.effects);
    localView.addToScene(this.sceneManager.scene);
    this.views.set(this.localPlayerId, localView);
    this.collisionSystem.registerVehicle(this.localPlayerId, localController);
    this.raceManager.addRacer(this.localPlayerId, localController, false, 0);
    this.displayNames.set(this.localPlayerId, 'PLAYER');

    this.bots = [];
    for (let i = 0; i < options.botCount; i++) {
      const botId = `bot-${i}`;
      const botVehicle = getVehicleById(this.pickBotVehicleId(options.vehicleId, i));
      const startIndex = (i + 1) % this.track.startGrid.length;
      const start = this.track.startGrid[startIndex]!;
      const botController = new VehicleController(this.physicsWorld, botVehicle, start.position, start.yawRad);
      const botView = new VehicleView(botController, botVehicle.colorways[i % botVehicle.colorways.length]!, this.effects);
      botView.addToScene(this.sceneManager.scene);
      this.views.set(botId, botView);
      this.collisionSystem.registerVehicle(botId, botController);
      this.raceManager.addRacer(botId, botController, true, startIndex);
      this.displayNames.set(botId, BOT_NAMES[i % BOT_NAMES.length]!);
      this.bots.push({ ai: new AIController(this.track, options.aiDifficulty), playerId: botId });
    }

    this.sceneManager.chaseCamera.snapToTarget({
      position: localController.getWorldPosition(),
      quaternion: localController.getWorldQuaternion(),
      forwardSpeedMs: 0,
      topSpeedMs: vehicleDef.physics.topSpeed,
      isDrifting: false,
      isBoosting: false,
      isGrounded: true,
      airborneTimeSec: 0,
    });

    this.raceManager.startCountdown();
    this.hud.setVisible(true);
  }

  start(): void {
    const loop = (nowMs: number) => {
      this.rafHandle = requestAnimationFrame(loop);
      this.tick(nowMs);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  private pickBotVehicleId(excludeId: string, seed: number): string {
    const pool = ['toro', 'vortex', 'wave', 'fang', 'titan', 'spark', 'mirage', 'comet'].filter((id) => id !== excludeId);
    return pool[seed % pool.length]!;
  }

  private tick(nowMs: number): void {
    const deltaSec = this.clock.tick(nowMs);
    if (deltaSec <= 0) return;

    const localInput = this.inputManager.poll();
    const localRacer = this.raceManager.getRacer(this.localPlayerId);
    if (localRacer) localRacer.controller.setInput(localInput);

    const usePowerUpRequested = new Set<string>();
    if (localInput.usePowerUp && !this.lastUsePowerUpInput) usePowerUpRequested.add(this.localPlayerId);
    this.lastUsePowerUpInput = localInput.usePowerUp;

    for (const bot of this.bots) {
      const racer = this.raceManager.getRacer(bot.playerId);
      if (!racer || racer.finished) continue;
      const obstacles = this.raceManager
        .getAllRacers()
        .filter((r) => r.playerId !== bot.playerId)
        .map((r) => ({ position: r.controller.getWorldPosition(), radius: 1.2 }));
      const hasHeld = this.powerUps.getHeldWeapon(bot.playerId) !== null;
      const decision = bot.ai.update(deltaSec, racer, obstacles, hasHeld);
      racer.controller.setInput(decision.input);
      if (decision.usePowerUp) usePowerUpRequested.add(bot.playerId);
    }

    this.physicsWorld.step(deltaSec, (stepSec) => {
      for (const racer of this.raceManager.getAllRacers()) racer.controller.applyForces(stepSec);
    });

    const impacts = this.collisionSystem.drain(this.physicsWorld);
    for (const impact of impacts) {
      this.effects.emitImpactBurst(impact.worldPoint, impact.strength);
      const racer = this.raceManager.getRacer(impact.playerId);
      if (racer) this.raceManager.registerCollision(racer);
      if (impact.playerId === this.localPlayerId) {
        this.sceneManager.chaseCamera.addImpactShake(impact.strength);
      }
    }

    this.raceManager.update(deltaSec);
    if (this.raceManager.phase === 'racing') {
      this.powerUps.update(deltaSec, this.raceManager.getAllRacers(), usePowerUpRequested);
    }

    for (const view of this.views.values()) view.update(deltaSec);
    this.effects.update(deltaSec);

    const localController = localRacer?.controller;
    if (localController) {
      this.sceneManager.chaseCamera.update(deltaSec, {
        position: localController.getWorldPosition(),
        quaternion: localController.getWorldQuaternion(),
        forwardSpeedMs: localController.state.forwardSpeedMs,
        topSpeedMs: localController.definition.physics.topSpeed,
        isDrifting: localController.state.isDrifting,
        isBoosting: localController.state.isBoosting,
        isGrounded: localController.state.isGrounded,
        airborneTimeSec: localController.state.airborneTimeSec,
      });
      this.sceneManager.gameRenderer.setBoostBloomStrength(localController.state.isBoosting ? 1 : 0);
    }

    this.sceneManager.update(deltaSec);
    this.sceneManager.render();

    this.updateHud();
  }

  private updateHud(): void {
    this.hud.showCountdown(this.raceManager.phase === 'countdown' ? this.raceManager.countdownValue : null);
    const localRacer = this.raceManager.getRacer(this.localPlayerId);
    if (!localRacer) return;

    const allRacers = this.raceManager.getAllRacers().slice().sort((a, b) => a.position - b.position);
    const standings = allRacers.map((r) => ({
      playerId: r.playerId,
      displayName: this.displayNames.get(r.playerId) ?? r.playerId,
      colorHex: RACER_COLORS[Array.from(this.views.keys()).indexOf(r.playerId) % RACER_COLORS.length]!,
      position: r.position,
    }));

    const minimapMarkers = allRacers.map((r) => {
      const pos = r.controller.getWorldPosition();
      return {
        id: r.playerId,
        x: pos.x,
        z: pos.z,
        color: RACER_COLORS[Array.from(this.views.keys()).indexOf(r.playerId) % RACER_COLORS.length]!,
        isLocalPlayer: r.playerId === this.localPlayerId,
      };
    });

    this.hud.update({
      localPlayerId: this.localPlayerId,
      position: localRacer.position,
      totalRacers: allRacers.length,
      lap: localRacer.lap,
      totalLaps: this.raceManager.totalLaps,
      raceTimeMs: localRacer.totalTimeMs,
      speedKmh: localRacer.controller.state.speedKmh,
      boostCharge: localRacer.controller.state.boostCharge,
      driftLevel: localRacer.controller.state.driftLevel,
      heldWeapon: this.powerUps?.getHeldWeapon(this.localPlayerId) ?? null,
      standings,
      minimapMarkers,
      wrongWay: localRacer.wrongWaySec > RACE_BALANCE.wrongWay.warnAfterSec,
    });
  }

  dispose(): void {
    this.stop();
    this.inputManager.dispose();
    this.sceneManager.dispose();
    this.physicsWorld.destroy();
    this.hud.dispose();
  }
}
