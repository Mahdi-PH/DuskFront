import { describe, it, expect } from 'vitest';
import {
  computeEngineForce,
  computeSteerAngleRad,
  computeDriftLevel,
  computeDriftBoostChargeRate,
  computeLateralGrip,
  computeCollisionImpulseFactor,
  speedMsToKmh,
  clamp,
  lerp,
} from '../../apps/client/src/vehicles/vehicleMath';
import { getVehicleById } from '@velocity-island/shared';

const toro = getVehicleById('toro');
const vortex = getVehicleById('vortex');

describe('vehicleMath', () => {
  it('converts m/s to km/h', () => {
    expect(speedMsToKmh(10)).toBeCloseTo(36, 5);
  });

  it('clamps and lerps correctly', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 2)).toBe(10);
  });

  it('produces zero engine force at top speed under full throttle', () => {
    const force = computeEngineForce(1, 0, toro.physics.topSpeed, toro.physics);
    expect(force).toBeCloseTo(0, 5);
  });

  it('produces maximum engine force from a standstill', () => {
    const force = computeEngineForce(1, 0, 0, toro.physics);
    expect(force).toBeCloseTo(toro.physics.acceleration * toro.physics.mass, 5);
  });

  it('braking produces a negative force while moving forward', () => {
    const force = computeEngineForce(0, 1, 20, toro.physics);
    expect(force).toBeLessThan(0);
  });

  it('reduces steering authority as speed approaches top speed', () => {
    const lowSpeed = computeSteerAngleRad(1, 0, vortex.physics);
    const highSpeed = computeSteerAngleRad(1, vortex.physics.topSpeed, vortex.physics);
    expect(Math.abs(highSpeed)).toBeLessThan(Math.abs(lowSpeed));
  });

  it('drift level escalates from none to ultra over time', () => {
    expect(computeDriftLevel(0)).toBe(0);
    expect(computeDriftLevel(0.5)).toBe(1);
    expect(computeDriftLevel(1.5)).toBe(2);
    expect(computeDriftLevel(3)).toBe(3);
  });

  it('boost charge rate increases with drift level', () => {
    expect(computeDriftBoostChargeRate(0)).toBe(0);
    expect(computeDriftBoostChargeRate(1)).toBeLessThan(computeDriftBoostChargeRate(2));
    expect(computeDriftBoostChargeRate(2)).toBeLessThan(computeDriftBoostChargeRate(3));
  });

  it('lateral grip drops while drifting', () => {
    const normalGrip = computeLateralGrip(false, toro.physics);
    const driftGrip = computeLateralGrip(true, toro.physics);
    expect(driftGrip).toBeLessThan(normalGrip);
  });

  it('heavier / tankier vehicles absorb more collision impulse', () => {
    const titan = getVehicleById('titan');
    const comet = getVehicleById('comet');
    expect(computeCollisionImpulseFactor(titan.physics)).toBeLessThan(computeCollisionImpulseFactor(comet.physics));
  });
});
