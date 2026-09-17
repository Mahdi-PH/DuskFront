import * as THREE from 'three';
import { GameRenderer } from '../render/Renderer';
import { Sky, SKY_PRESETS, type SkyPreset } from '../render/Sky';
import { Water } from '../render/Water';
import { ChaseCamera } from '../camera/ChaseCamera';
import type { GraphicsProfile } from '../render/GraphicsSettings';

/** Owns the Three.js scene graph, renderer, sky/lighting rig and chase camera.
 * Gameplay systems add/remove objects into `scene` but don't own the render loop. */
export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly gameRenderer: GameRenderer;
  readonly chaseCamera: ChaseCamera;
  sky: Sky;
  water: Water | null = null;

  constructor(canvas: HTMLCanvasElement, profile: GraphicsProfile, skyPresetId: string) {
    this.gameRenderer = new GameRenderer(canvas, profile);
    this.chaseCamera = new ChaseCamera(window.innerWidth / window.innerHeight);
    const preset: SkyPreset = SKY_PRESETS[skyPresetId] ?? SKY_PRESETS.sunset!;
    this.sky = new Sky(this.scene, preset);
    this.sky.configureShadowFrustum(60, profile.viewDistance, profile.shadowMapSize);
    this.gameRenderer.setupPostProcessing(this.scene, this.chaseCamera.camera);
    window.addEventListener('resize', this.handleResize);
  }

  setSkyPreset(presetId: string): void {
    const preset = SKY_PRESETS[presetId] ?? SKY_PRESETS.sunset!;
    this.sky.applyPreset(preset);
    this.scene.fog = new THREE.Fog(preset.fogColor, preset.fogNear, preset.fogFar);
  }

  addWater(width: number, depth: number, position: THREE.Vector3): Water {
    const water = new Water(width, depth);
    water.mesh.position.copy(position);
    this.scene.add(water.mesh);
    this.water = water;
    return water;
  }

  private handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.chaseCamera.setAspect(width / height);
    this.gameRenderer.handleResize(width, height);
  };

  update(deltaSec: number): void {
    this.sky.followTarget(this.chaseCamera.camera.position);
    this.water?.update(deltaSec, this.chaseCamera.camera.position);
  }

  render(): void {
    this.gameRenderer.render(this.scene, this.chaseCamera.camera);
  }

  applyGraphicsProfile(profile: GraphicsProfile): void {
    this.gameRenderer.applyResolution(profile);
    this.gameRenderer.setupPostProcessing(this.scene, this.chaseCamera.camera);
    this.sky.configureShadowFrustum(60, profile.viewDistance, profile.shadowMapSize);
    this.water?.setLowSpec(!profile.reflectionsEnabled);
  }

  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
    this.gameRenderer.dispose();
  }
}
