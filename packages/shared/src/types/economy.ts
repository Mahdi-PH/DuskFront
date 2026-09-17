export interface DailyMissionDefinition {
  id: string;
  descriptionKey: string;
  target: number;
  rewardCoins: number;
  rewardXp: number;
}

export interface EconomyBalance {
  coinsByPosition: number[];
  xpByPosition: number[];
  xpPerDriftPoint: number;
  xpPerPowerUpUsed: number;
  xpPerKmDriven: number;
  xpPerfectLapBonus: number;
  xpNoCollisionRaceBonus: number;
  level: { maxLevel: number; baseXp: number; growthFactor: number };
  dailyMissions: { countPerDay: number; rerollCostCoins: number; pool: DailyMissionDefinition[] };
  vehicleUnlockCoinCost: {
    'level-gated-vehicles-only': boolean;
    cosmeticSkinBaseCost: number;
    cosmeticSkinRareCost: number;
  };
  payToWin: boolean;
}

export interface AchievementDefinition {
  id: string;
  nameKey: string;
  descKey: string;
  target: number;
  metric: string;
  rewardCoins: number;
}
