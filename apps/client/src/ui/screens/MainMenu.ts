import { GAME_NAME, GAME_NAME_AR, VISUAL_IDENTITY, getVehicleById } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { VehicleShowcaseScene } from '../VehicleShowcaseScene';
import { localProfileStore } from '../../game/LocalProfileStore';
import { t, getLocale } from '../../i18n';

export interface MainMenuCallbacks {
  onPlay(): void;
  onGarage(): void;
  onMissions(): void;
  onLeaderboard(): void;
  onFriends(): void;
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

    this.root.appendChild(this.buildTopBar(callbacks));

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
      [t('menu.leaderboard'), () => callbacks.onLeaderboard(), true],
      [t('menu.friends'), () => callbacks.onFriends(), true],
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

  private buildTopBar(callbacks: MainMenuCallbacks): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'vi-menu-topbar';

    const profile = localProfileStore.get();
    const levelInfo = localProfileStore.getLevelInfo();

    const identity = document.createElement('div');
    identity.className = 'vi-menu-topbar__identity';

    const avatar = document.createElement('div');
    avatar.className = 'vi-menu-topbar__avatar';
    avatar.textContent = profile.displayName.slice(0, 1).toUpperCase();
    const levelBadge = document.createElement('div');
    levelBadge.className = 'vi-menu-topbar__level-badge';
    levelBadge.textContent = String(levelInfo.level);
    avatar.appendChild(levelBadge);

    const nameCol = document.createElement('div');
    nameCol.className = 'vi-menu-topbar__name-col';
    const nameEl = document.createElement('div');
    nameEl.className = 'vi-menu-topbar__name';
    nameEl.textContent = profile.displayName;
    const xpTrack = document.createElement('div');
    xpTrack.className = 'vi-menu-topbar__xp-track';
    const xpFill = document.createElement('div');
    xpFill.className = 'vi-menu-topbar__xp-fill';
    xpFill.style.width = `${Math.min(100, (levelInfo.xpIntoLevel / levelInfo.xpForNextLevel) * 100)}%`;
    xpTrack.appendChild(xpFill);
    nameCol.append(nameEl, xpTrack);

    identity.append(avatar, nameCol);

    const actions = document.createElement('div');
    actions.className = 'vi-menu-topbar__actions';

    const coinsPill = document.createElement('div');
    coinsPill.className = 'vi-menu-topbar__pill';
    const coinsIcon = document.createElement('span');
    coinsIcon.className = 'vi-menu-topbar__coin-icon';
    const coinsValue = document.createElement('span');
    coinsValue.textContent = profile.coins.toLocaleString(getLocale() === 'ar' ? 'ar-EG' : 'en-US');
    coinsPill.append(coinsIcon, coinsValue);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'vi-menu-topbar__icon-btn';
    settingsBtn.setAttribute('aria-label', t('menu.settings'));
    settingsBtn.textContent = '⚙';
    settingsBtn.addEventListener('click', () => callbacks.onSettings());

    actions.append(coinsPill, settingsBtn);
    bar.append(identity, actions);
    return bar;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.showcase?.dispose();
  }
}
