import * as THREE from 'three';
import { POWERUP_BALANCE } from '@velocity-island/shared';
import type { BuiltTrack } from '../tracks/TrackBuilder';
import { frameAt, widthAt } from '../tracks/TrackBuilder';

interface CrateInstance {
  mesh: THREE.Group;
  position: THREE.Vector3;
  available: boolean;
  respawnRemainingSec: number;
  bobPhase: number;
}

function buildCrateMesh(): THREE.Group {
  const group = new THREE.Group();
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x2fd9c9, emissive: 0x2fd9c9, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.4 });
  const box = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), boxMat);
  box.castShadow = true;
  group.add(box);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, emissive: 0xfaf6ee, emissiveIntensity: 0.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 8, 20), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const light = new THREE.PointLight(0x2fd9c9, 0.7, 5, 2);
  group.add(light);
  return group;
}

/** Places ENERGY CRATES along the main loop (alternating lanes, spaced by checkpoint
 * count) and handles their bob/spin animation, pickup radius checks, and respawn timer. */
export class CrateField {
  private readonly crates: CrateInstance[] = [];

  constructor(track: BuiltTrack, scene: THREE.Scene, cratesPerCheckpointGap = 1) {
    for (let i = 0; i < track.checkpoints.length; i++) {
      for (let j = 0; j < cratesPerCheckpointGap; j++) {
        const t = (i + (j + 1) / (cratesPerCheckpointGap + 1)) / track.checkpoints.length;
        const { position, right } = frameAt(track.curve, t);
        const w = widthAt(track.definition.mainLoop, t, track.definition.baseWidth) / 2;
        const lane = i % 2 === 0 ? -0.4 : 0.4;
        const pos = position.clone().addScaledVector(right, lane * w).add(new THREE.Vector3(0, 1, 0));
        const mesh = buildCrateMesh();
        mesh.position.copy(pos);
        scene.add(mesh);
        this.crates.push({ mesh, position: pos, available: true, respawnRemainingSec: 0, bobPhase: Math.random() * Math.PI * 2 });
      }
    }
  }

  update(deltaSec: number): void {
    for (const crate of this.crates) {
      if (!crate.available) {
        crate.respawnRemainingSec -= deltaSec;
        if (crate.respawnRemainingSec <= 0) {
          crate.available = true;
          crate.mesh.visible = true;
        }
        continue;
      }
      crate.bobPhase += deltaSec * 2;
      crate.mesh.position.y = crate.position.y + Math.sin(crate.bobPhase) * 0.15;
      crate.mesh.rotation.y += deltaSec * 1.2;
    }
  }

  /** Returns the world position of a picked-up crate if one is within pickupRadius, else null. */
  tryPickup(position: THREE.Vector3): THREE.Vector3 | null {
    for (const crate of this.crates) {
      if (!crate.available) continue;
      if (crate.position.distanceTo(position) <= POWERUP_BALANCE.crates.pickupRadius + 1) {
        crate.available = false;
        crate.mesh.visible = false;
        crate.respawnRemainingSec = POWERUP_BALANCE.crates.respawnSec;
        return crate.position.clone();
      }
    }
    return null;
  }

  /** Nearby available crates within radius, used by the MAGNET power-up. */
  findNearby(position: THREE.Vector3, radius: number): THREE.Vector3[] {
    return this.crates.filter((c) => c.available && c.position.distanceTo(position) <= radius).map((c) => c.position.clone());
  }

  forceCollect(position: THREE.Vector3): void {
    for (const crate of this.crates) {
      if (crate.available && crate.position.equals(position)) {
        crate.available = false;
        crate.mesh.visible = false;
        crate.respawnRemainingSec = POWERUP_BALANCE.crates.respawnSec;
        return;
      }
    }
  }

  dispose(scene: THREE.Scene): void {
    for (const crate of this.crates) scene.remove(crate.mesh);
  }
}
