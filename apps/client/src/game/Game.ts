import type { AIDifficulty } from '@velocity-island/shared';
import { getVehicleById, RACE_BALANCE, ECONOMY_BALANCE } from '@velocity-island/shared';
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
import { RaceManager, type RacerRuntime } from './RaceManager';
import { PowerUpSystem } from '../powerups/PowerUpSystem';
import { AIController } from '../ai/AIController';
import { InputManager } from '../input/InputManager';
import { TouchControls } from '../input/TouchControls';
import { RaceHUD } from '../ui/RaceHUD';
import type { GameEventMap } from './GameEvents';
import { localProfileStore } from './LocalProfileStore';
import type { RaceResultsData } from '../ui/screens/ResultsScreen';
import type { LocalSettings } from './LocalProfileStore';
import { AudioDirector } from '../audio/AudioDirector';
import { ColyseusClient, type JoinRaceOptions, type RaceRoomSnapshot } from '../network/ColyseusClient';
import { RemoteGhostView } from '../network/RemoteGhostView';

const BOT_NAMES = ['ZENITH', 'ROCKET', 'BLAZE', 'VORTEX', 'PIXEL', 'SHADOW', 'NOVA'];
const RACER_COLORS = ['#2fd9c9', '#ff5c6c', '#ff7a3d', '#1e6fb8', '#2fb872', '#faf6ee', '#9d7bff', '#38e0ff'];

export interface RaceSetupOptions {
  trackId: string;
  vehicleId: string;
  colorwayId: string;
  laps: number;
  botCount: number;
  aiDifficulty: AIDifficulty;
  /** When set, the race is also joined online (see enableOnlineMode) after local
   * setup completes — 'quick'/'ranked' matchmake via Colyseus filterBy, 'private'
   * joins a specific room by id (see AppShell's lobby create/join-by-code flow). */
  online?: { mode: 'quick' | 'ranked' | 'private'; roomId?: string };
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
  private lastPauseInput = false;
  private displayNames = new Map<string, string>();
  private paused = false;
  private raceFinishReported = false;
  private localDriftCount = 0;
  private wasLocalDrifting = false;
  private localDistanceMeters = 0;
  private readonly audioDirector: AudioDirector;
  private wasLocalBraking = false;
  private colyseusClient: ColyseusClient | null = null;
  private remoteGhosts = new Map<string, RemoteGhostView>();
  private latestNetworkSnapshot: RaceRoomSnapshot | null = null;
  private positionReportAccumSec = 0;
  private unsubscribeNetworkCheckpoint: (() => void) | null = null;

  onRaceFinished: ((results: RaceResultsData) => void) | null = null;
  onPauseToggled: ((paused: boolean) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, uiContainer: HTMLElement) {
    this.graphicsProfile = GRAPHICS_PROFILES[detectDefaultQuality()];
    this.sceneManager = new SceneManager(canvas, this.graphicsProfile, 'sunset');
    this.physicsWorld = new PhysicsWorld();
    this.effects = new EffectsManager(this.sceneManager.scene, this.graphicsProfile);
    this.touchControls = new TouchControls(uiContainer);
    this.touchControls.subscribe((state) => this.inputManager.setTouchState(state));
    this.hud = new RaceHUD(uiContainer);
    this.audioDirector = new AudioDirector(this.events);
    this.applySettings(localProfileStore.get().settings);
  }

