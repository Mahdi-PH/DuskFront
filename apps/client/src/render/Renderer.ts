import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import type { GraphicsProfile } from './GraphicsSettings';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private fxaaPass: ShaderPass | null = null;
  private profile: GraphicsProfile;

  constructor(canvas: HTMLCanvasElement, profile: GraphicsProfile) {
    this.profile = profile;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: profile.antialias,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = profile.shadowsEnabled;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.applyResolution(profile);
  }

  applyResolution(profile: GraphicsProfile): void {
    this.profile = profile;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2) * profile.resolutionScale;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = profile.shadowsEnabled;
  }

  setupPostProcessing(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.composer?.dispose();
    if (!this.profile.postProcessingEnabled) {
      this.composer = null;
      return;
    }
    const composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(scene, camera);
    composer.addPass(this.renderPass);

    if (this.profile.bloomEnabled) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.6, 0.86);
      composer.addPass(this.bloomPass);
    }

    if (this.profile.antialias) {
      this.fxaaPass = new ShaderPass(FXAAShader);
      composer.addPass(this.fxaaPass);
    }

    this.composer = composer;
    this.handleResize(window.innerWidth, window.innerHeight);
  }

  handleResize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    if (this.fxaaPass) {
      const pixelRatio = this.renderer.getPixelRatio();
      (this.fxaaPass.material.uniforms.resolution!.value as THREE.Vector2).set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio),
      );
    }
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  setBoostBloomStrength(strength: number): void {
    if (this.bloomPass) this.bloomPass.strength = 0.35 + strength * 0.55;
  }

  dispose(): void {
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
