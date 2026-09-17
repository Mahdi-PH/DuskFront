import * as THREE from 'three';
import type { PhysicsWorld } from './PhysicsWorld';
import type { VehicleController } from '../vehicles/VehicleController';

export interface VehicleImpactEvent {
  playerId: string;
  worldPoint: THREE.Vector3;
  strength: number; // 0..1, already scaled by collision resistance
}

/** Drains Rapier's contact-force event queue once per frame and turns matching
 * collider handles back into gameplay-relevant vehicle impacts. Registered by handle
 * rather than object identity because that's what Rapier hands back from the queue. */
export class CollisionSystem {
  private readonly controllersByColliderHandle = new Map<number, { playerId: string; controller: VehicleController }>();

  registerVehicle(playerId: string, controller: VehicleController): void {
    this.controllersByColliderHandle.set(controller.collider.handle, { playerId, controller });
  }

  unregisterVehicle(controller: VehicleController): void {
    this.controllersByColliderHandle.delete(controller.collider.handle);
  }

  /** Call once per render frame after PhysicsWorld.step(). Returns every vehicle impact
   * detected since the last drain. */
  drain(physicsWorld: PhysicsWorld): VehicleImpactEvent[] {
    const impacts: VehicleImpactEvent[] = [];
    physicsWorld.eventQueue.drainContactForceEvents((event) => {
      const a = this.controllersByColliderHandle.get(event.collider1());
      const b = this.controllersByColliderHandle.get(event.collider2());
      if (!a && !b) return;

      const magnitude = event.totalForceMagnitude();
      const normalizedStrength = Math.min(1, magnitude / 20000);

      if (a) {
        const effective = a.controller.registerImpact(normalizedStrength);
        if (effective > 0) {
          impacts.push({ playerId: a.playerId, worldPoint: a.controller.getWorldPosition(), strength: effective });
        }
      }
      if (b) {
        const effective = b.controller.registerImpact(normalizedStrength);
        if (effective > 0) {
          impacts.push({ playerId: b.playerId, worldPoint: b.controller.getWorldPosition(), strength: effective });
        }
      }
    });
    physicsWorld.eventQueue.clear();
    return impacts;
  }
}
