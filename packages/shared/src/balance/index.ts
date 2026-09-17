import vehiclesJson from './vehicles.json' with { type: 'json' };
import weaponsJson from './weapons.json' with { type: 'json' };
import powerupsJson from './powerups.json' with { type: 'json' };
import tracksJson from './tracks.json' with { type: 'json' };
import racesJson from './races.json' with { type: 'json' };
import economyJson from './economy.json' with { type: 'json' };
import achievementsJson from './achievements.json' with { type: 'json' };

import type { VehicleDefinition } from '../types/vehicle.js';
import type { WeaponDefinition } from '../types/weapon.js';
import type { PowerUpBalance } from '../types/powerup.js';
import type { TrackDefinition } from '../types/track.js';
import type { RaceBalance } from '../types/race.js';
import type { EconomyBalance, AchievementDefinition } from '../types/economy.js';

export const VEHICLES: VehicleDefinition[] = vehiclesJson.vehicles as VehicleDefinition[];
export const WEAPONS: WeaponDefinition[] = weaponsJson.weapons as WeaponDefinition[];
export const POWERUP_BALANCE: PowerUpBalance = powerupsJson as unknown as PowerUpBalance;
export const TRACKS: TrackDefinition[] = tracksJson.tracks as TrackDefinition[];
export const RACE_BALANCE: RaceBalance = racesJson as unknown as RaceBalance;
export const ECONOMY_BALANCE: EconomyBalance = economyJson as unknown as EconomyBalance;
export const ACHIEVEMENTS: AchievementDefinition[] = achievementsJson.achievements as AchievementDefinition[];

export function getVehicleById(id: string): VehicleDefinition {
  const vehicle = VEHICLES.find((v) => v.id === id);
  if (!vehicle) throw new Error(`Unknown vehicle id: ${id}`);
  return vehicle;
}

export function getWeaponById(id: string): WeaponDefinition {
  const weapon = WEAPONS.find((w) => w.id === id);
  if (!weapon) throw new Error(`Unknown weapon id: ${id}`);
  return weapon;
}

export function getTrackById(id: string): TrackDefinition {
  const track = TRACKS.find((t) => t.id === id);
  if (!track) throw new Error(`Unknown track id: ${id}`);
  return track;
}

export function xpRequiredForLevel(level: number): number {
  const { baseXp, growthFactor } = ECONOMY_BALANCE.level;
  return Math.round(baseXp * Math.pow(growthFactor, level - 1));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let lvl = 1; lvl < level; lvl++) total += xpRequiredForLevel(lvl);
  return total;
}

export function levelFromTotalXp(totalXp: number): { level: number; xpIntoLevel: number; xpForNextLevel: number } {
  let level = 1;
  let remaining = totalXp;
  while (level < ECONOMY_BALANCE.level.maxLevel) {
    const needed = xpRequiredForLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: xpRequiredForLevel(level) };
}
