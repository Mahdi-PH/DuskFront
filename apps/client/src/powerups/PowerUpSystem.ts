import * as THREE from 'three';
import { getWeaponById, POWERUP_BALANCE, type WeaponDefinition, type WeaponId } from '@velocity-island/shared';
import type { BuiltTrack } from '../tracks/TrackBuilder';
import type { RacerRuntime } from '../game/RaceManager';
import type { EventBus } from '../core/EventBus';
import type { GameEventMap } from '../game/GameEvents';
import type { EffectsManager } from '../render/EffectsManager';
import { CrateField } from './CrateField';

interface Projectile {
  weaponId: 'fireball' | 'rocket';
  ownerId: string;
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ageSec: number;
  lifeSec: number;
  hit: boolean;
}

interface OilTrapInstance {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  ageSec: number;
  lifeSec: number;
  triggeredFor: Set<string>;
}

interface ShockwaveVisual {
  mesh: THREE.Mesh;
  ageSec: number;
  maxRadius: number;
  expandSpeed: number;
}

const WEAPON_COLORS: Record<WeaponId, number> = {
  fireball: 0xff5c3d,
  shockwave: 0x38e0ff,
  turbo: 0xff7a3d,
  shield: 0x2fd9c9,
  magnet: 0xff5c6c,
  oilTrap: 0x2a2c30,
  emp: 0x9d7bff,
  rocket: 0xffb877,
  phantom: 0xfaf6ee,
};

/** Owns crate spawning/pickup, per-racer inventory + cooldown, and all nine weapon
 * effects (projectiles, radius attacks, self-buffs, traps). Server-authoritative
 * validation happens on the multiplayer path (see apps/server); in single-player this
 * is the sole source of truth. */
export class PowerUpSystem {
  readonly crateField: CrateField;
  private inventory = new Map<string, WeaponId | null>();
  private cooldowns = new Map<string, number>();
  private projectiles: Projectile[] = [];
  private oilTraps: OilTrapInstance[] = [];
  private shockwaves: ShockwaveVisual[] = [];

  constructor(
    track: BuiltTrack,
    private readonly scene: THREE.Scene,
    private readonly effects: EffectsManager,
    private readonly events: EventBus<GameEventMap>,
  ) {
    this.crateField = new CrateField(track, scene);
  }

  getHeldWeapon(playerId: string): WeaponId | null {
    return this.inventory.get(playerId) ?? null;
  }

  update(deltaSec: number, racers: RacerRuntime[], usePowerUpRequested: Set<string>): void {
    this.crateField.update(deltaSec);

    for (const racer of racers) {
      const cooldown = this.cooldowns.get(racer.playerId) ?? 0;
      if (cooldown > 0) this.cooldowns.set(racer.playerId, cooldown - deltaSec);

      if (!this.inventory.get(racer.playerId)) {
        const pos = racer.controller.getWorldPosition();
        const picked = this.crateField.tryPickup(pos);
        if (picked) {
          const weaponId = this.rollWeaponForPosition(racer.position, racers.length);
          this.inventory.set(racer.playerId, weaponId);
          this.effects.emitPickupBurst(picked, WEAPON_COLORS[weaponId]);
          this.events.emit('powerUpPickedUp', { playerId: racer.playerId, weaponId });
        }
      }

      if (usePowerUpRequested.has(racer.playerId)) {
        const held = this.inventory.get(racer.playerId);
        const currentCooldown = this.cooldowns.get(racer.playerId) ?? 0;
        if (held && currentCooldown <= 0) {
          this.useWeapon(racer, held, racers);
          this.inventory.set(racer.playerId, null);
          const weaponDef = getWeaponById(held);
          this.cooldowns.set(racer.playerId, weaponDef.cooldownSec);
        }
      }
    }

    this.updateProjectiles(deltaSec, racers);
    this.updateOilTraps(deltaSec, racers);
    this.updateShockwaves(deltaSec);
  }

