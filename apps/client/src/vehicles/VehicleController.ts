import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { VehicleDefinition } from '@velocity-island/shared';
import { RACE_BALANCE } from '@velocity-island/shared';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import { INTERACTION_VEHICLE, INTERACTION_WHEEL_RAY } from '../physics/collisionGroups';
import { getVehicleDimensions, getWheelAnchors, type WheelAnchor } from './vehicleDimensions';
import {
  computeEngineForce,
  computeSteerAngleRad,
  computeDriftLevel,
  computeDriftBoostChargeRate,
  computeLateralGrip,
  computeBoostAcceleration,
  computeCollisionImpulseFactor,
  speedMsToKmh,
  clamp,
  lerp,
  type DriftLevel,
} from './vehicleMath';

export interface VehicleInputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  drift: boolean;
  boost: boolean;
}

export interface WheelVisualState {
  id: WheelAnchor['id'];
  compression: number; // 0 (fully extended) .. 1 (fully compressed)
  spinAngleRad: number;
  steerAngleRad: number;
  grounded: boolean;
  localAnchor: THREE.Vector3;
}

export interface VehicleRuntimeState {
  speedKmh: number;
  forwardSpeedMs: number;
  isGrounded: boolean;
  isDrifting: boolean;
  driftLevel: DriftLevel;
  driftHeldSec: number;
  boostCharge: number; // 0..1, filled by drifting
  isBoosting: boolean;
  boostTimeRemainingSec: number;
  airborneTimeSec: number;
  flippedTimeSec: number;
  wheels: WheelVisualState[];
  lastImpactStrength: number;
}

const UP = new THREE.Vector3(0, 1, 0);

export class VehicleController {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly definition: VehicleDefinition;
  readonly state: VehicleRuntimeState;

  private input: VehicleInputState = { throttle: 0, brake: 0, steer: 0, drift: false, boost: false };
  private readonly wheelAnchors: WheelAnchor[];
  private readonly dims;
  private lastImpactCooldown = 0;

  constructor(
    private readonly physicsWorld: PhysicsWorld,
    definition: VehicleDefinition,
    startPosition: THREE.Vector3,
    startYawRad: number,
  ) {
    this.definition = definition;
    this.dims = getVehicleDimensions(definition.id);
    this.wheelAnchors = getWheelAnchors(this.dims);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(startPosition.x, startPosition.y, startPosition.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(UP, startYawRad))
      .setLinearDamping(0.15)
      .setAngularDamping(2.0)
      .setCcdEnabled(true);
    this.body = physicsWorld.world.createRigidBody(bodyDesc);
    this.body.setAdditionalMass(definition.physics.mass, true);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(this.dims.halfWidth, this.dims.halfHeight, this.dims.halfLength)
      .setCollisionGroups(INTERACTION_VEHICLE)
      .setFriction(0.3)
      .setRestitution(0.15)
      .setDensity(1.0)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(definition.physics.mass * 4);
    this.collider = physicsWorld.world.createCollider(colliderDesc, this.body);

    this.state = {
      speedKmh: 0,
      forwardSpeedMs: 0,
      isGrounded: false,
      isDrifting: false,
      driftLevel: 0,
      driftHeldSec: 0,
      boostCharge: 0,
      isBoosting: false,
      boostTimeRemainingSec: 0,
      airborneTimeSec: 0,
      flippedTimeSec: 0,
      wheels: this.wheelAnchors.map((a) => ({
        id: a.id,
        compression: 0,
        spinAngleRad: 0,
        steerAngleRad: 0,
        grounded: false,
        localAnchor: new THREE.Vector3(a.x, a.y, a.z),
      })),
      lastImpactStrength: 0,
    };
  }

  setInput(input: VehicleInputState): void {
    this.input = input;
  }

