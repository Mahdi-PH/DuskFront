import { GAME_NAME, GAME_NAME_AR, VISUAL_IDENTITY, getVehicleById } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { VehicleShowcaseScene } from '../VehicleShowcaseScene';
import { localProfileStore } from '../../game/LocalProfileStore';
import { t, getLocale } from '../../i18n';

export interface MainMenuCallbacks {
  onPlay(): void;
  onGarage(): void;
  onMissions(): void;
  onSettings(): void;
  onEmptyFeature(titleKey: string): void;
}

export class MainMenu implements Screen {
  readonly root: HTMLDivElement;
  private showcase: VehicleShowcaseScene | null = null;
  private canvas: HTMLCanvasElement;
  private resizeHandler = () => this.handleResize();

  constructor(callbacks: MainMenuCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'vi-menu-showcase-canvas';
    this.root.appendChild(this.canvas);

    const content = document.createElement('div');
    content.className = 'vi-menu-content';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'vi-menu-eyebrow';
    eyebrow.textContent = VISUAL_IDENTITY;

    const title = document.createElement('div');
    title.className = 'vi-menu-title vi-title';
    title.textContent = getLocale() === 'ar' ? GAME_NAME_AR : GAME_NAME;

    const nav = document.createElement('div');
    nav.className = 'vi-menu-nav';
    const navItems: Array<[string, () => void, boolean]> = [
      [t('menu.play'), () => callbacks.onPlay(), true],
      [t('menu.garage'), () => callbacks.onGarage(), true],
      [t('menu.events'), () => callbacks.onEmptyFeature('menu.events'), false],
      [t('menu.missions'), () => callbacks.onMissions(), true],
      [t('menu.leaderboard'), () => callbacks.onEmptyFeature('menu.leaderboard'), false],
      [t('menu.friends'), () => callbacks.onEmptyFeature('menu.friends'), false],
      [t('menu.settings'), () => callbacks.onSettings(), true],
    ];
    for (const [label, handler, primary] of navItems) {
      const btn = document.createElement('button');
      btn.className = `vi-btn ${primary ? '' : 'vi-btn--secondary'}`.trim();
      btn.textContent = label;
      btn.addEventListener('click', handler);
      nav.appendChild(btn);
    }

    content.append(eyebrow, title, nav);
    this.root.appendChild(content);

    window.addEventListener('resize', this.resizeHandler);
  }

  onShow(): void {
    this.showcase = new VehicleShowcaseScene(this.canvas);
    const profile = localProfileStore.get();
    this.showcase.setVehicle(getVehicleById(profile.selectedVehicleId), profile.selectedColorwayId);
    this.showcase.setAutoRotate(true);
    this.handleResize();
    this.showcase.start();
  }

  onHide(): void {
    this.showcase?.dispose();
    this.showcase = null;
  }

  private handleResize(): void {
    this.showcase?.resize(this.root.clientWidth, this.root.clientHeight);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.showcase?.dispose();
  }
}
