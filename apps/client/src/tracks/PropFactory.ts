import * as THREE from 'three';

/** Procedural, low-poly track props. Original geometry only — primitives combined into
 * simple recognizable silhouettes (no external assets), instanced by TrackBuilder for
 * anything repeated (trees/rocks/lamps) to keep draw calls low. */

export function createPalmTree(): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 });
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, 1.2, 0.05),
    new THREE.Vector3(0.05, 2.4, -0.05),
    new THREE.Vector3(0, 3.2, 0),
  ]);
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 8, 0.14, 6, false), trunkMat);
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fb872, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.0, 4, 1, true), leafMat);
    leaf.position.set(0, 3.2, 0);
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = angle;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

export function createRock(scale = 1): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(0.6 * scale, 0);
  const positions = geo.attributes.position!;
  for (let i = 0; i < positions.count; i++) {
    const jitter = 0.85 + Math.random() * 0.3;
    positions.setXYZ(i, positions.getX(i) * jitter, positions.getY(i) * jitter, positions.getZ(i) * jitter);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6a63, roughness: 1, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBarrier(length = 2): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.6 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.5 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.08), stripeMat);
  rail.position.y = 0.6;
  rail.castShadow = true;
  group.add(rail);
  for (const x of [-length / 2 + 0.15, length / 2 - 0.15]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 6), postMat);
    post.position.set(x, 0.32, 0);
    post.castShadow = true;
    group.add(post);
  }
  return group;
}

export function createSign(text: string): THREE.Group {
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6), postMat);
  post.position.y = 0.9;
  post.castShadow = true;
  group.add(post);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x1e6fb8, roughness: 0.5 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.06), boardMat);
  board.position.y = 1.7;
  board.castShadow = true;
  group.add(board);
  void text; // Reserved for future canvas-texture label rendering.
  return group;
}

export function createCrate(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createLamp(): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, metalness: 0.6, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), poleMat);
  pole.position.y = 1.6;
  pole.castShadow = true;
  group.add(pole);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0x38e0ff, emissive: 0x38e0ff, emissiveIntensity: 1.5 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), bulbMat);
  bulb.position.y = 3.25;
  group.add(bulb);
  const light = new THREE.PointLight(0x38e0ff, 0.8, 10, 2);
  light.position.y = 3.25;
  group.add(light);
  return group;
}

export function createBridgePillar(height: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.5, 0.7, height, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRuinPillar(): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8), mat);
  base.position.y = 0.6;
  base.castShadow = true;
  group.add(base);
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.6, 8), mat);
  mid.position.y = 1.2 + 0.8;
  mid.rotation.z = 0.05;
  mid.castShadow = true;
  group.add(mid);
  return group;
}

export function createContainer(color: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.BoxGeometry(2.4, 2.0, 1.0);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
