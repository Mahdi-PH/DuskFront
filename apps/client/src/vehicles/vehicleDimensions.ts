/** Physical + visual dimensions per vehicle, shared between the physics controller
 * (collider size, wheel raycast anchors) and the procedural model builder, so the
 * hitbox always matches what's drawn on screen. All units in meters, body-local space
 * (+x right, +y up, +z forward). */
export interface VehicleDimensions {
  halfWidth: number;
  halfHeight: number;
  halfLength: number;
  wheelRadius: number;
  wheelWidth: number;
  /** Half distance between front and rear axles. */
  wheelBaseHalf: number;
  /** Half distance between left and right wheels. */
  trackHalf: number;
  rideHeight: number;
  cabinHeightScale: number;
  spoilerScale: number;
}

const DIMENSIONS: Record<string, VehicleDimensions> = {
  toro: { halfWidth: 1.0, halfHeight: 0.42, halfLength: 1.85, wheelRadius: 0.42, wheelWidth: 0.32, wheelBaseHalf: 1.35, trackHalf: 0.95, rideHeight: 0.34, cabinHeightScale: 1.1, spoilerScale: 0.8 },
  vortex: { halfWidth: 0.86, halfHeight: 0.3, halfLength: 1.95, wheelRadius: 0.34, wheelWidth: 0.26, wheelBaseHalf: 1.45, trackHalf: 0.82, rideHeight: 0.24, cabinHeightScale: 0.75, spoilerScale: 1.3 },
  wave: { halfWidth: 0.9, halfHeight: 0.34, halfLength: 1.8, wheelRadius: 0.36, wheelWidth: 0.28, wheelBaseHalf: 1.3, trackHalf: 0.86, rideHeight: 0.28, cabinHeightScale: 0.95, spoilerScale: 1.0 },
  fang: { halfWidth: 0.92, halfHeight: 0.32, halfLength: 1.75, wheelRadius: 0.36, wheelWidth: 0.3, wheelBaseHalf: 1.25, trackHalf: 0.9, rideHeight: 0.26, cabinHeightScale: 0.85, spoilerScale: 1.35 },
  titan: { halfWidth: 1.12, halfHeight: 0.5, halfLength: 2.05, wheelRadius: 0.48, wheelWidth: 0.36, wheelBaseHalf: 1.5, trackHalf: 1.05, rideHeight: 0.4, cabinHeightScale: 1.25, spoilerScale: 0.6 },
  spark: { halfWidth: 0.88, halfHeight: 0.3, halfLength: 1.82, wheelRadius: 0.34, wheelWidth: 0.27, wheelBaseHalf: 1.3, trackHalf: 0.84, rideHeight: 0.25, cabinHeightScale: 0.85, spoilerScale: 1.1 },
  mirage: { halfWidth: 0.84, halfHeight: 0.28, halfLength: 1.9, wheelRadius: 0.33, wheelWidth: 0.25, wheelBaseHalf: 1.4, trackHalf: 0.8, rideHeight: 0.22, cabinHeightScale: 0.7, spoilerScale: 0.9 },
  comet: { halfWidth: 0.87, halfHeight: 0.29, halfLength: 1.88, wheelRadius: 0.34, wheelWidth: 0.27, wheelBaseHalf: 1.38, trackHalf: 0.83, rideHeight: 0.23, cabinHeightScale: 0.78, spoilerScale: 1.4 },
  zephyr: { halfWidth: 0.82, halfHeight: 0.27, halfLength: 1.83, wheelRadius: 0.32, wheelWidth: 0.24, wheelBaseHalf: 1.32, trackHalf: 0.78, rideHeight: 0.21, cabinHeightScale: 0.68, spoilerScale: 0.85 },
  shadow: { halfWidth: 0.89, halfHeight: 0.29, halfLength: 1.92, wheelRadius: 0.35, wheelWidth: 0.28, wheelBaseHalf: 1.42, trackHalf: 0.85, rideHeight: 0.23, cabinHeightScale: 0.76, spoilerScale: 1.5 },
};

const DEFAULT_DIMENSIONS: VehicleDimensions = DIMENSIONS.wave!;

export function getVehicleDimensions(vehicleId: string): VehicleDimensions {
  return DIMENSIONS[vehicleId] ?? DEFAULT_DIMENSIONS;
}

export interface WheelAnchor {
  id: 'FL' | 'FR' | 'RL' | 'RR';
  x: number;
  y: number;
  z: number;
  isFront: boolean;
  isLeft: boolean;
}

export function getWheelAnchors(dims: VehicleDimensions): WheelAnchor[] {
  const y = -dims.halfHeight + 0.05;
  return [
    { id: 'FL', x: -dims.trackHalf, y, z: dims.wheelBaseHalf, isFront: true, isLeft: true },
    { id: 'FR', x: dims.trackHalf, y, z: dims.wheelBaseHalf, isFront: true, isLeft: false },
    { id: 'RL', x: -dims.trackHalf, y, z: -dims.wheelBaseHalf, isFront: false, isLeft: true },
    { id: 'RR', x: dims.trackHalf, y, z: -dims.wheelBaseHalf, isFront: false, isLeft: false },
  ];
}
