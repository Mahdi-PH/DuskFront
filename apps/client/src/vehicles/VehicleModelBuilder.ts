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

/** Chunky off-road ATV tire: a faceted cylinder (visually ~10% larger than the physics
 * radius so it reads as a knobby off-road tire) with a ring of small tread-block bumps
 * around its circumference, plus a colored hub cap. Purely cosmetic — the physics wheel
 * raycast still uses dims.wheelRadius exactly, so this never affects handling. */
function buildWheel(dims: ReturnType<typeof getVehicleDimensions>, colorway: VehicleColorway): THREE.Group {
  const spinner = new THREE.Group();
  const visualRadius = dims.wheelRadius * 1.08;
  const segments = 14;

  const tireGeo = new THREE.CylinderGeometry(visualRadius, visualRadius, dims.wheelWidth, segments);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.95, metalness: 0.05 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  spinner.add(tire);

  // Tread knobs: small raised blocks ringing the tire for an off-road/ATV read.
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 1 });
  const knobCount = 10;
  for (let i = 0; i < knobCount; i++) {
    const angle = (i / knobCount) * Math.PI * 2;
    const knob = new THREE.Mesh(new THREE.BoxGeometry(dims.wheelWidth * 0.92, visualRadius * 0.22, visualRadius * 0.16), treadMat);
    knob.position.set(0, Math.sin(angle) * visualRadius * 0.97, Math.cos(angle) * visualRadius * 0.97);
    knob.rotation.x = angle;
    spinner.add(knob);
  }

  const hubGeo = new THREE.CylinderGeometry(visualRadius * 0.48, visualRadius * 0.48, dims.wheelWidth * 1.04, 7);
  hubGeo.rotateZ(Math.PI / 2);
  const hubMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, roughness: 0.35, metalness: 0.65 });
  spinner.add(new THREE.Mesh(hubGeo, hubMat));

  const capMat = new THREE.MeshStandardMaterial({ color: colorway.glow, emissive: colorway.glow, emissiveIntensity: 0.25, roughness: 0.3 });
  const cap = new THREE.Mesh(new THREE.CircleGeometry(visualRadius * 0.22, 10), capMat);
  cap.position.set(dims.wheelWidth / 2 + 0.001, 0, 0);
  cap.rotation.y = Math.PI / 2;
  spinner.add(cap);
  const capBack = cap.clone();
  capBack.position.x = -dims.wheelWidth / 2 - 0.001;
  capBack.rotation.y = -Math.PI / 2;
  spinner.add(capBack);

  return spinner;
}

