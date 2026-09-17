import * as THREE from 'three';

export interface MiniMapMarker {
  id: string;
  x: number;
  z: number;
  color: string;
  isLocalPlayer: boolean;
}

/** Small top-down 2D canvas minimap: draws the track's centerline once from the curve,
 * then redraws marker dots each frame. Cheap enough to run every frame at this size. */
export class MiniMap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private trackPoints: Array<{ x: number; z: number }> = [];
  private bounds = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 };
  private readonly size = 168;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.className = 'vi-minimap-canvas';
    this.ctx = this.canvas.getContext('2d')!;
  }

  setTrack(curve: THREE.CatmullRomCurve3): void {
    const samples = 100;
    this.trackPoints = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i <= samples; i++) {
      const p = curve.getPointAt(i / samples);
      this.trackPoints.push({ x: p.x, z: p.z });
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const pad = (maxX - minX) * 0.08 + 1;
    this.bounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
  }

  private project(x: number, z: number): [number, number] {
    const { minX, maxX, minZ, maxZ } = this.bounds;
    const px = ((x - minX) / (maxX - minX)) * this.size;
    const py = ((z - minZ) / (maxZ - minZ)) * this.size;
    return [px, this.size - py];
  }

  render(markers: MiniMapMarker[]): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);

    ctx.beginPath();
    this.trackPoints.forEach((p, i) => {
      const [x, y] = this.project(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(250, 246, 238, 0.85)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(47, 217, 201, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (this.trackPoints[0]) {
      const [fx, fy] = this.project(this.trackPoints[0].x, this.trackPoints[0].z);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - 2, fy - 4, 4, 8);
    }

    for (const marker of markers) {
      const [x, y] = this.project(marker.x, marker.z);
      ctx.beginPath();
      ctx.arc(x, y, marker.isLocalPlayer ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color;
      ctx.fill();
      if (marker.isLocalPlayer) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
}
