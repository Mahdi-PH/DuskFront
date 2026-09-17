import { Client, Room, getStateCallbacks } from 'colyseus.js';
import type { AIDifficulty } from '@velocity-island/shared';

export interface RemotePlayerSnapshot {
  sessionId: string;
  userId: string;
  displayName: string;
  vehicleId: string;
  colorwayId: string;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  rotY: number;
  speedKmh: number;
  lap: number;
  checkpointIndex: number;
  position: number;
  finished: boolean;
  finishTimeMs: number;
  connected: boolean;
}

export interface RaceRoomSnapshot {
  trackId: string;
  mode: string;
  totalLaps: number;
  phase: 'lobby' | 'countdown' | 'racing' | 'finished';
  countdownValue: number;
  serverTimeMs: number;
  players: Map<string, RemotePlayerSnapshot>;
}

export interface JoinRaceOptions {
  accessToken: string;
  vehicleId: string;
  displayName: string;
  colorwayId: string;
  trackId: string;
  mode: 'quick' | 'ranked' | 'private';
  laps?: number;
  botCount?: number;
  aiDifficulty?: AIDifficulty;
  roomCode?: string;
}

function getServerWsUrl(): string {
  return (import.meta.env.VITE_SERVER_WS_URL as string | undefined) ?? 'ws://localhost:2567';
}

/** Thin wrapper around colyseus.js: joins/creates the authoritative RaceRoom, exposes a
 * plain snapshot of room state (decoded via Colyseus's schema reflection, so the client
 * never needs to import the server's schema classes), and forwards checkpoint/telemetry
 * reports. Reconnection uses the room's reconnectionToken per Colyseus's standard
 * disconnect/reconnect flow, matching the reconnection-window requirement. */
export class ColyseusClient {
  private readonly client = new Client(getServerWsUrl());
  private room: Room | null = null;
  private reconnectionToken: string | null = null;
  private snapshotListeners = new Set<(snapshot: RaceRoomSnapshot) => void>();
  private latestSnapshot: RaceRoomSnapshot = {
    trackId: '',
    mode: 'quick',
    totalLaps: 3,
    phase: 'lobby',
    countdownValue: 0,
    serverTimeMs: 0,
    players: new Map(),
  };

  async joinOrCreate(options: JoinRaceOptions): Promise<void> {
    this.room = await this.client.joinOrCreate('race', options);
    this.reconnectionToken = this.room.reconnectionToken;
    this.wireRoom(this.room);
  }

  async joinById(roomId: string, options: JoinRaceOptions): Promise<void> {
    this.room = await this.client.joinById(roomId, options);
    this.reconnectionToken = this.room.reconnectionToken;
    this.wireRoom(this.room);
  }

  async reconnect(): Promise<boolean> {
    if (!this.reconnectionToken) return false;
    try {
      this.room = await this.client.reconnect(this.reconnectionToken);
      this.wireRoom(this.room);
      return true;
    } catch {
      return false;
    }
  }

  private wireRoom(room: Room): void {
    const $ = getStateCallbacks(room);
    const state = room.state as unknown as {
      trackId: string;
      mode: string;
      totalLaps: number;
      phase: RaceRoomSnapshot['phase'];
      countdownValue: number;
      serverTimeMs: number;
      players: Map<string, RemotePlayerSnapshot>;
    };

    const syncScalarFields = () => {
      this.latestSnapshot = {
        ...this.latestSnapshot,
        trackId: state.trackId,
        mode: state.mode,
        totalLaps: state.totalLaps,
        phase: state.phase,
        countdownValue: state.countdownValue,
        serverTimeMs: state.serverTimeMs,
      };
      this.emitSnapshot();
    };

    $(state).onChange(syncScalarFields);
    $(state).players.onAdd((player: RemotePlayerSnapshot, sessionId: string) => {
      this.latestSnapshot.players.set(sessionId, { ...player });
      $(player).onChange(() => {
        this.latestSnapshot.players.set(sessionId, { ...player });
        this.emitSnapshot();
      });
      this.emitSnapshot();
    });
    $(state).players.onRemove((_player: RemotePlayerSnapshot, sessionId: string) => {
      this.latestSnapshot.players.delete(sessionId);
      this.emitSnapshot();
    });
  }

  private emitSnapshot(): void {
    for (const listener of this.snapshotListeners) listener(this.latestSnapshot);
  }

  onSnapshot(listener: (snapshot: RaceRoomSnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  sendReady(): void {
    this.room?.send('ready');
  }

  sendCheckpoint(checkpointIndex: number, position: { x: number; y: number; z: number }, speedKmh: number): void {
    this.room?.send('checkpoint', { checkpointIndex, ...position, speedKmh, atMs: Date.now() });
  }

  /** High-frequency (throttled by the caller) position relay so remote clients can
   * render a smoothly-moving ghost for this player — see RaceRoom.handlePositionReport. */
  sendPosition(position: { x: number; y: number; z: number }, rotY: number, speedKmh: number): void {
    this.room?.send('position', { ...position, rotY, speedKmh, atMs: Date.now() });
  }

  sendTelemetry(delta: { driftDeltaMeters?: number; powerUpUsedDelta?: number; collisionDelta?: number }): void {
    this.room?.send('telemetry', delta);
  }

  leave(consented = true): void {
    void this.room?.leave(consented);
    this.room = null;
  }
}
