import type { Screen } from '../ScreenManager';
import { t } from '../../i18n';
import { GAME_NAME, GAME_NAME_AR } from '@velocity-island/shared';
import { getLocale } from '../../i18n';

const TIP_KEYS = ['loading.tip1', 'loading.tip2', 'loading.tip3', 'loading.tip4', 'loading.tip5'];

/** Cinematic loading screen shown while the track/vehicles are built. Since that build
 * is synchronous and fast, progress is presented as named stages rather than a fake
 * byte-accurate percentage — still informative, never a lie. */
export class LoadingScreen implements Screen {
  readonly root: HTMLDivElement;
  private fillEl: HTMLDivElement;
  private stageEl: HTMLDivElement;

  constructor(trackName: string) {
    this.root = document.createElement('div');
    this.root.className = 'vi-loading-screen';

    const title = document.createElement('div');
    title.className = 'vi-title';
    title.style.fontSize = '28px';
    title.style.marginBottom = '6px';
    title.textContent = getLocale() === 'ar' ? GAME_NAME_AR : GAME_NAME;

    const track = document.createElement('div');
    track.style.opacity = '0.8';
    track.style.fontSize = '13px';
    track.style.letterSpacing = '0.08em';
    track.textContent = trackName.toUpperCase();

    this.stageEl = document.createElement('div');
    this.stageEl.style.fontSize = '11px';
    this.stageEl.style.marginTop = '18px';
    this.stageEl.style.opacity = '0.7';

    const barTrack = document.createElement('div');
    barTrack.className = 'vi-loading-bar-track';
    this.fillEl = document.createElement('div');
    this.fillEl.className = 'vi-loading-bar-fill';
    barTrack.appendChild(this.fillEl);

    const tip = document.createElement('div');
    tip.className = 'vi-loading-tip';
    const tipKey = TIP_KEYS[Math.floor(Math.random() * TIP_KEYS.length)]!;
    tip.textContent = t(tipKey);

    this.root.append(title, track, this.stageEl, barTrack, tip);
  }

  setProgress(pct: number, stageLabel: string): void {
    this.fillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    this.stageEl.textContent = stageLabel;
  }
}
