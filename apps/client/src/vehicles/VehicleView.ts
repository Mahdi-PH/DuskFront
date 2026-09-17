import * as THREE from 'three';
import type { VehicleController } from './VehicleController';
import { buildVehicleModel, type VehicleModel } from './VehicleModelBuilder';
import { lerp } from './vehicleMath';
import type { EffectsManager } from '../render/EffectsManager';

/** Bridges a VehicleController's physics state to a VehicleModel's visual transform each
 * render frame: body pose, wheel spin/steer, suspension travel, and boost glow. Also
 * drives this vehicle's tire smoke and boost flame emitters. */
export class VehicleView {
  readonly model: VehicleModel;
  private smokeAccumulatorSec = 0;
  private flameAccumulatorSec = 0;

  constructor(
    private readonly controller: VehicleController,
    colorwayId: string,
    private readonly effects: EffectsManager | null = null,
  ) {
    this.model = buildVehicleModel(controller.definition, colorwayId);
  }

  update(deltaSec: number): void {
    const position = this.controller.getWorldPosition();
    const quaternion = this.controller.getWorldQuaternion();
    this.model.root.position.copy(position);
    this.model.root.quaternion.copy(quaternion);

    for (const wheelRig of this.model.wheels) {
      const state = this.controller.state.wheels.find((w) => w.id === wheelRig.anchor.id);
      if (!state) continue;
      const suspensionTravel = -state.compression * 0.12;
      wheelRig.pivot.position.set(wheelRig.anchor.x, wheelRig.anchor.y + suspensionTravel, wheelRig.anchor.z);
      wheelRig.pivot.rotation.y = state.steerAngleRad;
      wheelRig.spinner.rotation.x = state.spinAngleRad;
    }

    const boostGlowTarget = this.controller.state.isBoosting ? 1.6 : this.controller.state.driftLevel > 0 ? 0.6 : 0.15;
    for (const mat of this.model.boostGlowMaterials) {
      mat.emissiveIntensity = lerp(mat.emissiveIntensity, boostGlowTarget, 1 - Math.pow(0.001, deltaSec));
    }

    this.updateEffects(deltaSec, quaternion);
  }

  private updateEffects(deltaSec: number, quaternion: THREE.Quaternion): void {
    if (!this.effects) return;
    const state = this.controller.state;

    if (state.isDrifting) {
      this.smokeAccumulatorSec += deltaSec;
      const interval = 0.03;
      while (this.smokeAccumulatorSec >= interval) {
        this.smokeAccumulatorSec -= interval;
        for (const anchor of this.model.driftSmokeAnchors) {
          this.effects.emitTireSmoke(anchor.getWorldPosition(new THREE.Vector3()), state.driftLevel / 3);
        }
      }
    } else {
      this.smokeAccumulatorSec = 0;
    }

    if (state.isBoosting) {
      this.flameAccumulatorSec += deltaSec;
      const interval = 0.02;
      const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      while (this.flameAccumulatorSec >= interval) {
        this.flameAccumulatorSec -= interval;
        for (const tip of this.model.exhaustTips) {
          this.effects.emitBoostFlame(tip.getWorldPosition(new THREE.Vector3()), backward);
        }
      }
    } else {
      this.flameAccumulatorSec = 0;
    }
  }

  addToScene(scene: THREE.Scene): void {
    scene.add(this.model.root);
  }

  removeFromScene(scene: THREE.Scene): void {
    scene.remove(this.model.root);
  }
}
