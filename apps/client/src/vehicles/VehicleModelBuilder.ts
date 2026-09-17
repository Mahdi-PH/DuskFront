import * as THREE from 'three';
import type { VehicleDefinition } from '@velocity-island/shared';
import { PALETTE } from '@velocity-island/shared';
import { getVehicleDimensions, getWheelAnchors, type WheelAnchor } from './vehicleDimensions';
import { buildChassisShape } from './vehicleSilhouettes';

export interface VehicleColorway {
  id: string;
  primary: THREE.ColorRepresentation;
  secondary: THREE.ColorRepresentation;
  glow: THREE.ColorRepresentation;
}

const COLORWAY_PRESETS: Record<string, VehicleColorway> = {
  'reef-red': { id: 'reef-red', primary: PALETTE.coral, secondary: PALETTE.deepNavy, glow: PALETTE.turquoise },
  'deep-navy': { id: 'deep-navy', primary: PALETTE.deepNavy, secondary: PALETTE.warmWhite, glow: PALETTE.turquoise },
  'sunset-orange': { id: 'sunset-orange', primary: PALETTE.sunsetOrange, secondary: PALETTE.deepNavy, glow: PALETTE.coral },
  'turquoise-flash': { id: 'turquoise-flash', primary: PALETTE.turquoise, secondary: PALETTE.warmWhite, glow: PALETTE.sunsetOrange },
  'warm-white': { id: 'warm-white', primary: PALETTE.warmWhite, secondary: PALETTE.oceanBlue, glow: PALETTE.coral },
  'coral-streak': { id: 'coral-streak', primary: PALETTE.coral, secondary: PALETTE.warmWhite, glow: PALETTE.turquoise },
  'ocean-blue': { id: 'ocean-blue', primary: PALETTE.oceanBlue, secondary: PALETTE.warmWhite, glow: PALETTE.turquoise },
  'tropical-green': { id: 'tropical-green', primary: PALETTE.tropicalGreen, secondary: PALETTE.deepNavy, glow: PALETTE.warmWhite },
  'navy-fade': { id: 'navy-fade', primary: PALETTE.deepNavy, secondary: PALETTE.oceanBlue, glow: PALETTE.turquoise },
  'coral-fang': { id: 'coral-fang', primary: PALETTE.coral, secondary: PALETTE.sunsetOrange, glow: PALETTE.warmWhite },
  'turquoise-bite': { id: 'turquoise-bite', primary: PALETTE.turquoise, secondary: PALETTE.deepNavy, glow: PALETTE.coral },
  'warm-white-2': { id: 'warm-white-2', primary: PALETTE.warmWhite, secondary: PALETTE.coral, glow: PALETTE.turquoise },
  'turquoise-spark': { id: 'turquoise-spark', primary: PALETTE.turquoise, secondary: PALETTE.sunsetOrange, glow: PALETTE.sunsetOrange },
  'coral-glow': { id: 'coral-glow', primary: PALETTE.coral, secondary: PALETTE.deepNavy, glow: PALETTE.turquoise },
  'navy-spark': { id: 'navy-spark', primary: PALETTE.deepNavy, secondary: PALETTE.turquoise, glow: PALETTE.turquoise },
  'sunset-comet': { id: 'sunset-comet', primary: PALETTE.sunsetOrange, secondary: PALETTE.coral, glow: PALETTE.warmWhite },
  'coral-blaze': { id: 'coral-blaze', primary: PALETTE.coral, secondary: PALETTE.sunsetOrange, glow: PALETTE.warmWhite },
};

export function getColorway(id: string): VehicleColorway {
  return COLORWAY_PRESETS[id] ?? COLORWAY_PRESETS['ocean-blue']!;
}

export interface WheelRig {
  pivot: THREE.Group; // handles steering yaw
  spinner: THREE.Group; // handles rolling spin
  anchor: WheelAnchor;
}

export interface VehicleModel {
  root: THREE.Group;
  wheels: WheelRig[];
  boostGlowMaterials: THREE.MeshStandardMaterial[];
  exhaustTips: THREE.Object3D[];
  driftSmokeAnchors: THREE.Object3D[];
  headlights: THREE.PointLight[];
}

function buildWheel(dims: ReturnType<typeof getVehicleDimensions>, colorway: VehicleColorway): THREE.Group {
  const spinner = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(dims.wheelRadius, dims.wheelRadius, dims.wheelWidth, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9, metalness: 0.1 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  spinner.add(tire);

  const hubGeo = new THREE.CylinderGeometry(dims.wheelRadius * 0.5, dims.wheelRadius * 0.5, dims.wheelWidth * 1.02, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, roughness: 0.4, metalness: 0.6 });
  spinner.add(new THREE.Mesh(hubGeo, hubMat));

  return spinner;
}

/** Builds an original stylized ATV-kart model: an extruded chassis silhouette, roll bar,
 * seated driver bust, chunky wheels, exhaust tips and boost glow strips. Fully procedural —
 * no external assets — but visually distinct per vehicle via silhouette + dimensions + colorway. */