  /** Called once per fixed physics substep (see PhysicsWorld.step's onSubstep). */
  applyForces(stepSec: number): void {
    const physics = this.definition.physics;
    const rotation = this.body.rotation();
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const bodyUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const linvel = this.body.linvel();
    const velocity = new THREE.Vector3(linvel.x, linvel.y, linvel.z);
    const forwardSpeed = velocity.dot(forward);

    let groundedWheelCount = 0;
    const rearContacts: THREE.Vector3[] = [];
    const translation = this.body.translation();
    const bodyPos = new THREE.Vector3(translation.x, translation.y, translation.z);

    const steerAngle = computeSteerAngleRad(this.input.steer, forwardSpeed, physics);
    const isDrifting = this.input.drift && Math.abs(this.input.steer) > 0.15 && this.state.isGrounded;

    for (let i = 0; i < this.wheelAnchors.length; i++) {
      const anchor = this.wheelAnchors[i]!;
      const wheelVisual = this.state.wheels[i]!;
      const localOffset = new THREE.Vector3(anchor.x, anchor.y, anchor.z).applyQuaternion(quat);
      const wheelWorldPos = bodyPos.clone().add(localOffset);
      const rayLength = this.dims.wheelRadius + 0.35;

      const hit = this.physicsWorld.castRay(
        { x: wheelWorldPos.x, y: wheelWorldPos.y, z: wheelWorldPos.z },
        { x: -bodyUp.x, y: -bodyUp.y, z: -bodyUp.z },
        rayLength,
        INTERACTION_WHEEL_RAY,
        this.collider,
      );

      if (hit) {
        groundedWheelCount += 1;
        const compression = clamp(1 - hit.toi / rayLength, 0, 1);
        wheelVisual.compression = compression;
        wheelVisual.grounded = true;

        const contactPoint = new THREE.Vector3(hit.point.x, hit.point.y, hit.point.z);
        const pointVelocity = this.pointVelocity(contactPoint);
        const compressionVel = -pointVelocity.dot(bodyUp);

        const springForce = physics.suspensionStiffness * compression * physics.mass * 0.1;
        const dampingForce = physics.suspensionDamping * compressionVel * physics.mass * 0.05;
        const suspensionForce = Math.max(0, springForce - dampingForce);
        this.body.addForceAtPoint(
          { x: bodyUp.x * suspensionForce, y: bodyUp.y * suspensionForce, z: bodyUp.z * suspensionForce },
          contactPoint,
          true,
        );

        // Lateral grip: cancel sideways slip at each contact patch. Rear wheels lose grip while drifting.
        const wheelRight = anchor.isFront
          ? right.clone().applyAxisAngle(bodyUp, steerAngle)
          : right;
        const lateralVel = pointVelocity.dot(wheelRight);
        const gripCoefficient = anchor.isFront
          ? physics.gripBase
          : computeLateralGrip(isDrifting, physics);
        const lateralForceMag = -lateralVel * gripCoefficient * physics.mass * 4;
        this.body.addForceAtPoint(
          {
            x: wheelRight.x * lateralForceMag,
            y: 0,
            z: wheelRight.z * lateralForceMag,
          },
          contactPoint,
          true,
        );

        if (!anchor.isFront) rearContacts.push(contactPoint);

        wheelVisual.spinAngleRad += (forwardSpeed / this.dims.wheelRadius) * stepSec;
        wheelVisual.steerAngleRad = anchor.isFront ? steerAngle : 0;
      } else {
        wheelVisual.compression = 0;
        wheelVisual.grounded = false;
        wheelVisual.steerAngleRad = anchor.isFront ? steerAngle : 0;
      }
    }

    this.state.isGrounded = groundedWheelCount > 0;
    this.state.isDrifting = isDrifting;

    if (this.state.isGrounded) {
      // Engine / brake force applied at rear axle contact points (or body center if airborne rear wheels).
      const engineForce = computeEngineForce(this.input.throttle, this.input.brake, forwardSpeed, physics);
      const contacts = rearContacts.length > 0 ? rearContacts : [bodyPos];
      const perContact = engineForce / contacts.length;
      for (const contact of contacts) {
        this.body.addForceAtPoint(
          { x: forward.x * perContact, y: 0, z: forward.z * perContact },
          contact,
          true,
        );
      }

      // Steering yaw torque, direction-corrected for reverse.
      const speedSign = forwardSpeed >= 0 ? 1 : -1;
      const yawTorqueGain = physics.mass * 1.4;
      const speedTorqueScale = clamp(Math.abs(forwardSpeed) / 4, 0.15, 1);
      this.body.addTorque({ x: 0, y: -steerAngle * yawTorqueGain * speedTorqueScale * speedSign, z: 0 }, true);

      // Gentle flatten-to-ground stabilization so the kart doesn't tip on minor terrain noise.
      const tiltAngle = bodyUp.angleTo(UP);
      if (tiltAngle > 0.05) {
        const correctionAxis = new THREE.Vector3().crossVectors(bodyUp, UP).normalize();
        const correctionTorque = physics.mass * 2.2 * Math.min(tiltAngle, 0.6);
        this.body.addTorque(
          { x: correctionAxis.x * correctionTorque, y: correctionAxis.y * correctionTorque, z: correctionAxis.z * correctionTorque },
          true,
        );
      }

      this.state.airborneTimeSec = 0;
    } else {
      // Air control: yaw + pitch authority scaled by vehicle's airControl stat.
      const airTorqueScale = physics.mass * physics.airControl * 0.8;
      this.body.addTorque({ x: 0, y: -this.input.steer * airTorqueScale, z: 0 }, true);
      const pitchInput = this.input.throttle - this.input.brake;
      this.body.addTorque(
        { x: right.x * pitchInput * airTorqueScale * 0.6, y: 0, z: right.z * pitchInput * airTorqueScale * 0.6 },
        true,
      );
      this.state.airborneTimeSec += stepSec;
    }

    // Drift timer + boost charge accrual.
    if (this.state.isDrifting) {
      this.state.driftHeldSec += stepSec;
      this.state.driftLevel = computeDriftLevel(this.state.driftHeldSec);
      this.state.boostCharge = clamp(
        this.state.boostCharge + computeDriftBoostChargeRate(this.state.driftLevel) * stepSec,
        0,
        1,
      );
    } else if (this.state.driftHeldSec > 0) {
      // Releasing drift with charge banks it as ready-to-use boost; the caller (RaceManager)
      // decides whether to auto-consume it or require a boost button press.
      this.state.driftHeldSec = 0;
      this.state.driftLevel = 0;
    }

    // Boost force application.
    if (this.input.boost && this.state.boostCharge > 0 && !this.state.isBoosting) {
      this.state.isBoosting = true;
      this.state.boostTimeRemainingSec = physics.boostDuration * lerp(0.4, 1, this.state.boostCharge);
      this.state.boostCharge = 0;
    }
    if (this.state.isBoosting) {
      const boostAccel = computeBoostAcceleration(physics);
      this.body.addForce({ x: forward.x * boostAccel * physics.mass, y: 0, z: forward.z * boostAccel * physics.mass }, true);
      this.state.boostTimeRemainingSec -= stepSec;
      if (this.state.boostTimeRemainingSec <= 0) {
        this.state.isBoosting = false;
      }
    }

    // Flip detection.
    const upDot = bodyUp.dot(UP);
    if (upDot < Math.cos((RACE_BALANCE.respawn.flipDetectionAngleDeg * Math.PI) / 180)) {
      this.state.flippedTimeSec += stepSec;
    } else {
      this.state.flippedTimeSec = 0;
    }

    if (this.lastImpactCooldown > 0) this.lastImpactCooldown -= stepSec;

    this.state.forwardSpeedMs = forwardSpeed;
    this.state.speedKmh = speedMsToKmh(velocity.length() * Math.sign(forwardSpeed || 1));
  }

