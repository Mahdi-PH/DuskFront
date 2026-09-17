import type { Screen } from '../ScreenManager';
import { t } from '../../i18n';

export interface RaceResultsData {
  position: number;
  totalRacers: number;
  totalTimeMs: number;
  laps: number;
  driftDistanceMeters: number;
  powerUpsUsed: number;
  xpEarned: number;
  coinsEarned: number;
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = (totalSec % 60).toFixed(2);
  return `${minutes}:${seconds.padStart(5, '0')}`;
}

export class ResultsScreen implements Screen {
  readonly root: HTMLDivElement;

  constructor(data: RaceResultsData, onContinue: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.style.textAlign = 'center';
    title.textContent = t('results.title');

    const position = document.createElement('div');
    position.className = 'vi-results-position';
    position.textContent = `${data.position}/${data.totalRacers}`;

    const grid = document.createElement('div');
    grid.className = 'vi-results-grid';
    const stats: Array<[string, string]> = [
      [t('results.time'), formatTime(data.totalTimeMs)],
      [t('results.laps'), String(data.laps)],
      [t('results.driftDistance'), `${Math.round(data.driftDistanceMeters)}m`],
      [t('results.powerUpsUsed'), String(data.powerUpsUsed)],
      [t('results.xp'), `+${data.xpEarned}`],
      [t('results.coins'), `+${data.coinsEarned}`],
    ];
    for (const [label, value] of stats) {
      const card = document.createElement('div');
      card.className = 'vi-results-stat';
      const valueEl = document.createElement('div');
      valueEl.className = 'vi-results-stat__value';
      valueEl.textContent = value;
      const labelEl = document.createElement('div');
      labelEl.className = 'vi-results-stat__label';
      labelEl.textContent = label;
      card.append(valueEl, labelEl);
      grid.appendChild(card);
    }

    const continueBtn = document.createElement('button');
    continueBtn.className = 'vi-btn vi-btn--accent';
    continueBtn.textContent = t('results.continue');
    continueBtn.addEventListener('click', onContinue);

    panel.append(title, position, grid, continueBtn);
    this.root.appendChild(panel);
  }
}
