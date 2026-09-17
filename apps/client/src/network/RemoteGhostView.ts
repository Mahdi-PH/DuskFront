import * as THREE from 'three';
import { getVehicleById } from '@velocity-island/shared';
import { buildVehicleModel, type VehicleModel } from '../vehicles/VehicleModelBuilder';

/** Visual-only stand-in for a remote player's kart: no physics, just its model
 * smoothly interpolated toward the latest server-relayed position/heading. Used for
 * online races where the server doesn't replicate full per-vehicle physics (see
 * RaceRoom's scope note) — good enough for "see other real players out there,"
 * not a physics-perfect replica. */
export class RemoteGhostView {
  readonly model: VehicleModel;
  private targetPosition = new THREE.Vector3();
  private targetYaw = 0;

  constructor(vehicleId: string, colorwayId: string) {
    this.model = buildVehicleModel(getVehicleById(vehicleId), colorwayId);
  }

  setTarget(position: { x: number; y: number; z: number }, yawRad: number): void {
    this.targetPosition.set(position.x, position.y, position.z);
    this.targetYaw = yawRad;
  }

  update(deltaSec: number): void {
    const smoothing = 1 - Math.pow(0.0001, deltaSec);
    this.model.root.position.lerp(this.targetPosition, smoothing);
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.targetYaw);
    this.model.root.quaternion.slerp(targetQuat, smoothing);

    for (const wheelRig of this.model.wheels) {
      wheelRig.spinner.rotation.x += deltaSec * 8;
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.model.root);
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.model.root);
  }
}
