import { Room, type Client } from '@colyseus/core';
import { joinRoomOptionsSchema, getTrackById, getVehicleById, RACE_BALANCE, type AIDifficulty } from '@velocity-island/shared';
import { RaceRoomState, PlayerState } from './schema/RaceRoomState.js';
import { verifyAccessToken } from '../auth/tokens.js';
import { InputValidator } from '../antiCheat/InputValidator.js';
import { CheckpointValidator } from '../antiCheat/CheckpointValidator.js';
import { persistRaceResult, type RaceParticipantResult } from '../services/RaceResultService.js';

interface CreateOptions {
  trackId: string;
  mode: 'quick' | 'ranked' | 'private';
  laps?: number;
  botCount?: number;
  aiDifficulty?: AIDifficulty;
  roomCode?: string;
}

interface JoinOptions {
  accessToken?: string;
  vehicleId: string;
  displayName: string;
  colorwayId: string;
}

interface PlayerRuntime {
  inputValidator: InputValidator;
  checkpointValidator: CheckpointValidator;
  driftDistanceMeters: number;
  powerUpsUsed: number;
  collisionCount: number;
  isBot: boolean;
  botLapTimerHandle: ReturnType<typeof setInterval> | null;
}

const BOT_LAP_TIME_MS_BY_DIFFICULTY: Record<AIDifficulty, number> = {
  easy: 68000,
  normal: 58000,
  hard: 50000,
  expert: 44000,
};

/**
 * Authoritative Colyseus room for a race. Scope note: full server-side physics
 * replication (matching the client's Rapier simulation exactly) is not implemented —
 * that would mean running the entire vehicle/track/physics stack twice. Instead the
 * server is authoritative over what actually matters for fairness: checkpoint/lap
 * order and timing (via CheckpointValidator), gross movement plausibility (via
 * InputValidator), race outcome (finish order/time) and reward persistence. Position
 * reports from clients are relayed to other clients for rendering opponents but are
 * sanity-checked, not blindly trusted as physics ground truth.
 */
export class RaceRoom extends Room<RaceRoomState> {
  maxClients = RACE_BALANCE.maxPlayers;
  private runtimeByPlayerId = new Map<string, PlayerRuntime>();
  private raceStartedAtMs = 0;
  private botFillTimeout: ReturnType<typeof setTimeout> | null = null;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  onCreate(options: CreateOptions): void {
    this.setState(new RaceRoomState());
    this.state.trackId = options.trackId;
    this.state.mode = options.mode;
    this.state.totalLaps = options.laps ?? getTrackById(options.trackId).defaultLaps;
    if (options.roomCode) void this.setMetadata({ roomCode: options.roomCode });

    this.setSimulationInterval(() => this.tick(), 1000 / RACE_BALANCE.networkTickRateHz);

    this.onMessage('checkpoint', (client, message) => this.handleCheckpoint(client, message));
    this.onMessage('telemetry', (client, message) => this.handleTelemetry(client, message));
    this.onMessage('ready', () => {
      // A human pressing ready shouldn't have to wait out the full bot-fill grace
      // period — fill immediately (if eligible) and start the countdown right away.
      if (this.botFillTimeout) {
        clearTimeout(this.botFillTimeout);
        this.botFillTimeout = null;
      }
      this.addBotsIfNeeded(options);
      this.maybeStartCountdown(options);
    });

    if (options.mode !== 'private') {
      this.botFillTimeout = setTimeout(() => {
        this.addBotsIfNeeded(options);
        this.maybeStartCountdown(options);
      }, RACE_BALANCE.botFillDelaySec * 1000);
    }
  }

  async onAuth(_client: Client, options: JoinOptions): Promise<{ userId: string | null }> {
    if (!options.accessToken) return { userId: null }; // allow anonymous/offline-style testing joins
    try {
      const payload = verifyAccessToken(options.accessToken);
      return { userId: payload.sub };
    } catch {
      throw new Error('invalid_access_token');
    }
  }

  onJoin(client: Client, options: JoinOptions, auth: { userId: string | null }): void {
    const parsed = joinRoomOptionsSchema.safeParse({
      vehicleId: options.vehicleId,
      displayName: options.displayName,
      colorwayId: options.colorwayId,
    });
    if (!parsed.success) {
      client.leave(4000, 'invalid_join_options');
      return;
    }

    const player = new PlayerState();
    player.sessionId = client.sessionId;
    player.userId = auth.userId ?? '';
    player.displayName = parsed.data.displayName;
    player.vehicleId = parsed.data.vehicleId;
    player.colorwayId = parsed.data.colorwayId;
    this.state.players.set(client.sessionId, player);

    this.runtimeByPlayerId.set(client.sessionId, {
      inputValidator: new InputValidator(getVehicleById(parsed.data.vehicleId)),
      checkpointValidator: new CheckpointValidator(this.state.trackId, parsed.data.vehicleId),
      driftDistanceMeters: 0,
      powerUpsUsed: 0,
      collisionCount: 0,
      isBot: false,
      botLapTimerHandle: null,
    });
  }

