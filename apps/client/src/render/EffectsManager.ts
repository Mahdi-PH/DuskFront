import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import type { GraphicsProfile } from './GraphicsSettings';

/** Central home for all gameplay VFX pools (tire smoke, boost flame, impact bursts,
 * pickup sparkles, explosions). One ParticleSystem per category keeps draw calls low
 * regardless of how many vehicles are emitting at once. */
export class EffectsManager {
  private readonly smoke: ParticleSystem;
  private readonly boostFlame: ParticleSystem;
  private readonly impact: ParticleSystem;
  private readonly pickup: ParticleSystem;
  private readonly explosion: ParticleSystem;
  private particleMultiplier: number;

  constructor(scene: THREE.Scene, profile: GraphicsProfile) {
    this.particleMultiplier = profile.particleMultiplier;
    const capacityFor = (base: number) => Math.max(16, Math.round(base * profile.particleMultiplier));

    this.smoke = new ParticleSystem(capacityFor(400), 0.6, THREE.NormalBlending);
    this.boostFlame = new ParticleSystem(capacityFor(200), 0.35, THREE.AdditiveBlending);
    this.impact = new ParticleSystem(capacityFor(150), 0.3, THREE.AdditiveBlending);
    this.pickup = new ParticleSystem(capacityFor(150), 0.25, THREE.AdditiveBlending);
    this.explosion = new ParticleSystem(capacityFor(250), 0.5, THREE.AdditiveBlending);

    for (const system of [this.smoke, this.boostFlame, this.impact, this.pickup, this.explosion]) {
      scene.add(system.points);
    }
  }

  applyGraphicsProfile(profile: GraphicsProfile): void {
    this.particleMultiplier = profile.particleMultiplier;
  }

  emitTireSmoke(position: THREE.Vector3, intensity: number): void {
    if (Math.random() > this.particleMultiplier) return;
    const grey = 0.75 + Math.random() * 0.15;
    this.smoke.spawn({
      position: position.clone(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6),
      lifeSec: 0.6 + intensity * 0.4,
      size: 0.4 + intensity * 0.5,
      colorStart: new THREE.Color(grey, grey, grey),
      colorEnd: new THREE.Color(grey * 0.6, grey * 0.6, grey * 0.6),
      gravity: -0.4,
    });
  }

  emitBoostFlame(position: THREE.Vector3, backward: THREE.Vector3): void {
    if (Math.random() > this.particleMultiplier) return;
    this.boostFlame.spawn({
      position: position.clone(),
      velocity: backward.clone().multiplyScalar(6 + Math.random() * 3).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0)),
      lifeSec: 0.25 + Math.random() * 0.15,
      size: 0.28,
      colorStart: new THREE.Color(0x38e0ff),
      colorEnd: new THREE.Color(0xff7a3d),
      gravity: 0,
    });
  }

  emitImpactBurst(position: THREE.Vector3, strength: number): void {
    const count = Math.round(12 * Math.min(1, strength) * this.particleMultiplier);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).normalize();
      this.impact.spawn({
        position: position.clone(),
        velocity: dir.multiplyScalar(3 + strength * 4),
        lifeSec: 0.4,
        size: 0.22,
        colorStart: new THREE.Color(0xfff2c9),
        colorEnd: new THREE.Color(0xff7a3d),
        gravity: 4,
      });
    }
  }

  emitPickupBurst(position: THREE.Vector3, colorHex: number): void {
    const count = Math.round(16 * this.particleMultiplier);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.pickup.spawn({
        position: position.clone(),
        velocity: new THREE.Vector3(Math.cos(angle) * 2, 2 + Math.random(), Math.sin(angle) * 2),
        lifeSec: 0.5,
        size: 0.2,
        colorStart: new THREE.Color(colorHex),
        colorEnd: new THREE.Color(0xffffff),
        gravity: 3,
      });
    }
  }

  emitExplosion(position: THREE.Vector3): void {
    const count = Math.round(40 * this.particleMultiplier);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2).normalize();
      this.explosion.spawn({
        position: position.clone(),
        velocity: dir.multiplyScalar(4 + Math.random() * 5),
        lifeSec: 0.5 + Math.random() * 0.3,
        size: 0.45,
        colorStart: new THREE.Color(0xffb877),
        colorEnd: new THREE.Color(0x2a2c30),
        gravity: 6,
      });
    }
  }

  update(deltaSec: number): void {
    this.smoke.update(deltaSec);
    this.boostFlame.update(deltaSec);
    this.impact.update(deltaSec);
    this.pickup.update(deltaSec);
    this.explosion.update(deltaSec);
  }

  dispose(): void {
    this.smoke.dispose();
    this.boostFlame.dispose();
    this.impact.dispose();
    this.pickup.dispose();
    this.explosion.dispose();
  }
}
