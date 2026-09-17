import * as THREE from 'three';
import type { PhysicsWorld } from '../physics/PhysicsWorld';
import RAPIER from '@dimforge/rapier3d-compat';
import { Water } from '../render/Water';
import type { TrackControlPoint, TrackRuntimeDefinition, PropPlacement } from './TrackTypes';
import {
  createPalmTree,
  createRock,
  createBarrier,
  createSign,
  createCrate,
  createLamp,
  createBridgePillar,
  createRuinPillar,
  createContainer,
} from './PropFactory';

export interface CheckpointTransform {
  index: number;
  position: THREE.Vector3;
  forward: THREE.Vector3;
  right: THREE.Vector3;
  width: number;
  /** If a shortcut legally skips this checkpoint, lap logic accepts progress without it. */
  skippableViaShortcut: string | null;
}

export interface BuiltTrack {
  definition: TrackRuntimeDefinition;
  curve: THREE.CatmullRomCurve3;
  roadGroup: THREE.Group;
  terrainMesh: THREE.Mesh;
  checkpoints: CheckpointTransform[];
  startGrid: Array<{ position: THREE.Vector3; yawRad: number }>;
  finishLinePosition: THREE.Vector3;
  finishLineYaw: number;
  colliders: RAPIER.Collider[];
  water: Water | null;
}

function toVector3(p: TrackControlPoint): THREE.Vector3 {
  return new THREE.Vector3(p.x, p.y, p.z);
}

export function buildCurve(points: TrackControlPoint[], closed: boolean): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(points.map(toVector3), closed, 'catmullrom', 0.5);
}

/** Stable up-vector frame (not Frenet) so a mostly-horizontal racetrack ribbon doesn't
 * twist unpredictably on straights the way TubeGeometry's Frenet frames can. */
export function frameAt(curve: THREE.CatmullRomCurve3, t: number): { position: THREE.Vector3; right: THREE.Vector3; tangent: THREE.Vector3 } {
  const position = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  let right = new THREE.Vector3().crossVectors(tangent, worldUp);
  if (right.lengthSq() < 1e-6) right = new THREE.Vector3(1, 0, 0);
  right.normalize();
  return { position, right, tangent };
}

