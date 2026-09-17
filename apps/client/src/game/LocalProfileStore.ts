import { ACHIEVEMENTS, ECONOMY_BALANCE, levelFromTotalXp, VEHICLES, type VehicleDefinition } from '@velocity-island/shared';

export interface LocalStats {
  racesCompleted: number;
  racesWon: number;
  totalDriftMeters: number;
  totalKmDriven: number;
  totalPowerUpsUsed: number;
}

export interface LocalProfile {
  displayName: string;
  totalXp: number;
  coins: number;
  selectedVehicleId: string;
  selectedColorwayId: string;
  unlockedVehicleIds: string[];
  settings: LocalSettings;
  dailyMissionProgress: Record<string, number>;
  dailyMissionDate: string;
  stats: LocalStats;
  unlockedAchievementIds: string[];
}

export interface LocalSettings {
  locale: 'ar' | 'en';
  graphicsQuality: 'low' | 'medium' | 'high' | 'ultra';
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShakeEnabled: boolean;
  reducedMotion: boolean;
  vibrationEnabled: boolean;
  autoAccelerate: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

const STORAGE_KEY = 'vi-profile-v1';

const DEFAULT_SETTINGS: LocalSettings = {
  locale: 'ar',
  graphicsQuality: 'medium',
  masterVolume: 0.8,
  musicVolume: 0.7,
  sfxVolume: 0.85,
  cameraShakeEnabled: true,
  reducedMotion: false,
  vibrationEnabled: true,
  autoAccelerate: false,
  colorBlindMode: 'none',
};

function defaultProfile(): LocalProfile {
  return {
    displayName: 'PLAYER',
    totalXp: 0,
    coins: 300,
    selectedVehicleId: 'wave',
    selectedColorwayId: 'ocean-blue',
    unlockedVehicleIds: VEHICLES.filter((v) => v.unlock.type === 'default').map((v) => v.id),
    settings: { ...DEFAULT_SETTINGS },
    dailyMissionProgress: {},
    dailyMissionDate: '',
    stats: { racesCompleted: 0, racesWon: 0, totalDriftMeters: 0, totalKmDriven: 0, totalPowerUpsUsed: 0 },
    unlockedAchievementIds: [],
  };
}

/** Server-authoritative persistence is the real target (see apps/server), but the game
 * must stay playable offline (guest/training/local single-player), so profile + settings
 * live in localStorage as the offline source of truth and get reconciled with the
 * account service once connected. */
export class LocalProfileStore {
  private profile: LocalProfile;

  constructor() {
    this.profile = this.load();
  }

  private load(): LocalProfile {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProfile();
      const parsed = JSON.parse(raw) as Partial<LocalProfile>;
      const defaults = defaultProfile();
      return {
        ...defaults,
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        stats: { ...defaults.stats, ...parsed.stats },
      };
    } catch {
      return defaultProfile();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // Private mode / storage disabled — progress just won't persist this session.
    }
  }

  get(): Readonly<LocalProfile> {
    return this.profile;
  }

  getLevelInfo() {
    return levelFromTotalXp(this.profile.totalXp);
  }

  isUnlocked(vehicle: VehicleDefinition): boolean {
    if (vehicle.unlock.type === 'default') return true;
    if (vehicle.unlock.type === 'level') return this.getLevelInfo().level >= vehicle.unlock.level;
    if (vehicle.unlock.type === 'coins') return this.profile.unlockedVehicleIds.includes(vehicle.id);
    return false;
  }

  selectVehicle(vehicleId: string, colorwayId: string): void {
    this.profile.selectedVehicleId = vehicleId;
    this.profile.selectedColorwayId = colorwayId;
    this.save();
  }

  updateSettings(patch: Partial<LocalSettings>): void {
    this.profile.settings = { ...this.profile.settings, ...patch };
    this.save();
  }

  /** Applies race rewards (coins/xp) and returns the resulting level-up info. */
  applyRaceRewards(coins: number, xp: number): { leveledUp: boolean; newLevel: number } {
    const before = this.getLevelInfo().level;
    this.profile.coins += coins;
    this.profile.totalXp += xp;
    this.save();
    const after = this.getLevelInfo().level;
    return { leveledUp: after > before, newLevel: after };
  }

