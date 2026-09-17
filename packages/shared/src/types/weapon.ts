export type WeaponId =
  | 'fireball'
  | 'shockwave'
  | 'turbo'
  | 'shield'
  | 'magnet'
  | 'oilTrap'
  | 'emp'
  | 'rocket'
  | 'phantom';

export type WeaponCategory = 'offensive' | 'defensive' | 'utility' | 'trap';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  category: WeaponCategory;
  targeting: string;
  cooldownSec: number;
  [key: string]: unknown;
}