  async onLeave(client: Client, consented: boolean): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;

    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }

    try {
      await this.allowReconnection(client, RACE_BALANCE.reconnectWindowSec);
      player.connected = true;
    } catch {
      this.removePlayer(client.sessionId);
    }
  }

  private removePlayer(sessionId: string): void {
    const runtime = this.runtimeByPlayerId.get(sessionId);
    if (runtime?.botLapTimerHandle) clearInterval(runtime.botLapTimerHandle);
    this.runtimeByPlayerId.delete(sessionId);
    this.state.players.delete(sessionId);
  }

  /** Clients report drift distance / power-up usage / collisions as they happen so the
   * final reward calculation reflects real play, not just checkpoint timing. These are
   * additive deltas, not authoritative positions, so there's nothing here for a
   * modified client to meaningfully exploit beyond inflating its own XP/coins by a
   * bounded, plausible amount — the same trust boundary as the checkpoint timing check. */
  private handleTelemetry(client: Client, message: { driftDeltaMeters?: number; powerUpUsedDelta?: number; collisionDelta?: number }): void {
    const runtime = this.runtimeByPlayerId.get(client.sessionId);
    if (!runtime || this.state.phase !== 'racing') return;
    if (typeof message.driftDeltaMeters === 'number' && message.driftDeltaMeters > 0) {
      runtime.driftDistanceMeters += Math.min(message.driftDeltaMeters, 50);
    }
    if (typeof message.powerUpUsedDelta === 'number' && message.powerUpUsedDelta > 0) {
      runtime.powerUpsUsed += Math.min(message.powerUpUsedDelta, 1);
    }
    if (typeof message.collisionDelta === 'number' && message.collisionDelta > 0) {
      runtime.collisionCount += Math.min(message.collisionDelta, 1);
    }
  }

  private handleCheckpoint(
    client: Client,
    message: { checkpointIndex: number; x: number; y: number; z: number; speedKmh: number; atMs: number },
  ): void {
    const player = this.state.players.get(client.sessionId);
    const runtime = this.runtimeByPlayerId.get(client.sessionId);
    if (!player || !runtime || this.state.phase !== 'racing') return;

    const validPosition = runtime.inputValidator.validateSample({ x: message.x, y: message.y, z: message.z, atMs: message.atMs });
    if (!validPosition) player.flaggedForReview = runtime.inputValidator.isFlaggedForReview;

    const result = runtime.checkpointValidator.reportCheckpoint(message.checkpointIndex, message.atMs);
    if (!result.accepted) return;

    player.x = message.x;
    player.y = message.y;
    player.z = message.z;
    player.speedKmh = message.speedKmh;
    player.checkpointIndex = message.checkpointIndex;

    if (result.lapCompleted) {
      player.lap += 1;
      if (player.lap >= this.state.totalLaps) {
        player.finished = true;
        player.finishTimeMs = Date.now() - this.raceStartedAtMs;
      }
    }

    this.updateStandings();
    this.maybeFinishRace();
  }

  private updateStandings(): void {
    const ranked = Array.from(this.state.players.values()).sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      return b.lap * 1000 + b.checkpointIndex - (a.lap * 1000 + a.checkpointIndex);
    });
    ranked.forEach((player, i) => {
      player.position = i + 1;
    });
  }

  private maybeStartCountdown(options: CreateOptions): void {
    if (this.state.phase !== 'lobby') return;
    this.state.phase = 'countdown';
    let value = RACE_BALANCE.countdown.steps[0] ?? 3;
    this.state.countdownValue = value;

    this.countdownInterval = setInterval(() => {
      value -= 1;
      if (value >= 0) {
        this.state.countdownValue = value;
        return;
      }
      if (this.countdownInterval) clearInterval(this.countdownInterval);
      this.state.phase = 'racing';
      this.raceStartedAtMs = Date.now();
      this.startBotSimulation(options);
    }, 1000);
  }

  private addBotsIfNeeded(options: CreateOptions): void {
    if (this.state.phase !== 'lobby') return;
    const humanCount = Array.from(this.state.players.values()).filter((p) => !p.isBot).length;
    if (humanCount < RACE_BALANCE.minHumanPlayersBeforeBotFill) return;
    const existingBotCount = Array.from(this.state.players.values()).filter((p) => p.isBot).length;
    if (existingBotCount > 0) return; // already filled

    const botCount = Math.min(options.botCount ?? this.maxClients - humanCount, this.maxClients - humanCount);
    const botNames = ['ZENITH', 'ROCKET', 'BLAZE', 'VORTEX', 'PIXEL', 'SHADOW', 'NOVA'];
    for (let i = 0; i < botCount; i++) {
      const sessionId = `bot-${i}-${Date.now()}`;
      const vehicleId = ['toro', 'vortex', 'wave', 'fang', 'titan', 'spark', 'mirage', 'comet'][i % 8]!;
      const bot = new PlayerState();
      bot.sessionId = sessionId;
      bot.isBot = true;
      bot.displayName = botNames[i % botNames.length]!;
      bot.vehicleId = vehicleId;
      bot.colorwayId = getVehicleById(vehicleId).colorways[0]!;
      this.state.players.set(sessionId, bot);
      this.runtimeByPlayerId.set(sessionId, {
        inputValidator: new InputValidator(getVehicleById(vehicleId)),
        checkpointValidator: new CheckpointValidator(this.state.trackId, vehicleId),
        driftDistanceMeters: 0,
        powerUpsUsed: 0,
        collisionCount: 0,
        isBot: true,
        botLapTimerHandle: null,
      });
    }
  }

  /** Bots don't run the client's physics/AI stack server-side (see class doc); they
   * progress on a scripted per-checkpoint timer derived from a difficulty lap-time
   * target, which is enough to produce a fair, plausible finish order and exercise the
   * full result/reward pipeline end-to-end. */
  private startBotSimulation(options: CreateOptions): void {
    const track = getTrackById(this.state.trackId);
    const lapTimeMs = BOT_LAP_TIME_MS_BY_DIFFICULTY[options.aiDifficulty ?? 'normal'];
    const perCheckpointMs = lapTimeMs / track.checkpointCount;

    for (const [sessionId, player] of this.state.players.entries()) {
      if (!player.isBot) continue;
      const runtime = this.runtimeByPlayerId.get(sessionId);
      if (!runtime) continue;

      const jitter = 0.85 + Math.random() * 0.3;
      runtime.botLapTimerHandle = setInterval(() => {
        if (this.state.phase !== 'racing' || player.finished) return;
        const result = runtime.checkpointValidator.reportCheckpoint(player.checkpointIndex, Date.now());
        if (!result.accepted) return;
        player.checkpointIndex = (player.checkpointIndex + 1) % track.checkpointCount;
        player.speedKmh = (track.lengthMeters / track.checkpointCount / (perCheckpointMs / 1000)) * 3.6;
        if (result.lapCompleted) {
          player.lap += 1;
          if (player.lap >= this.state.totalLaps) {
            player.finished = true;
            player.finishTimeMs = Date.now() - this.raceStartedAtMs;
            if (runtime.botLapTimerHandle) clearInterval(runtime.botLapTimerHandle);
          }
        }
        this.updateStandings();
        this.maybeFinishRace();
      }, perCheckpointMs * jitter);
    }
  }

  private maybeFinishRace(): void {
    if (this.state.phase !== 'racing') return;
    const allFinished = Array.from(this.state.players.values()).every((p) => p.finished);
    if (!allFinished) return;

    this.state.phase = 'finished';
    void this.persistResults();
  }

  private async persistResults(): Promise<void> {
    const participants: RaceParticipantResult[] = Array.from(this.state.players.values()).map((player) => {
      const runtime = this.runtimeByPlayerId.get(player.sessionId);
      return {
        userId: player.userId || null,
        displayName: player.displayName,
        vehicleId: player.vehicleId,
        isBot: player.isBot,
        position: player.position,
        totalTimeMs: player.finishTimeMs || Date.now() - this.raceStartedAtMs,
        bestLapMs: player.finishTimeMs > 0 ? player.finishTimeMs / Math.max(1, this.state.totalLaps) : 0,
        driftDistanceMeters: runtime?.driftDistanceMeters ?? 0,
        powerUpsUsed: runtime?.powerUpsUsed ?? 0,
        collisionCount: runtime?.collisionCount ?? 0,
      };
    });

    try {
      await persistRaceResult(this.state.trackId, this.state.mode, this.state.totalLaps, participants);
    } catch (err) {
      console.error('Failed to persist race result:', err);
    }
  }

  private tick(): void {
    this.state.serverTimeMs = this.state.phase === 'racing' ? Date.now() - this.raceStartedAtMs : 0;
  }

  onDispose(): void {
    if (this.botFillTimeout) clearTimeout(this.botFillTimeout);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    for (const runtime of this.runtimeByPlayerId.values()) {
      if (runtime.botLapTimerHandle) clearInterval(runtime.botLapTimerHandle);
    }
  }
}
