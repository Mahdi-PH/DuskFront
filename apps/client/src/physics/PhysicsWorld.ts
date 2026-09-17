import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_FIXED_TIMESTEP_SEC } from '@velocity-island/shared';
import { INTERACTION_TRACK } from './collisionGroups';

let initialized = false;

export async function initPhysics(): Promise<void> {
  if (initialized) return;
  await RAPIER.init();
  initialized = true;
}

/** Arcade gravity is stronger than real-world so jumps read as weighty rather than floaty. */
const ARCADE_GRAVITY_Y = -22;

export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;
  private accumulatorSec = 0;
  readonly fixedTimestepSec = PHYSICS_FIXED_TIMESTEP_SEC;

  constructor() {
    if (!initialized) {
      throw new Error('PhysicsWorld created before initPhysics() resolved');
    }
    this.world = new RAPIER.World({ x: 0, y: ARCADE_GRAVITY_Y, z: 0 });
    this.world.timestep = this.fixedTimestepSec;
    this.eventQueue = new RAPIER.EventQueue(false);
  }

  createTrackCollider(vertices: Float32Array, indices: Uint32Array): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setCollisionGroups(INTERACTION_TRACK)
      .setFriction(1.0)
      .setRestitution(0.05);
    return this.world.createCollider(desc);
  }

  /** Steps the simulation using a fixed-timestep accumulator so physics is deterministic
   * regardless of render framerate. Returns the number of physics steps actually taken.
   * Collision/contact-force events accumulate in `eventQueue` across all substeps and
   * should be drained once by the caller after this returns. */
  step(deltaSec: number, onSubstep?: (stepSec: number) => void): number {
    this.accumulatorSec += Math.min(deltaSec, 0.25);
    let steps = 0;
    while (this.accumulatorSec >= this.fixedTimestepSec) {
      onSubstep?.(this.fixedTimestepSec);
      this.world.step(this.eventQueue);
      this.accumulatorSec -= this.fixedTimestepSec;
      steps += 1;
      if (steps > 8) {
        this.accumulatorSec = 0;
        break;
      }
    }
    return steps;
  }

  castRay(
    origin: RAPIER.Vector3,
    direction: RAPIER.Vector3,
    maxToi: number,
    groups: number,
    excludeCollider?: RAPIER.Collider,
  ): { toi: number; point: RAPIER.Vector3; normal: RAPIER.Vector3 } | null {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      groups,
      excludeCollider,
    );
    if (!hit) return null;
    const point = ray.pointAt(hit.timeOfImpact);
    return { toi: hit.timeOfImpact, point, normal: hit.normal };
  }

  destroy(): void {
    this.eventQueue.free();
    this.world.free();
  }
}

export { RAPIER };
