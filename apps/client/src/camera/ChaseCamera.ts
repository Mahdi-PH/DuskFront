import * as THREE from 'three';
import { clamp, lerp } from '../vehicles/vehicleMath';

export interface ChaseCameraTarget {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  forwardSpeedMs: number;
  topSpeedMs: number;
  isDrifting: boolean;
  isBoosting: boolean;
  isGrounded: boolean;
  airborneTimeSec: number;
}

/** Third-person dynamic racing camera. Smoothly follows behind + above the kart,
 * widens FOV under boost, tucks in slightly during drift, and lags/dips on landing
 * after a jump. Shake is additive and decays quickly so it never fights readability. */
export class ChaseCamera {
  readonly camera: THREE.PerspectiveCamera;

  private readonly baseFov = 62;
  private readonly boostFov = 76;
  private readonly driftDistanceScale = 0.85;

  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private currentFov = this.baseFov;
  private shakeTrauma = 0;
  private shakeOffset = new THREE.Vector3();
  private landingDip = 0;
  private wasGrounded = true;
  private reduceCameraShake = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 1500);
  }

  setAccessibility(reduceCameraShake: boolean): void {
    this.reduceCameraShake = reduceCameraShake;
  }

  addImpactShake(strength: number): void {
    const scale = this.reduceCameraShake ? 0.25 : 1;
    this.shakeTrauma = clamp(this.shakeTrauma + strength * scale, 0, 1);
  }

  update(deltaSec: number, target: ChaseCameraTarget): void {
    const speedRatio = clamp(Math.abs(target.forwardSpeedMs) / Math.max(target.topSpeedMs, 1), 0, 1);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(target.quaternion);
    const up = new THREE.Vector3(0, 1, 0);

    const followDistance = lerp(4.6, 5.6, speedRatio) * (target.isDrifting ? this.driftDistanceScale : 1);
    const followHeight = lerp(1.7, 2.1, speedRatio);
    const lookAheadDistance = lerp(3, 9, speedRatio);

    if (!target.isGrounded) this.landingDip = Math.max(this.landingDip, 0);
    if (target.isGrounded && !this.wasGrounded) {
      const impactStrength = clamp(target.airborneTimeSec * 0.5, 0, 1);
      this.landingDip = impactStrength * 0.6;
    }
    this.wasGrounded = target.isGrounded;
    this.landingDip = lerp(this.landingDip, 0, 1 - Math.pow(0.001, deltaSec));

    const desiredPosition = target.position
      .clone()
      .sub(forward.clone().multiplyScalar(followDistance))
      .add(up.clone().multiplyScalar(followHeight - this.landingDip * 0.5));

    const desiredLookAt = target.position.clone().add(forward.clone().multiplyScalar(lookAheadDistance)).add(up.clone().multiplyScalar(0.3));

    const positionSmoothing = 1 - Math.pow(0.0001, deltaSec);
    const lookSmoothing = 1 - Math.pow(0.00005, deltaSec);
    this.currentPosition.lerp(desiredPosition, positionSmoothing);
    this.currentLookAt.lerp(desiredLookAt, lookSmoothing);

    const desiredFov = target.isBoosting ? this.boostFov : lerp(this.baseFov, this.baseFov + 6, speedRatio);
    this.currentFov = lerp(this.currentFov, desiredFov, 1 - Math.pow(0.0005, deltaSec));

    this.shakeTrauma = lerp(this.shakeTrauma, 0, 1 - Math.pow(0.00001, deltaSec));
    const shakeMag = this.shakeTrauma * this.shakeTrauma * 0.35;
    this.shakeOffset.set(
      (Math.random() * 2 - 1) * shakeMag,
      (Math.random() * 2 - 1) * shakeMag,
      0,
    );

    this.camera.position.copy(this.currentPosition).add(this.shakeOffset);
    this.camera.lookAt(this.currentLookAt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.01) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }
  }

  snapToTarget(target: ChaseCameraTarget): void {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(target.quaternion);
    this.currentPosition = target.position.clone().sub(forward.clone().multiplyScalar(5)).add(new THREE.Vector3(0, 1.8, 0));
    this.currentLookAt = target.position.clone().add(forward.clone().multiplyScalar(5));
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
