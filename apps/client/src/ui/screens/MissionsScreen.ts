import type { Screen } from '../ScreenManager';
import { localProfileStore } from '../../game/LocalProfileStore';
import { t } from '../../i18n';

export class MissionsScreen implements Screen {
  readonly root: HTMLDivElement;

  constructor(onBack: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.missions');
    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', onBack);
    header.append(title, backBtn);
    panel.appendChild(header);

    const missions = localProfileStore.getTodaysMissions();
    for (const mission of missions) {
      const row = document.createElement('div');
      row.className = 'vi-option-card';
      row.style.cursor = 'default';

      const titleRow = document.createElement('div');
      titleRow.className = 'vi-row vi-row--spread';
      const desc = document.createElement('div');
      desc.className = 'vi-option-card__title';
      desc.textContent = t(mission.descriptionKey, { target: mission.target });
      const reward = document.createElement('div');
      reward.className = 'vi-option-card__subtitle';
      reward.textContent = t('common.rewardSummary', { coins: mission.rewardCoins, xp: mission.rewardXp });
      titleRow.append(desc, reward);

      const barTrack = document.createElement('div');
      barTrack.className = 'vi-stat-row__bar';
      barTrack.style.marginTop = '8px';
      const fill = document.createElement('div');
      fill.className = 'vi-stat-row__fill';
      const pct = Math.min(100, (mission.progress / mission.target) * 100);
      fill.style.width = `${pct}%`;
      barTrack.appendChild(fill);

      row.append(titleRow, barTrack);
      panel.appendChild(row);
    }

    this.root.appendChild(panel);
  }
}