/** Simple curved fender arch over a wheel, for the chunky ATV silhouette. */
function buildFender(dims: ReturnType<typeof getVehicleDimensions>, anchor: WheelAnchor, colorway: VehicleColorway): THREE.Mesh {
  const radius = dims.wheelRadius * 1.32;
  const arcGeo = new THREE.TorusGeometry(radius, 0.045, 6, 12, Math.PI * 0.95);
  const arcMat = new THREE.MeshStandardMaterial({ color: colorway.primary, roughness: 0.5, metalness: 0.3 });
  const fender = new THREE.Mesh(arcGeo, arcMat);
  fender.position.set(anchor.x, anchor.y + 0.03, anchor.z);
  fender.rotation.y = Math.PI / 2;
  fender.rotation.z = Math.PI;
  fender.castShadow = true;
  return fender;
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

  // Driver bust: torso + helmeted head with goggles + a trailing scarf + arms reaching
  // a handlebar — a friendly, mascot-like rider silhouette rather than a bare mannequin.
  const driverGroup = new THREE.Group();
  const suitMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8b48c, roughness: 0.7 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: colorway.glow, roughness: 0.3, metalness: 0.5 });
  const driverSeatZ = -dims.halfLength * 0.1;
  const driverSeatY = dims.halfHeight * 0.55;

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 8), suitMat);
  torso.position.set(0, driverSeatY, driverSeatZ);
  torso.castShadow = true;
  driverGroup.add(torso);

  const headY = driverSeatY + 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), helmetMat);
  head.position.set(0, headY, driverSeatZ);
  head.castShadow = true;
  driverGroup.add(head);

  // Helmet racing stripe.
  const stripeGeo = new THREE.TorusGeometry(0.175, 0.02, 6, 16, Math.PI);
  const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshStandardMaterial({ color: colorway.primary, roughness: 0.4 }));
  stripe.position.set(0, headY, driverSeatZ);
  stripe.rotation.set(Math.PI / 2, 0, 0);
  driverGroup.add(stripe);

  // Round goggles instead of a full-face visor — friendlier, more "kart racer kid" read.
  const goggleFrameMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.5 });
  const goggleLensMat = new THREE.MeshStandardMaterial({ color: 0x38e0ff, emissive: 0x0c1f3d, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.6 });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 6, 16, Math.PI * 1.1), goggleFrameMat);
  strap.position.set(0, headY, driverSeatZ);
  strap.rotation.set(0, Math.PI / 2, Math.PI * 0.45);
  driverGroup.add(strap);
  for (const side of [-1, 1]) {
    const goggle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12), goggleFrameMat);
    goggle.rotation.x = Math.PI / 2;
    goggle.position.set(side * 0.07, headY - 0.01, driverSeatZ + 0.14);
    driverGroup.add(goggle);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), goggleLensMat);
    lens.position.set(side * 0.07, headY - 0.01, driverSeatZ + 0.156);
    driverGroup.add(lens);
  }

  // Trailing scarf — a few flattened ribbon segments angled back for a sense of speed.
  const scarfMat = new THREE.MeshStandardMaterial({ color: colorway.primary, roughness: 0.55, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const segment = new THREE.Mesh(new THREE.PlaneGeometry(0.16 - i * 0.02, 0.16), scarfMat);
    segment.position.set(0, driverSeatY + 0.22 - i * 0.05, driverSeatZ - 0.16 - i * 0.13);
    segment.rotation.set(Math.PI * 0.12, 0, (i - 1) * 0.15);
    driverGroup.add(segment);
  }

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 6), skinMat);
    arm.position.set(side * 0.22, driverSeatY - 0.05, driverSeatZ + 0.35);
    arm.rotation.x = Math.PI / 2.6;
    driverGroup.add(arm);
  }
  root.add(driverGroup);

  // Handlebar the driver's arms reach toward.
  const handlebarMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.7, roughness: 0.35 });
  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, dims.halfWidth * 1.1, 8), handlebarMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, driverSeatY - 0.02, driverSeatZ + 0.55);
  root.add(handlebar);
  const handlebarPostGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8);
  const handlebarPost = new THREE.Mesh(handlebarPostGeo, handlebarMat);
  handlebarPost.position.set(0, driverSeatY - 0.09, driverSeatZ + 0.55);
  root.add(handlebarPost);

  // Front brush-guard bumper — reads as a chunky off-road nose, distinct from the hood.
  const bumperMat = new THREE.MeshStandardMaterial({ color: colorway.secondary, metalness: 0.55, roughness: 0.4 });
  const bumperCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-dims.halfWidth * 0.75, -dims.halfHeight * 0.25, dims.halfLength * 0.92),
    new THREE.Vector3(-dims.halfWidth * 0.55, -dims.halfHeight * 0.05, dims.halfLength * 1.05),
    new THREE.Vector3(dims.halfWidth * 0.55, -dims.halfHeight * 0.05, dims.halfLength * 1.05),
    new THREE.Vector3(dims.halfWidth * 0.75, -dims.halfHeight * 0.25, dims.halfLength * 0.92),
  ]);
  const bumper = new THREE.Mesh(new THREE.TubeGeometry(bumperCurve, 12, 0.045, 8, false), bumperMat);
  bumper.castShadow = true;
  root.add(bumper);

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

  // Wheels + fender arches above each one for a chunkier ATV stance.
  const anchors = getWheelAnchors(dims);
  const wheels: WheelRig[] = anchors.map((anchor) => {
    const pivot = new THREE.Group();
    pivot.position.set(anchor.x, anchor.y, anchor.z);
    const spinner = buildWheel(dims, colorway);
    pivot.add(spinner);
    root.add(pivot);
    root.add(buildFender(dims, anchor, colorway));
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
