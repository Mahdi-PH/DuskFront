/** Rapier interaction groups packed as (membership << 16 | filter). */
function group(membershipBits: number, filterBits: number): number {
  return (membershipBits << 16) | filterBits;
}

export const GROUP_TRACK = 1 << 0;
export const GROUP_VEHICLE = 1 << 1;
export const GROUP_PROJECTILE = 1 << 2;
export const GROUP_HAZARD = 1 << 3;
export const GROUP_PICKUP = 1 << 4;
export const GROUP_WHEEL_RAY = 1 << 5;

export const INTERACTION_TRACK = group(GROUP_TRACK, GROUP_VEHICLE | GROUP_PROJECTILE | GROUP_WHEEL_RAY);
export const INTERACTION_VEHICLE = group(
  GROUP_VEHICLE,
  GROUP_TRACK | GROUP_VEHICLE | GROUP_PROJECTILE | GROUP_HAZARD | GROUP_PICKUP,
);
export const INTERACTION_PROJECTILE = group(GROUP_PROJECTILE, GROUP_TRACK | GROUP_VEHICLE | GROUP_HAZARD);
export const INTERACTION_HAZARD = group(GROUP_HAZARD, GROUP_VEHICLE | GROUP_PROJECTILE);
export const INTERACTION_PICKUP = group(GROUP_PICKUP, GROUP_VEHICLE);
export const INTERACTION_WHEEL_RAY = group(GROUP_WHEEL_RAY, GROUP_TRACK);