  applySettings(settings: LocalSettings): void {
    this.inputManager.setAutoAccelerate(settings.autoAccelerate);
    this.sceneManager.chaseCamera.setAccessibility(settings.reducedMotion || !settings.cameraShakeEnabled);
    this.setGraphicsProfile(GRAPHICS_PROFILES[settings.graphicsQuality]);
    this.audioDirector.applySettings(settings);
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
    void this.audioDirector.ensureStarted(localProfileStore.get().settings);

    const vehicleDef = getVehicleById(options.vehicleId);
    const localController = new VehicleController(this.physicsWorld, vehicleDef, this.track.startGrid[0]!.position, this.track.startGrid[0]!.yawRad);
    const localView = new VehicleView(localController, options.colorwayId, this.effects);
    localView.addToScene(this.sceneManager.scene);
    this.views.set(this.localPlayerId, localView);
    this.collisionSystem.registerVehicle(this.localPlayerId, localController);
    this.raceManager.addRacer(this.localPlayerId, localController, false, 0);
    this.displayNames.set(this.localPlayerId, 'PLAYER');
    this.audioDirector.registerVehicle(this.localPlayerId, vehicleDef);

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
      this.audioDirector.registerVehicle(botId, botVehicle);
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

  /** Joins the authoritative Colyseus room for this race. Call after startRace() so
   * local checkpoint events are already flowing. The local player keeps driving on its
   * own client-side physics (see RaceRoom's scope note); this just reports checkpoint
   * crossings + a throttled position feed to the server and renders other real
   * players as position-interpolated ghosts (see RemoteGhostView). */
  async enableOnlineMode(joinOptions: JoinRaceOptions): Promise<void> {
    this.colyseusClient = new ColyseusClient();
    await this.colyseusClient.joinOrCreate(joinOptions);
    this.wireOnlineSession();
  }

  /** Used for private lobbies joined via a room code (see AppShell's /lobby/join REST
   * call, which resolves a code to a roomId). */
  async joinOnlineRoomById(roomId: string, joinOptions: JoinRaceOptions): Promise<void> {
    this.colyseusClient = new ColyseusClient();
    await this.colyseusClient.joinById(roomId, joinOptions);
    this.wireOnlineSession();
  }

  private wireOnlineSession(): void {
    if (!this.colyseusClient) return;
    this.colyseusClient.sendReady();

    this.colyseusClient.onSnapshot((snapshot) => {
      this.latestNetworkSnapshot = snapshot;
      this.syncRemoteGhosts(snapshot);
    });

    this.unsubscribeNetworkCheckpoint = this.events.on('checkpointPassed', ({ playerId, checkpointIndex }) => {
      if (playerId !== this.localPlayerId || !this.colyseusClient) return;
      const racer = this.raceManager.getRacer(this.localPlayerId);
      if (!racer) return;
      const pos = racer.controller.getWorldPosition();
      this.colyseusClient.sendCheckpoint(checkpointIndex, { x: pos.x, y: pos.y, z: pos.z }, racer.controller.state.speedKmh);
    });
  }

  private syncRemoteGhosts(snapshot: RaceRoomSnapshot): void {
    if (!this.colyseusClient) return;
    const mySessionId = this.colyseusClient.sessionId;

    for (const [sessionId, player] of snapshot.players) {
      if (sessionId === mySessionId || player.isBot) continue; // no real position feed for server-side bots (see RaceRoom)
      let ghost = this.remoteGhosts.get(sessionId);
      if (!ghost) {
        ghost = new RemoteGhostView(player.vehicleId, player.colorwayId);
        ghost.addToScene(this.sceneManager.scene);
        this.remoteGhosts.set(sessionId, ghost);
      }
      ghost.setTarget({ x: player.x, y: player.y, z: player.z }, player.rotY);
    }

    for (const [sessionId, ghost] of this.remoteGhosts) {
      if (!snapshot.players.has(sessionId)) {
        ghost.removeFromScene(this.sceneManager.scene);
        this.remoteGhosts.delete(sessionId);
      }
    }
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

  resumeFromPause(): void {
    this.paused = false;
  }

  isPaused(): boolean {
    return this.paused;
  }

  resetTouchLayout(): void {
    this.touchControls.resetLayout();
  }

  setTouchEditMode(enabled: boolean): void {
    this.touchControls.setEditMode(enabled);
  }

  private pickBotVehicleId(excludeId: string, seed: number): string {
    const pool = ['toro', 'vortex', 'wave', 'fang', 'titan', 'spark', 'mirage', 'comet'].filter((id) => id !== excludeId);
    return pool[seed % pool.length]!;
  }

  private tick(nowMs: number): void {
    const deltaSec = this.clock.tick(nowMs);
    if (deltaSec <= 0) return;

    const localInput = this.inputManager.poll();
    if (localInput.pause && !this.lastPauseInput) {
      this.paused = !this.paused;
      this.onPauseToggled?.(this.paused);
    }
    this.lastPauseInput = localInput.pause;
    if (this.paused) return;

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
      this.events.emit('vehicleCollision', {
        playerId: impact.playerId,
        strength: impact.strength,
        worldPoint: [impact.worldPoint.x, impact.worldPoint.y, impact.worldPoint.z],
      });
      if (impact.playerId === this.localPlayerId) {
        this.sceneManager.chaseCamera.addImpactShake(impact.strength);
      }
    }

    this.raceManager.update(deltaSec);
    if (this.raceManager.phase === 'racing') {
      this.powerUps.update(deltaSec, this.raceManager.getAllRacers(), usePowerUpRequested);
    }

    if (localRacer && this.raceManager.phase === 'racing') {
      this.localDistanceMeters += Math.abs(localRacer.controller.state.forwardSpeedMs) * deltaSec;
      const isDrifting = localRacer.controller.state.isDrifting;
      if (this.wasLocalDrifting && !isDrifting) this.localDriftCount += 1;
      this.wasLocalDrifting = isDrifting;

      const isBraking = localInput.brake > 0.5 && localRacer.controller.state.isGrounded;
      if (isBraking && !this.wasLocalBraking) this.audioDirector.brake();
      this.wasLocalBraking = isBraking;
    }

    for (const racer of this.raceManager.getAllRacers()) {
      if (racer.controller.state.isBoosting && racer.controller.state.boostTimeRemainingSec > racer.controller.definition.physics.boostDuration - 0.05) {
        this.events.emit('boostActivated', { playerId: racer.playerId });
      }
      const speedRatio = Math.abs(racer.controller.state.forwardSpeedMs) / racer.controller.definition.physics.topSpeed;
      const distanceAttenuation =
        racer.playerId === this.localPlayerId
          ? 1
          : Math.max(0, 1 - racer.controller.getWorldPosition().distanceTo(localRacer?.controller.getWorldPosition() ?? racer.controller.getWorldPosition()) / 40);
      this.audioDirector.updateVehicle(
        racer.playerId,
        speedRatio,
        racer.controller.state.isGrounded ? Math.max(0.15, speedRatio) : 0.1,
        racer.controller.state.isBoosting,
        distanceAttenuation,
      );
    }

    if (localRacer?.finished && !this.raceFinishReported) {
      this.raceFinishReported = true;
      this.reportRaceResults(localRacer);
    }

    for (const view of this.views.values()) view.update(deltaSec);
    this.effects.update(deltaSec);

    if (this.colyseusClient && localRacer && this.raceManager.phase === 'racing') {
      this.positionReportAccumSec += deltaSec;
      if (this.positionReportAccumSec >= 0.1) {
        this.positionReportAccumSec = 0;
        const pos = localRacer.controller.getWorldPosition();
        const quat = localRacer.controller.getWorldQuaternion();
        const yaw = Math.atan2(
          2 * (quat.w * quat.y + quat.x * quat.z),
          1 - 2 * (quat.y * quat.y + quat.z * quat.z),
        );
        this.colyseusClient.sendPosition({ x: pos.x, y: pos.y, z: pos.z }, yaw, localRacer.controller.state.speedKmh);
      }
    }
    for (const ghost of this.remoteGhosts.values()) ghost.update(deltaSec);

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

    const snapshot = this.latestNetworkSnapshot;
    const mySessionId = this.colyseusClient?.sessionId ?? null;

    let standings: Array<{ playerId: string; displayName: string; colorHex: string; position: number }>;
    let minimapMarkers: Array<{ id: string; x: number; z: number; color: string; isLocalPlayer: boolean }>;
    let position = localRacer.position;
    let totalRacers = this.raceManager.getAllRacers().length;

    if (snapshot && mySessionId) {
      const entries = Array.from(snapshot.players.entries());
      standings = entries
        .map(([sessionId, p], i) => ({
          playerId: sessionId,
          displayName: sessionId === mySessionId ? (this.displayNames.get(this.localPlayerId) ?? p.displayName) : p.displayName,
          colorHex: RACER_COLORS[i % RACER_COLORS.length]!,
          position: p.position,
        }))
        .sort((a, b) => a.position - b.position);
      minimapMarkers = entries
        .filter(([sessionId, p]) => sessionId === mySessionId || !p.isBot)
        .map(([sessionId, p], i) => {
          const isLocal = sessionId === mySessionId;
          const pos = isLocal ? localRacer.controller.getWorldPosition() : { x: p.x, z: p.z };
          return { id: sessionId, x: pos.x, z: pos.z, color: RACER_COLORS[i % RACER_COLORS.length]!, isLocalPlayer: isLocal };
        });
      const myNetworkState = snapshot.players.get(mySessionId);
      if (myNetworkState) position = myNetworkState.position;
      totalRacers = snapshot.players.size;
    } else {
      const allRacers = this.raceManager.getAllRacers().slice().sort((a, b) => a.position - b.position);
      standings = allRacers.map((r) => ({
        playerId: r.playerId,
        displayName: this.displayNames.get(r.playerId) ?? r.playerId,
        colorHex: RACER_COLORS[Array.from(this.views.keys()).indexOf(r.playerId) % RACER_COLORS.length]!,
        position: r.position,
      }));
      minimapMarkers = allRacers.map((r) => {
        const pos = r.controller.getWorldPosition();
        return {
          id: r.playerId,
          x: pos.x,
          z: pos.z,
          color: RACER_COLORS[Array.from(this.views.keys()).indexOf(r.playerId) % RACER_COLORS.length]!,
          isLocalPlayer: r.playerId === this.localPlayerId,
        };
      });
    }

    this.hud.update({
      localPlayerId: snapshot && mySessionId ? mySessionId : this.localPlayerId,
      position,
      totalRacers,
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

  private reportRaceResults(localRacer: RacerRuntime): void {
    const position = localRacer.position;
    const totalRacers = this.raceManager.getAllRacers().length;
    const coinsBase = ECONOMY_BALANCE.coinsByPosition[position - 1] ?? 10;
    const xpBase = ECONOMY_BALANCE.xpByPosition[position - 1] ?? 10;
    const xpFromDrift = Math.round(localRacer.driftDistanceMeters * ECONOMY_BALANCE.xpPerDriftPoint);
    const xpFromPowerUps = localRacer.powerUpsUsedCount * ECONOMY_BALANCE.xpPerPowerUpUsed;
    const xpFromDistance = Math.round((this.localDistanceMeters / 1000) * ECONOMY_BALANCE.xpPerKmDriven);
    const noCollisionBonus = localRacer.collisionCount === 0 ? ECONOMY_BALANCE.xpNoCollisionRaceBonus : 0;
    const xpEarned = xpBase + xpFromDrift + xpFromPowerUps + xpFromDistance + noCollisionBonus;

    localProfileStore.applyRaceRewards(coinsBase, xpEarned);
    if (position === 1) localProfileStore.bumpMission('win-race', 1);
    if (position <= 3) localProfileStore.bumpMission('top3-finish', 1);
    if (localRacer.powerUpsUsedCount > 0) localProfileStore.bumpMission('use-powerups', localRacer.powerUpsUsedCount);
    if (this.localDriftCount > 0) localProfileStore.bumpMission('drift-count', this.localDriftCount);
    if (this.localDistanceMeters > 0) localProfileStore.bumpMission('drive-distance-km', this.localDistanceMeters / 1000);
    if (localRacer.collisionCount === 0) localProfileStore.bumpMission('finish-no-collision', 1);
    localProfileStore.recordRaceResult({
      won: position === 1,
      driftMeters: localRacer.driftDistanceMeters,
      kmDriven: this.localDistanceMeters / 1000,
      powerUpsUsed: localRacer.powerUpsUsedCount,
    });

    this.onRaceFinished?.({
      position,
      totalRacers,
      totalTimeMs: localRacer.totalTimeMs,
      laps: localRacer.lap,
      driftDistanceMeters: localRacer.driftDistanceMeters,
      powerUpsUsed: localRacer.powerUpsUsedCount,
      xpEarned,
      coinsEarned: coinsBase,
    });
  }

  dispose(): void {
    this.stop();
    this.unsubscribeNetworkCheckpoint?.();
    this.colyseusClient?.leave();
    for (const ghost of this.remoteGhosts.values()) ghost.removeFromScene(this.sceneManager.scene);
    this.remoteGhosts.clear();
    this.inputManager.dispose();
    this.sceneManager.dispose();
    this.physicsWorld.destroy();
    this.hud.dispose();
    this.audioDirector.dispose();
  }
}