  /** Records the stats a finished race contributes and unlocks any achievements that
   * just crossed their target, returning the newly-unlocked ids (e.g. for a toast) and
   * their coin rewards, which are added to the balance immediately. */
  recordRaceResult(delta: { won: boolean; driftMeters: number; kmDriven: number; powerUpsUsed: number }): string[] {
    this.profile.stats.racesCompleted += 1;
    if (delta.won) this.profile.stats.racesWon += 1;
    this.profile.stats.totalDriftMeters += delta.driftMeters;
    this.profile.stats.totalKmDriven += delta.kmDriven;
    this.profile.stats.totalPowerUpsUsed += delta.powerUpsUsed;

    const newlyUnlocked: string[] = [];
    const levelInfo = this.getLevelInfo();
    const metrics: Record<string, number> = {
      totalDriftMeters: this.profile.stats.totalDriftMeters,
      racesWon: this.profile.stats.racesWon,
      racesCompleted: this.profile.stats.racesCompleted,
      totalPowerUpsUsed: this.profile.stats.totalPowerUpsUsed,
      totalKmDriven: this.profile.stats.totalKmDriven,
      playerLevel: levelInfo.level,
      vehiclesUnlocked: this.profile.unlockedVehicleIds.length,
    };
    for (const achievement of ACHIEVEMENTS) {
      if (this.profile.unlockedAchievementIds.includes(achievement.id)) continue;
      const value = metrics[achievement.metric];
      if (value === undefined || value < achievement.target) continue;
      this.profile.unlockedAchievementIds.push(achievement.id);
      this.profile.coins += achievement.rewardCoins;
      newlyUnlocked.push(achievement.id);
    }

    this.save();
    return newlyUnlocked;
  }

  getAchievementsProgress(): Array<{ id: string; nameKey: string; descKey: string; target: number; progress: number; unlocked: boolean }> {
    const levelInfo = this.getLevelInfo();
    const metrics: Record<string, number> = {
      totalDriftMeters: this.profile.stats.totalDriftMeters,
      racesWon: this.profile.stats.racesWon,
      racesCompleted: this.profile.stats.racesCompleted,
      totalPowerUpsUsed: this.profile.stats.totalPowerUpsUsed,
      totalKmDriven: this.profile.stats.totalKmDriven,
      playerLevel: levelInfo.level,
      vehiclesUnlocked: this.profile.unlockedVehicleIds.length,
    };
    return ACHIEVEMENTS.map((achievement) => ({
      id: achievement.id,
      nameKey: achievement.nameKey,
      descKey: achievement.descKey,
      target: achievement.target,
      progress: Math.min(achievement.target, metrics[achievement.metric] ?? 0),
      unlocked: this.profile.unlockedAchievementIds.includes(achievement.id),
    }));
  }

  bumpMission(missionId: string, amount: number): void {
    this.rolloverMissionsIfNewDay();
    this.profile.dailyMissionProgress[missionId] = (this.profile.dailyMissionProgress[missionId] ?? 0) + amount;
    this.save();
  }

  private rolloverMissionsIfNewDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.profile.dailyMissionDate !== today) {
      this.profile.dailyMissionDate = today;
      this.profile.dailyMissionProgress = {};
    }
  }

  getTodaysMissions(): Array<{ id: string; descriptionKey: string; target: number; progress: number; rewardCoins: number; rewardXp: number }> {
    this.rolloverMissionsIfNewDay();
    const seedSource = this.profile.dailyMissionDate || '0';
    let seed = 0;
    for (const ch of seedSource) seed += ch.charCodeAt(0);
    const pool = ECONOMY_BALANCE.dailyMissions.pool;
    const picks: typeof pool = [];
    for (let i = 0; i < ECONOMY_BALANCE.dailyMissions.countPerDay; i++) {
      picks.push(pool[(seed + i * 7) % pool.length]!);
    }
    return picks.map((mission) => ({
      ...mission,
      progress: this.profile.dailyMissionProgress[mission.id] ?? 0,
    }));
  }
}

export const localProfileStore = new LocalProfileStore();
