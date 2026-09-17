import type { WeaponId } from './weapon.js';

export interface PositionBand {
  positionRange: [number, number];
  weights: Record<WeaponId, number>;
}

export interface PowerUpBalance {
  crates: {
    respawnSec: number;
    pickupRadius: number;
    inventorySlots: number;
  };
  rarityByPositionBand: Record<string, PositionBand>;
  antiFrustration: {
    enabled: boolean;
    maxOutcomeShiftPositions: number;
    description: string;
  };
}