export function buildVehicleModel(definition: VehicleDefinition, colorwayId: string): VehicleModel {
  const dims = getVehicleDimensions(definition.id);
  const colorway = getColorway(colorwayId);
  const root = new THREE.Group();
  root.name = `vehicle-${definition.id}`;

  const chassisShape = buildChassisShape(definition.silhouette, dims.halfLength, dims.halfHeight);
  const chassisWidth = dims.halfWidth * 2 * 0.82;
  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
    depth: chassisWidth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 8,
  });
  chassisGeo.translate(0, 0, -chassisWidth / 2);
  chassisGeo.rotateY(-Math.PI / 2);
  const chassisMat = new THREE.MeshStandardMaterial({ color: colorway.primary, roughness: 0.45, metalness: 0.35 });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  chassis.position.y = -dims.halfHeight;
  root.add(chassis);

  // Boost glow side strips — emissive intensity is driven live by VehicleView while boosting.
  const boostGlowMaterials: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const stripGeo = new THREE.BoxGeometry(0.05, 0.08, dims.halfLength * 1.4);
    const stripMat = new THREE.MeshStandardMaterial({
      color: colorway.glow,
      emissive: colorway.glow,
      emissiveIntensity: 0.15,
      roughness: 0.3,
    });
    boostGlowMaterials.push(stripMat);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(side * dims.halfWidth * 0.95, -dims.halfHeight * 0.4, 0);
    root.add(strip);
  }

  // Roll bar.
  const rollBarMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, roughness: 0.3, metalness: 0.7 });
  const rollBarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-dims.halfWidth * 0.8, dims.halfHeight * 0.3, -dims.halfLength * 0.35),
    new THREE.Vector3(-dims.halfWidth * 0.85, dims.halfHeight * 1.5 * dims.cabinHeightScale, -dims.halfLength * 0.25),
    new THREE.Vector3(dims.halfWidth * 0.85, dims.halfHeight * 1.5 * dims.cabinHeightScale, -dims.halfLength * 0.25),
    new THREE.Vector3(dims.halfWidth * 0.8, dims.halfHeight * 0.3, -dims.halfLength * 0.35),
  ]);
  const rollBarGeo = new THREE.TubeGeometry(rollBarCurve, 16, 0.05, 8, false);
  const rollBar = new THREE.Mesh(rollBarGeo, rollBarMat);
  rollBar.castShadow = true;
  root.add(rollBar);

  // Spoiler.
  const spoilerGeo = new THREE.BoxGeometry(dims.halfWidth * 1.6 * dims.spoilerScale, 0.06, 0.32 * dims.spoilerScale);
  const spoiler = new THREE.Mesh(spoilerGeo, rollBarMat);
  spoiler.position.set(0, dims.halfHeight * 1.4, -dims.halfLength * 0.95);
  spoiler.castShadow = true;
  root.add(spoiler);
  const strutGeo = new THREE.CylinderGeometry(0.03, 0.03, dims.halfHeight * 1.1, 6);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(strutGeo, rollBarMat);
    strut.position.set(side * dims.halfWidth * 0.6, dims.halfHeight * 0.75, -dims.halfLength * 0.95);
    root.add(strut);
  }

  // Driver bust: torso + helmeted head + arms toward a handlebar.
  const driverGroup = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b48c, roughness: 0.7 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: colorway.glow, roughness: 0.3, metalness: 0.5 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 8), suitMat);
  torso.position.set(0, dims.halfHeight * 0.55, -dims.halfLength * 0.15);
  torso.castShadow = true;
  driverGroup.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), helmetMat);
  head.position.set(0, dims.halfHeight * 0.55 + 0.42, -dims.halfLength * 0.15);
  head.castShadow = true;
  driverGroup.add(head);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c1f3d, roughness: 0.1, metalness: 0.8 }),
  );
  visor.position.set(0, dims.halfHeight * 0.55 + 0.4, -dims.halfLength * 0.15 + 0.12);
  visor.rotation.x = Math.PI / 2;
  driverGroup.add(visor);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 6), skinMat);
    arm.position.set(side * 0.22, dims.halfHeight * 0.5, -dims.halfLength * 0.15 + 0.35);
    arm.rotation.x = Math.PI / 2.6;
    driverGroup.add(arm);
  }
  root.add(driverGroup);

  // Exhaust pipes.
  const exhaustTips: THREE.Object3D[] = [];
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.3 });
  const exhaustCount = definition.id === 'spark' || definition.id === 'comet' ? 2 : 1;
  for (let i = 0; i < exhaustCount; i++) {
    const offsetX = exhaustCount === 2 ? (i === 0 ? -1 : 1) * dims.halfWidth * 0.5 : dims.halfWidth * 0.6;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 8), exhaustMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(offsetX, -dims.halfHeight * 0.6, -dims.halfLength - 0.1);
    root.add(pipe);
    const tip = new THREE.Object3D();
    tip.position.set(offsetX, -dims.halfHeight * 0.6, -dims.halfLength - 0.26);
    root.add(tip);
    exhaustTips.push(tip);
  }

  // Headlights.
  const headlights: THREE.PointLight[] = [];
  for (const side of [-1, 1]) {
    const light = new THREE.PointLight(0xfff6d8, 0.6, 6, 2);
    light.position.set(side * dims.halfWidth * 0.6, -dims.halfHeight * 0.1, dims.halfLength - 0.1);
    root.add(light);
    headlights.push(light);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 1.2 }),
    );
    lens.position.copy(light.position);
    root.add(lens);
  }

  // Wheels.
  const anchors = getWheelAnchors(dims);
  const wheels: WheelRig[] = anchors.map((anchor) => {
    const pivot = new THREE.Group();
    pivot.position.set(anchor.x, anchor.y, anchor.z);
    const spinner = buildWheel(dims, colorway);
    pivot.add(spinner);
    root.add(pivot);
    return { pivot, spinner, anchor };
  });

  // Tire-smoke emission anchors sit just behind the rear wheels at ground height.
  const driftSmokeAnchors: THREE.Object3D[] = anchors
    .filter((a) => !a.isFront)
    .map((a) => {
      const anchor = new THREE.Object3D();
      anchor.position.set(a.x, a.y, a.z);
      root.add(anchor);
      return anchor;
    });

  return { root, wheels, boostGlowMaterials, exhaustTips, driftSmokeAnchors, headlights };
}
