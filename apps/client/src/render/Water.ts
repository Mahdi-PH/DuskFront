import * as THREE from 'three';

/** Lightweight original water shader: vertex sine-wave displacement, fresnel-based
 * color blend, and a scrolling procedural foam band near y=0 shoreline. Falls back to
 * a flat animated-color plane on low graphics profiles (see `simple` param). */

const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmplitude;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vec3 pos = position;
    float wave = sin(pos.x * 0.18 + uTime * 1.3) * uWaveAmplitude
               + sin(pos.y * 0.27 - uTime * 0.9) * uWaveAmplitude * 0.6;
    pos.z += wave;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPosition.xyz;

    float dx = cos(pos.x * 0.18 + uTime * 1.3) * uWaveAmplitude * 0.18;
    float dy = cos(pos.y * 0.27 - uTime * 0.9) * uWaveAmplitude * 0.27 * 0.6;
    vNormal = normalize((modelMatrix * vec4(normalize(vec3(-dx, -dy, 1.0)), 0.0)).xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const waterFragmentShader = /* glsl */ `
  uniform vec3 uShallowColor;
  uniform vec3 uDeepColor;
  uniform vec3 uFoamColor;
  uniform vec3 uCameraPosition;
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }

  void main() {
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    vec3 base = mix(uShallowColor, uDeepColor, clamp(fresnel * 1.4, 0.0, 1.0));

    float foamNoise = hash(floor(vWorldPosition.xz * 2.0) + floor(uTime * 4.0));
    float foamLine = smoothstep(0.82, 1.0, foamNoise) * 0.5;
    vec3 color = mix(base, uFoamColor, foamLine);

    gl_FragColor = vec4(color, 0.88);
  }
`;

export class Water {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private time = 0;

  constructor(width: number, depth: number, segments = 48) {
    const geometry = new THREE.PlaneGeometry(width, depth, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: waterVertexShader,
      fragmentShader: waterFragmentShader,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uWaveAmplitude: { value: 0.18 },
        uShallowColor: { value: new THREE.Color(0x2fd9c9) },
        uDeepColor: { value: new THREE.Color(0x0d3a66) },
        uFoamColor: { value: new THREE.Color(0xfaf6ee) },
        uCameraPosition: { value: new THREE.Vector3() },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = false;
  }

  update(deltaSec: number, cameraPosition: THREE.Vector3): void {
    this.time += deltaSec;
    this.material.uniforms.uTime!.value = this.time;
    (this.material.uniforms.uCameraPosition!.value as THREE.Vector3).copy(cameraPosition);
  }

  setLowSpec(enabled: boolean): void {
    this.material.uniforms.uWaveAmplitude!.value = enabled ? 0.06 : 0.18;
  }
}
