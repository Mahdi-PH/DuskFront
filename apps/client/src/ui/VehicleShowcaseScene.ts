import * as THREE from 'three';
import type { VehicleDefinition } from '@velocity-island/shared';
import { buildVehicleModel, type VehicleModel } from '../vehicles/VehicleModelBuilder';

/** A small standalone Three.js scene that renders one vehicle on a turntable —
 * shared by the Main Menu backdrop (idle, auto-rotating, camera parked on a coastal
 * strip) and the Garage (interactive drag-to-rotate + colorway swapping). Deliberately
 * independent of SceneManager/PhysicsWorld since it never needs physics. */
export class VehicleShowcaseScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private model: VehicleModel | null = null;
  private autoRotate = true;
  private dragRotationY = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private timeSec = 0;
  private rafHandle: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 1.6, 5.4);
    this.camera.lookAt(0, 0.4, 0);

    const key = new THREE.DirectionalLight(0xfff2df, 2.4);
    key.position.set(4, 6, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x2fd9c9, 1.1);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0x1e6fb8, 0x0c1f3d, 0.6));

    const platformGeo = new THREE.CylinderGeometry(2.4, 2.6, 0.2, 48);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x123153, roughness: 0.4, metalness: 0.5 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.15;
    this.scene.add(platform);
    const ringGeo = new THREE.TorusGeometry(2.4, 0.03, 8, 64);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2fd9c9, emissive: 0x2fd9c9, emissiveIntensity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.04;
    this.scene.add(ring);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  setVehicle(definition: VehicleDefinition, colorwayId: string): void {
    if (this.model) this.scene.remove(this.model.root);
    this.model = buildVehicleModel(definition, colorwayId);
    this.model.root.position.y = 0;
    this.scene.add(this.model.root);
  }

  setAutoRotate(enabled: boolean): void {
    this.autoRotate = enabled;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.isDragging = true;
    this.lastPointerX = e.clientX;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    this.dragRotationY += dx * 0.01;
  };
  private onPointerUp = (): void => {
    this.isDragging = false;
  };

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    const loop = () => {
      this.rafHandle = requestAnimationFrame(loop);
      this.timeSec += 1 / 60;
      if (this.model) {
        if (this.autoRotate && !this.isDragging) this.dragRotationY += 0.0045;
        this.model.root.rotation.y = this.dragRotationY;
        this.model.root.position.y = Math.sin(this.timeSec * 1.4) * 0.03;
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
  }

  dispose(): void {
    this.stop();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.dispose();
  }
}