export function widthAt(points: TrackControlPoint[], t: number, baseWidth: number): number {
  const idx = t * (points.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(points.length - 1, i0 + 1);
  const frac = idx - i0;
  const w0 = points[i0]?.widthMul ?? 1;
  const w1 = points[i1]?.widthMul ?? 1;
  return baseWidth * (w0 + (w1 - w0) * frac);
}

function buildRibbon(
  curve: THREE.CatmullRomCurve3,
  points: TrackControlPoint[],
  baseWidth: number,
  segments: number,
  colorHex: number,
): { mesh: THREE.Mesh; vertices: Float32Array; indices: Uint32Array } {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const { position, right } = frameAt(curve, t);
    const w = widthAt(points, t, baseWidth) / 2;
    const left = position.clone().addScaledVector(right, -w);
    const rightPos = position.clone().addScaledVector(right, w);
    positions.push(left.x, left.y, left.z, rightPos.x, rightPos.y, rightPos.z);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * 20, 1, t * 20);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.85, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return { mesh, vertices: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function buildTerrain(size: number, color: number, seed: number): THREE.Mesh {
  const segments = 48;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position!;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const n =
      Math.sin((x + seed) * 0.02) * Math.cos((z - seed) * 0.023) * 1.4 +
      Math.sin((x - seed * 2) * 0.05) * 0.5;
    positions.setY(i, n - 1.4);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function placeProp(placement: PropPlacement): THREE.Object3D {
  let obj: THREE.Object3D;
  switch (placement.type) {
    case 'palm':
      obj = createPalmTree();
      break;
    case 'rock':
      obj = createRock(placement.scale);
      break;
    case 'barrier':
      obj = createBarrier();
      break;
    case 'sign':
      obj = createSign('');
      break;
    case 'crate':
      obj = createCrate();
      break;
    case 'lamp':
      obj = createLamp();
      break;
    case 'pillar':
      obj = createBridgePillar(placement.scale);
      break;
    case 'ruin':
      obj = createRuinPillar();
      break;
    case 'container':
      obj = createContainer(0x38e0ff);
      break;
    default:
      obj = new THREE.Object3D();
  }
  obj.position.set(...placement.position);
  obj.rotation.y = placement.rotationY;
  if (placement.type !== 'rock' && placement.type !== 'pillar') obj.scale.setScalar(placement.scale);
  return obj;
}

export function buildTrack(def: TrackRuntimeDefinition, physicsWorld: PhysicsWorld, scene: THREE.Scene): BuiltTrack {
  const curve = buildCurve(def.mainLoop, true);
  const segments = Math.max(80, def.mainLoop.length * 6);
  const roadColor = 0x2a2c30;

  const roadGroup = new THREE.Group();
  roadGroup.name = `track-${def.id}`;

  const main = buildRibbon(curve, def.mainLoop, def.baseWidth, segments, roadColor);
  roadGroup.add(main.mesh);

  const colliders: RAPIER.Collider[] = [];
  colliders.push(physicsWorld.createTrackCollider(main.vertices, main.indices));

  const shortcutCurve = buildCurve(def.shortcut.points, false);
  const shortcutSegments = Math.max(20, def.shortcut.points.length * 6);
  const shortcut = buildRibbon(shortcutCurve, def.shortcut.points, def.baseWidth * def.shortcut.widthMul, shortcutSegments, 0x3a3d42);
  roadGroup.add(shortcut.mesh);
  colliders.push(physicsWorld.createTrackCollider(shortcut.vertices, shortcut.indices));

  const terrainMesh = buildTerrain(def.terrainSize, def.terrainColor, def.mainLoop.length * 17);
  const terrainVerts = terrainMesh.geometry.attributes.position!.array as Float32Array;
  const terrainIdx = terrainMesh.geometry.getIndex()!.array as Uint32Array | Uint16Array;
  colliders.push(physicsWorld.createTrackCollider(terrainVerts, Uint32Array.from(terrainIdx)));
  scene.add(terrainMesh);
  scene.add(roadGroup);

  for (const placement of def.props) {
    roadGroup.add(placeProp(placement));
  }

  // Guard rails along the outer edge of the main loop to keep it visually bounded.
  for (let i = 0; i < segments; i += 4) {
    const t = i / segments;
    const { position, right } = frameAt(curve, t);
    const w = widthAt(def.mainLoop, t, def.baseWidth) / 2 + 0.3;
    for (const side of [-1, 1]) {
      const barrier = createBarrier(2.4);
      const pos = position.clone().addScaledVector(right, side * w);
      barrier.position.copy(pos);
      const tangent = curve.getTangentAt(t);
      barrier.rotation.y = Math.atan2(tangent.x, tangent.z);
      roadGroup.add(barrier);
    }
  }

  const checkpoints: CheckpointTransform[] = [];
  for (let i = 0; i < def.checkpointCount; i++) {
    const t = i / def.checkpointCount;
    const { position, right, tangent } = frameAt(curve, t);
    checkpoints.push({
      index: i,
      position,
      forward: tangent,
      right,
      width: widthAt(def.mainLoop, t, def.baseWidth),
      skippableViaShortcut:
        i > def.shortcut.fromCheckpointIndex && i < def.shortcut.toCheckpointIndex ? def.shortcut.id : null,
    });
  }

  let water: Water | null = null;
  if (def.hasWater) {
    water = new Water(def.terrainSize * 0.98, def.terrainSize * 0.98);
    water.mesh.position.set(0, def.waterLevelY, 0);
    scene.add(water.mesh);
  }

  const startFrame = frameAt(curve, 0);
  const startYaw = Math.atan2(startFrame.tangent.x, startFrame.tangent.z);
  const startGrid = Array.from({ length: 8 }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2 === 0 ? -1 : 1;
    const backOffset = 3 + row * 2.6;
    const sideOffset = col * (def.baseWidth * 0.22);
    const pos = startFrame.position
      .clone()
      .addScaledVector(startFrame.tangent, -backOffset)
      .addScaledVector(startFrame.right, sideOffset)
      .add(new THREE.Vector3(0, 0.5, 0));
    return { position: pos, yawRad: startYaw };
  });

  return {
    definition: def,
    curve,
    roadGroup,
    terrainMesh,
    checkpoints,
    startGrid,
    finishLinePosition: startFrame.position,
    finishLineYaw: startYaw,
    colliders,
    water,
  };
}