  private rollWeaponForPosition(position: number, totalRacers: number): WeaponId {
    const normalizedPosition = totalRacers <= 1 ? 1 : Math.round(((position - 1) / (totalRacers - 1)) * 7) + 1;
    const bandKey =
      normalizedPosition <= 2 ? 'leader' : normalizedPosition >= 7 ? 'trailing' : 'midpack';
    const band = POWERUP_BALANCE.rarityByPositionBand[bandKey]!;
    const entries = Object.entries(band.weights) as [WeaponId, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let roll = Math.random() * total;
    for (const [weaponId, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return weaponId;
    }
    return entries[0]![0];
  }

  private useWeapon(racer: RacerRuntime, weaponId: WeaponId, racers: RacerRuntime[]): void {
    this.events.emit('powerUpUsed', { playerId: racer.playerId, weaponId });
    racer.powerUpsUsedCount += 1;
    const weapon = getWeaponById(weaponId);
    const position = racer.controller.getWorldPosition();
    const quaternion = racer.controller.getWorldQuaternion();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

    switch (weaponId) {
      case 'fireball':
      case 'rocket':
        this.spawnProjectile(racer.playerId, weaponId, position, forward, weapon);
        break;
      case 'shockwave':
        this.spawnShockwave(position, weapon);
        this.applyRadiusEffect(racer.playerId, position, weapon.radius as number, racers, (target) =>
          target.controller.applyStun(weapon.impactStunSec as number, weapon.impactSpeedPenalty as number),
        );
        break;
      case 'turbo':
        racer.controller.activateInstantBoost(weapon.boostForceMultiplier as number, weapon.durationSec as number);
        break;
      case 'shield':
        racer.controller.applyShield(weapon.durationSec as number);
        break;
      case 'magnet': {
        const nearby = this.crateField.findNearby(position, weapon.radius as number);
        for (const cratePos of nearby) this.crateField.forceCollect(cratePos);
        if (nearby.length > 0 && !this.inventory.get(racer.playerId)) {
          const weaponId2 = this.rollWeaponForPosition(racer.position, racers.length);
          this.inventory.set(racer.playerId, weaponId2);
          this.events.emit('powerUpPickedUp', { playerId: racer.playerId, weaponId: weaponId2 });
        }
        break;
      }
      case 'oilTrap':
        this.spawnOilTrap(racer.playerId, position, forward, weapon);
        break;
      case 'emp':
        this.applyConeEffect(racer.playerId, position, forward, weapon.range as number, weapon.coneAngleDeg as number, racers, (target) =>
          target.controller.applyBoostDisable(weapon.boostDisableSec as number),
        );
        break;
      case 'phantom':
        racer.controller.applyPhantom(weapon.durationSec as number);
        break;
    }
  }

  private spawnProjectile(
    ownerId: string,
    weaponId: 'fireball' | 'rocket',
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    weapon: WeaponDefinition,
  ): void {
    const geo = new THREE.SphereGeometry(weaponId === 'rocket' ? 0.35 : 0.3, 10, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: WEAPON_COLORS[weaponId],
      emissive: WEAPON_COLORS[weaponId],
      emissiveIntensity: 1.4,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).addScaledVector(forward, 2).add(new THREE.Vector3(0, 0.5, 0));
    this.scene.add(mesh);

    this.projectiles.push({
      weaponId,
      ownerId,
      mesh,
      position: mesh.position.clone(),
      velocity: forward.clone().multiplyScalar(weapon.speed as number),
      ageSec: 0,
      lifeSec: weapon.lifetimeSec as number,
      hit: false,
    });
  }

  private updateProjectiles(deltaSec: number, racers: RacerRuntime[]): void {
    this.projectiles = this.projectiles.filter((proj) => {
      proj.ageSec += deltaSec;
      if (proj.ageSec >= proj.lifeSec || proj.hit) {
        this.scene.remove(proj.mesh);
        return false;
      }

      if (proj.weaponId === 'rocket') {
        const target = this.findNearestOpponentAhead(proj.ownerId, proj.position, racers);
        if (target) {
          const toTarget = target.controller.getWorldPosition().sub(proj.position).normalize();
          const weapon = getWeaponById('rocket');
          const turnRateRad = ((weapon.turnRateDegPerSec as number) * Math.PI) / 180;
          proj.velocity.lerp(toTarget.multiplyScalar(proj.velocity.length()), Math.min(1, turnRateRad * deltaSec));
        }
      }

      proj.position.addScaledVector(proj.velocity, deltaSec);
      proj.mesh.position.copy(proj.position);

      const weapon = getWeaponById(proj.weaponId);
      for (const racer of racers) {
        if (racer.playerId === proj.ownerId) continue;
        const dist = racer.controller.getWorldPosition().distanceTo(proj.position);
        if (dist <= (weapon.splashRadius as number | undefined ?? 1.6)) {
          racer.controller.applyStun(weapon.impactStunSec as number, weapon.impactSpeedPenalty as number);
          this.effects.emitExplosion(proj.position);
          proj.hit = true;
          break;
        }
      }
      return true;
    });
  }

  private findNearestOpponentAhead(ownerId: string, from: THREE.Vector3, racers: RacerRuntime[]): RacerRuntime | null {
    let best: RacerRuntime | null = null;
    let bestDist = Infinity;
    for (const racer of racers) {
      if (racer.playerId === ownerId) continue;
      const dist = racer.controller.getWorldPosition().distanceTo(from);
      if (dist < bestDist) {
        bestDist = dist;
        best = racer;
      }
    }
    return best;
  }

  private spawnOilTrap(ownerId: string, origin: THREE.Vector3, forward: THREE.Vector3, weapon: WeaponDefinition): void {
    const geo = new THREE.CircleGeometry(weapon.radius as number, 16);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.2, metalness: 0.6, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin).addScaledVector(forward, -(weapon.dropDistance as number));
    mesh.position.y += 0.02;
    this.scene.add(mesh);
    this.oilTraps.push({ position: mesh.position.clone(), mesh, ageSec: 0, lifeSec: weapon.lifetimeSec as number, triggeredFor: new Set([ownerId]) });
  }

  private updateOilTraps(deltaSec: number, racers: RacerRuntime[]): void {
    this.oilTraps = this.oilTraps.filter((trap) => {
      trap.ageSec += deltaSec;
      if (trap.ageSec >= trap.lifeSec) {
        this.scene.remove(trap.mesh);
        return false;
      }
      const weapon = getWeaponById('oilTrap');
      for (const racer of racers) {
        if (trap.triggeredFor.has(racer.playerId)) continue;
        const dist = racer.controller.getWorldPosition().distanceTo(trap.position);
        if (dist <= (weapon.radius as number)) {
          racer.controller.applyStun(weapon.durationSec as number, weapon.speedPenalty as number);
          racer.controller.body.applyTorqueImpulse({ x: 0, y: (weapon.spinTorque as number) * (Math.random() > 0.5 ? 1 : -1), z: 0 }, true);
          trap.triggeredFor.add(racer.playerId);
        }
      }
      return true;
    });
  }

  private spawnShockwave(origin: THREE.Vector3, weapon: WeaponDefinition): void {
    const geo = new THREE.RingGeometry(0.1, 0.3, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: WEAPON_COLORS.shockwave, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    mesh.position.y += 0.1;
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, ageSec: 0, maxRadius: weapon.radius as number, expandSpeed: weapon.expandSpeed as number });
  }

