import * as THREE from 'three';

interface Particle {
  alive: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  ageSec: number;
  lifeSec: number;
  size: number;
  colorStart: THREE.Color;
  colorEnd: THREE.Color;
  gravity: number;
}

export interface ParticleSpawnOptions {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifeSec: number;
  size: number;
  colorStart: THREE.Color;
  colorEnd?: THREE.Color;
  gravity?: number;
}

/** Fixed-capacity, object-pooled point-sprite particle system. A single pre-allocated
 * pool per effect type (see EffectsManager) avoids per-frame GC churn, which matters
 * for sustained effects like tire smoke or boost trails during a full race. */
export class ParticleSystem {
  private readonly particles: Particle[];
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly sizes: Float32Array;
  readonly points: THREE.Points;
  private cursor = 0;

  constructor(
    private readonly capacity: number,
    baseSize: number,
    blending: THREE.Blending = THREE.NormalBlending,
  ) {
    this.particles = Array.from({ length: capacity }, () => ({
      alive: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      ageSec: 0,
      lifeSec: 1,
      size: baseSize,
      colorStart: new THREE.Color(),
      colorEnd: new THREE.Color(),
      gravity: 0,
    }));

    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('particleSize', new THREE.BufferAttribute(this.sizes, 1));

    // Custom shader (rather than PointsMaterial) so each particle can carry its own size
    // via a vertex attribute; the fragment shader draws a soft circular sprite procedurally,
    // so no external sprite texture is needed.
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: {
        uPixelRatio: { value: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1 },
      },
      vertexShader: /* glsl */ `
        attribute float particleSize;
        attribute vec3 color;
        uniform float uPixelRatio;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = particleSize * uPixelRatio * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - vec2(0.5);
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.0, d);
          if (alpha < 0.02) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
  }

  spawn(options: ParticleSpawnOptions): void {
    // Round-robin over the pool: oldest particle slot is recycled if the pool is full,
    // which is fine visually since it's already near the end of its life by then.
    const particle = this.particles[this.cursor]!;
    this.cursor = (this.cursor + 1) % this.capacity;

    particle.alive = true;
    particle.position.copy(options.position);
    particle.velocity.copy(options.velocity);
    particle.ageSec = 0;
    particle.lifeSec = options.lifeSec;
    particle.size = options.size;
    particle.colorStart.copy(options.colorStart);
    particle.colorEnd.copy(options.colorEnd ?? options.colorStart);
    particle.gravity = options.gravity ?? 0;
  }

  update(deltaSec: number): void {
    let anyAlive = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.particles[i]!;
      if (!p.alive) {
        this.positions[i * 3 + 1] = -9999;
        continue;
      }
      p.ageSec += deltaSec;
      if (p.ageSec >= p.lifeSec) {
        p.alive = false;
        this.positions[i * 3 + 1] = -9999;
        continue;
      }
      anyAlive = true;
      p.velocity.y -= p.gravity * deltaSec;
      p.position.addScaledVector(p.velocity, deltaSec);

      const t = p.ageSec / p.lifeSec;
      this.positions[i * 3] = p.position.x;
      this.positions[i * 3 + 1] = p.position.y;
      this.positions[i * 3 + 2] = p.position.z;

      const r = THREE.MathUtils.lerp(p.colorStart.r, p.colorEnd.r, t);
      const g = THREE.MathUtils.lerp(p.colorStart.g, p.colorEnd.g, t);
      const b = THREE.MathUtils.lerp(p.colorStart.b, p.colorEnd.b, t);
      this.colors[i * 3] = r;
      this.colors[i * 3 + 1] = g;
      this.colors[i * 3 + 2] = b;
      this.sizes[i] = p.size * (1 - t * 0.6);
    }

    this.geometry.attributes.position!.needsUpdate = true;
    this.geometry.attributes.color!.needsUpdate = true;
    this.geometry.attributes.particleSize!.needsUpdate = true;
    this.points.visible = anyAlive;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
