import { describe, it, expect } from 'vitest';
import { CheckpointValidator } from '../../apps/server/src/antiCheat/CheckpointValidator';
import { InputValidator } from '../../apps/server/src/antiCheat/InputValidator';
import { getVehicleById } from '@velocity-island/shared';

describe('CheckpointValidator', () => {
  it('accepts checkpoints reported in strict sequential order', () => {
    const validator = new CheckpointValidator('sunset-bay', 'wave');
    // sunset-bay has 14 checkpoints; space reports far enough apart to clear the
    // minimum-time-between-checkpoints guard.
    let atMs = 0;
    for (let i = 0; i < 14; i++) {
      atMs += 5000;
      const result = validator.reportCheckpoint(i, atMs);
      expect(result.accepted).toBe(true);
      expect(result.lapCompleted).toBe(i === 13);
    }
    expect(validator.currentLap).toBe(1);
  });

  it('rejects a checkpoint that skips ahead out of order', () => {
    const validator = new CheckpointValidator('sunset-bay', 'wave');
    const first = validator.reportCheckpoint(0, 1000);
    const skipped = validator.reportCheckpoint(5, 6000); // should be 1, not 5
    expect(first.accepted).toBe(true);
    expect(skipped.accepted).toBe(false);
  });

  it('rejects a checkpoint that arrives faster than physically possible', () => {
    const validator = new CheckpointValidator('sunset-bay', 'wave');
    validator.reportCheckpoint(0, 1000);
    // Immediately reporting the next checkpoint 1ms later is impossible given the
    // track's segment length and the vehicle's top speed.
    const tooFast = validator.reportCheckpoint(1, 1001);
    expect(tooFast.accepted).toBe(false);
  });

  it('wraps lap count and resets expected index after completing a lap', () => {
    const validator = new CheckpointValidator('sunset-bay', 'wave');
    let atMs = 0;
    for (let i = 0; i < 14; i++) {
      atMs += 5000;
      validator.reportCheckpoint(i, atMs);
    }
    atMs += 5000;
    const secondLapFirstCheckpoint = validator.reportCheckpoint(0, atMs);
    expect(secondLapFirstCheckpoint.accepted).toBe(true);
  });
});

describe('InputValidator', () => {
  it('accepts plausible movement between samples', () => {
    const validator = new InputValidator(getVehicleById('wave'));
    validator.validateSample({ x: 0, y: 0, z: 0, atMs: 0 });
    // wave top speed is ~54 m/s; moving 10m in 1s (10 m/s) is well within bounds.
    const result = validator.validateSample({ x: 10, y: 0, z: 0, atMs: 1000 });
    expect(result).toBe(true);
    expect(validator.isFlaggedForReview).toBe(false);
  });

  it('flags a teleport-speed jump between samples', () => {
    const validator = new InputValidator(getVehicleById('wave'));
    validator.validateSample({ x: 0, y: 0, z: 0, atMs: 0 });
    // 5000m in 1s is far beyond any plausible top speed + boost margin.
    const result = validator.validateSample({ x: 5000, y: 0, z: 0, atMs: 1000 });
    expect(result).toBe(false);
  });

  it('accumulates flags and reports review status after repeated violations', () => {
    const validator = new InputValidator(getVehicleById('wave'));
    validator.validateSample({ x: 0, y: 0, z: 0, atMs: 0 });
    for (let i = 1; i <= 5; i++) {
      validator.validateSample({ x: 5000 * i, y: 0, z: 0, atMs: i * 1000 });
    }
    expect(validator.isFlaggedForReview).toBe(true);
  });
});