  private updateShockwaves(deltaSec: number): void {
    this.shockwaves = this.shockwaves.filter((wave) => {
      wave.ageSec += deltaSec;
      const radius = wave.ageSec * wave.expandSpeed;
      if (radius >= wave.maxRadius) {
        this.scene.remove(wave.mesh);
        return false;
      }
      wave.mesh.scale.setScalar(Math.max(0.01, radius));
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - radius / wave.maxRadius);
      return true;
    });
  }

  private applyRadiusEffect(
    ownerId: string,
    origin: THREE.Vector3,
    radius: number,
    racers: RacerRuntime[],
    apply: (racer: RacerRuntime) => void,
  ): void {
    for (const racer of racers) {
      if (racer.playerId === ownerId) continue;
      if (racer.controller.getWorldPosition().distanceTo(origin) <= radius) apply(racer);
    }
  }

  private applyConeEffect(
    ownerId: string,
    origin: THREE.Vector3,
    forward: THREE.Vector3,
    range: number,
    coneAngleDeg: number,
    racers: RacerRuntime[],
    apply: (racer: RacerRuntime) => void,
  ): void {
    const halfAngleRad = ((coneAngleDeg / 2) * Math.PI) / 180;
    for (const racer of racers) {
      if (racer.playerId === ownerId) continue;
      const toTarget = racer.controller.getWorldPosition().sub(origin);
      const dist = toTarget.length();
      if (dist > range) continue;
      const angle = toTarget.normalize().angleTo(forward);
      if (angle <= halfAngleRad) apply(racer);
    }
  }

  dispose(): void {
    this.crateField.dispose(this.scene);
    for (const proj of this.projectiles) this.scene.remove(proj.mesh);
    for (const trap of this.oilTraps) this.scene.remove(trap.mesh);
    for (const wave of this.shockwaves) this.scene.remove(wave.mesh);
  }
}
