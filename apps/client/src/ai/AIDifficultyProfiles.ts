import type { AIDifficulty } from '@velocity-island/shared';

export interface AIDifficultyProfile {
  lookaheadMeters: number;
  steerGain: number;
  reactionDelaySec: number;
  mistakeChancePerSec: number;
  mistakeSteerNoise: number;
  driftAngleThresholdRad: number;
  driftSkill: number; // 0..1, chance to hold drift for a super/ultra tier instead of releasing early
  boostUseChance: number; // 0..1 per second while charge is available and path is clear
  powerUpReactionDelaySec: number;
  obstacleAvoidanceGain: number;
}

/** Difficulty differences come from decision quality (reaction time, mistake rate,
 * racing-line precision, drift/boost/power-up skill) rather than raw speed — an
 * "expert" bot drives the same car with the same top speed as an "easy" one. */
export const AI_DIFFICULTY_PROFILES: Record<AIDifficulty, AIDifficultyProfile> = {
  easy: {
    lookaheadMeters: 10,
    steerGain: 1.6,
    reactionDelaySec: 0.35,
    mistakeChancePerSec: 0.35,
    mistakeSteerNoise: 0.5,
    driftAngleThresholdRad: 0.55,
    driftSkill: 0.15,
    boostUseChance: 0.15,
    powerUpReactionDelaySec: 1.2,
    obstacleAvoidanceGain: 0.5,
  },
  normal: {
    lookaheadMeters: 14,
    steerGain: 2.0,
    reactionDelaySec: 0.22,
    mistakeChancePerSec: 0.15,
    mistakeSteerNoise: 0.3,
    driftAngleThresholdRad: 0.4,
    driftSkill: 0.45,
    boostUseChance: 0.35,
    powerUpReactionDelaySec: 0.7,
    obstacleAvoidanceGain: 0.75,
  },
  hard: {
    lookaheadMeters: 18,
    steerGain: 2.4,
    reactionDelaySec: 0.12,
    mistakeChancePerSec: 0.05,
    mistakeSteerNoise: 0.15,
    driftAngleThresholdRad: 0.3,
    driftSkill: 0.75,
    boostUseChance: 0.55,
    powerUpReactionDelaySec: 0.35,
    obstacleAvoidanceGain: 1.0,
  },
  expert: {
    lookaheadMeters: 22,
    steerGain: 2.8,
    reactionDelaySec: 0.05,
    mistakeChancePerSec: 0.01,
    mistakeSteerNoise: 0.06,
    driftAngleThresholdRad: 0.22,
    driftSkill: 0.95,
    boostUseChance: 0.75,
    powerUpReactionDelaySec: 0.15,
    obstacleAvoidanceGain: 1.2,
  },
};