  /** Called by the collision system when this vehicle takes a meaningful hit. */
  registerImpact(impulseMagnitude: number): number {
    if (this.lastImpactCooldown > 0) return 0;
    const factor = computeCollisionImpulseFactor(this.definition.physics);
    const effective = impulseMagnitude * factor;
    this.state.lastImpactStrength = effective;
    this.lastImpactCooldown = 0.2;
    return effective;
  }

  teleportTo(position: THREE.Vector3, yawRad: number): void {
    const quat = new THREE.Quaternion().setFromAxisAngle(UP, yawRad);
    this.body.setTranslation(position, true);
    this.body.setRotation(quat, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.state.driftHeldSec = 0;
    this.state.driftLevel = 0;
    this.state.isBoosting = false;
    this.state.flippedTimeSec = 0;
    this.state.airborneTimeSec = 0;
  }

  getWorldPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  getWorldQuaternion(): THREE.Quaternion {
    const r = this.body.rotation();
    return new THREE.Quaternion(r.x, r.y, r.z, r.w);
  }

  private pointVelocity(worldPoint: THREE.Vector3): THREE.Vector3 {
    const linvel = this.body.linvel();
    const angvel = this.body.angvel();
    const translation = this.body.translation();
    const r = worldPoint.clone().sub(new THREE.Vector3(translation.x, translation.y, translation.z));
    const angular = new THREE.Vector3(angvel.x, angvel.y, angvel.z).cross(r);
    return new THREE.Vector3(linvel.x, linvel.y, linvel.z).add(angular);
  }

  dispose(): void {
    this.physicsWorld.world.removeRigidBody(this.body);
  }
}
