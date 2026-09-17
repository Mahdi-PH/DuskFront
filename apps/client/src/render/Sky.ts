import * as THREE from 'three';

/** Procedural gradient sky dome + sun disc + directional light rig. Original shader,
 * not a copy of any specific game's sky system — a simple two-color vertical gradient
 * plus a horizon glow band, tinted per-track via `ambientColorHex`. */

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const skyFragmentShader = /* glsl */ `
  varying vec3 vWorldPosition;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 bottomColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float sunSize;

  void main() {
    float h = normalize(vWorldPosition).y;
    vec3 sky = mix(horizonColor, topColor, smoothstep(0.0, 0.6, h));
    sky = mix(bottomColor, sky, smoothstep(-0.15, 0.05, h));

    float sunAmount = max(dot(normalize(vWorldPosition), normalize(sunDirection)), 0.0);
    vec3 sunGlow = sunColor * pow(sunAmount, 1.0 / max(sunSize, 0.001)) * 0.6;
    vec3 sunDisc = sunColor * smoothstep(0.9995, 0.9999, sunAmount) * 3.0;

    gl_FragColor = vec4(sky + sunGlow + sunDisc, 1.0);
  }
`;

export interface SkyPreset {
  topColor: THREE.ColorRepresentation;
  horizonColor: THREE.ColorRepresentation;
  bottomColor: THREE.ColorRepresentation;
  sunColor: THREE.ColorRepresentation;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  ambientIntensity: number;
  sunIntensity: number;
  fogColor: THREE.ColorRepresentation;
  fogNear: number;
  fogFar: number;
}

export const SKY_PRESETS: Record<string, SkyPreset> = {
  sunset: {
    topColor: 0x1c4d8f,
    horizonColor: 0xff9d5c,
    bottomColor: 0x0c1f3d,
    sunColor: 0xffb877,
    sunElevationDeg: 12,
    sunAzimuthDeg: 250,
    ambientIntensity: 0.55,
    sunIntensity: 2.6,
    fogColor: 0xffb27a,
    fogNear: 120,
    fogFar: 620,
  },
  'sunny-hazy': {
    topColor: 0x2c8fd6,
    horizonColor: 0xe7c98a,
    bottomColor: 0x123a5e,
    sunColor: 0xfff2c9,
    sunElevationDeg: 45,
    sunAzimuthDeg: 200,
    ambientIntensity: 0.7,
    sunIntensity: 3.0,
    fogColor: 0xd9b98a,
    fogNear: 140,
    fogFar: 650,
  },
  'overcast-canopy': {
    topColor: 0x4c6a5a,
    horizonColor: 0x9fb79f,
    bottomColor: 0x1c2f22,
    sunColor: 0xdfe8d0,
    sunElevationDeg: 55,
    sunAzimuthDeg: 180,
    ambientIntensity: 0.85,
    sunIntensity: 1.6,
    fogColor: 0x7f9a80,
    fogNear: 80,
    fogFar: 420,
  },
  'clear-high-altitude': {
    topColor: 0x0d6fc4,
    horizonColor: 0xbfe6ff,
    bottomColor: 0x08213f,
    sunColor: 0xffffff,
    sunElevationDeg: 60,
    sunAzimuthDeg: 220,
    ambientIntensity: 0.75,
    sunIntensity: 3.2,
    fogColor: 0xcfeeff,
    fogNear: 200,
    fogFar: 900,
  },
  'night-clear': {
    topColor: 0x040b1e,
    horizonColor: 0x1e2f52,
    bottomColor: 0x02050f,
    sunColor: 0x8fd6ff,
    sunElevationDeg: -5,
    sunAzimuthDeg: 260,
    ambientIntensity: 0.35,
    sunIntensity: 0.4,
    fogColor: 0x0c1c33,
    fogNear: 100,
    fogFar: 500,
  },
  'storm-rain-wind': {
    topColor: 0x2b3448,
    horizonColor: 0x596a7a,
    bottomColor: 0x11151f,
    sunColor: 0xc9d3dd,
    sunElevationDeg: 25,
    sunAzimuthDeg: 210,
    ambientIntensity: 0.6,
    sunIntensity: 1.1,
    fogColor: 0x4a5566,
    fogNear: 60,
    fogFar: 320,
  },
};

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly sunLight: THREE.DirectionalLight;
  readonly ambientLight: THREE.HemisphereLight;
  private readonly material: THREE.ShaderMaterial;
  private readonly sunDirection = new THREE.Vector3();

  constructor(scene: THREE.Scene, preset: SkyPreset) {
    const geometry = new THREE.SphereGeometry(1500, 24, 16);
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(preset.topColor) },
        horizonColor: { value: new THREE.Color(preset.horizonColor) },
        bottomColor: { value: new THREE.Color(preset.bottomColor) },
        sunDirection: { value: this.sunDirection },
        sunColor: { value: new THREE.Color(preset.sunColor) },
        sunSize: { value: 0.02 },
      },
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    this.sunLight = new THREE.DirectionalLight(preset.sunColor, preset.sunIntensity);
    this.sunLight.castShadow = true;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.ambientLight = new THREE.HemisphereLight(preset.topColor, preset.bottomColor, preset.ambientIntensity);
    scene.add(this.ambientLight);

    scene.fog = new THREE.Fog(preset.fogColor, preset.fogNear, preset.fogFar);

    this.applyPreset(preset);
  }

  applyPreset(preset: SkyPreset): void {
    (this.material.uniforms.topColor!.value as THREE.Color).set(preset.topColor);
    (this.material.uniforms.horizonColor!.value as THREE.Color).set(preset.horizonColor);
    (this.material.uniforms.bottomColor!.value as THREE.Color).set(preset.bottomColor);
    (this.material.uniforms.sunColor!.value as THREE.Color).set(preset.sunColor);

    const elevation = THREE.MathUtils.degToRad(preset.sunElevationDeg);
    const azimuth = THREE.MathUtils.degToRad(preset.sunAzimuthDeg);
    this.sunDirection.set(
      Math.cos(elevation) * Math.cos(azimuth),
      Math.sin(elevation),
      Math.cos(elevation) * Math.sin(azimuth),
    );
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(400);
    this.sunLight.intensity = preset.sunIntensity;
    this.sunLight.color.set(preset.sunColor);
    this.ambientLight.intensity = preset.ambientIntensity;
    this.ambientLight.color.set(preset.topColor);
    this.ambientLight.groundColor.set(preset.bottomColor);
  }

  configureShadowFrustum(halfSize: number, far: number, mapSize: number): void {
    const cam = this.sunLight.shadow.camera;
    cam.left = -halfSize;
    cam.right = halfSize;
    cam.top = halfSize;
    cam.bottom = -halfSize;
    cam.near = 1;
    cam.far = far;
    cam.updateProjectionMatrix();
    this.sunLight.shadow.mapSize.set(mapSize, mapSize);
    this.sunLight.castShadow = mapSize > 0;
  }

  followTarget(position: THREE.Vector3): void {
    this.sunLight.position.copy(this.sunDirection).multiplyScalar(200).add(position);
    this.sunLight.target.position.copy(position);
    this.sunLight.target.updateMatrixWorld();
  }
}
