export type VehicleUnlockCondition =
  | { type: 'default' }
  | { type: 'level'; level: number }
  | { type: 'coins'; amount: number };

export interface VehiclePhysicsConfig {
  mass: number;
  topSpeed: number;
  reverseSpeed: number;
  acceleration: number;
  braking: number;
  steerAngleDeg: number;
  steerSpeedFactor: number;
  gripBase: number;
  driftGripFactor: number;
  driftTriggerAngleDeg: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionRestLength: number;
  airControl: number;
  collisionResistance: number;
  boostForce: number;
  boostDuration: number;
}

export interface VehicleStats {
  speed: number;
  acceleration: number;
  handling: number;
  drift: number;
  boost: number;
  durability: number;
}

export interface VehicleDefinition {
  id: string;
  name: string;
  tagline: string;
  silhouette: string;
  unlock: VehicleUnlockCondition;
  physics: VehiclePhysicsConfig;
  stats: VehicleStats;
  colorways: string[];
}
