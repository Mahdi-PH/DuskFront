export interface RaceBalance {
  maxPlayers: number;
  minHumanPlayersBeforeBotFill: number;
  botFillDelaySec: number;
  countdown: { steps: number[]; goDisplaySec: number };
  respawn: {
    offTrackGraceSec: number;
    invulnerabilitySec: number;
    flipDetectionAngleDeg: number;
    flipTimeoutSec: number;
    stuckSpeedThreshold: number;
    stuckTimeoutSec: number;
  };
  rubberBanding: {
    enabled: boolean;
    maxCatchupSpeedBonus: number;
    maxLeaderSpeedPenalty: number;
    applyRange: [number, number];
    note: string;
  };
  wrongWay: { warnAfterSec: number; forceCorrectAfterSec: number };
  reconnectWindowSec: number;
  disconnectBotTakeoverDelaySec: number;
  networkTickRateHz: number;
  clientInterpolationDelayMs: number;
}

export type RaceMode = 'quick' | 'ranked' | 'private' | 'training';

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'expert';

export interface RaceResultEntry {
  playerId: string;
  displayName: string;
  position: number;
  totalTimeMs: number;
  bestLapMs: number;
  driftDistanceMeters: number;
  powerUpsUsed: number;
  xpEarned: number;
  coinsEarned: number;
  isBot: boolean;
}
