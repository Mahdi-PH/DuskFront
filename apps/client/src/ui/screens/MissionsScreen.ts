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

    const achievementsTitle = document.createElement('div');
    achievementsTitle.className = 'vi-settings-section__title';
    achievementsTitle.style.marginTop = '16px';
    achievementsTitle.textContent = t('menu.achievements');
    panel.appendChild(achievementsTitle);

    const achievements = localProfileStore.getAchievementsProgress();
    for (const achievement of achievements) {
      const row = document.createElement('div');
      row.className = `vi-option-card${achievement.unlocked ? ' vi-option-card--selected' : ''}`;
      row.style.cursor = 'default';

      const titleRow = document.createElement('div');
      titleRow.className = 'vi-row vi-row--spread';
      const name = document.createElement('div');
      name.className = 'vi-option-card__title';
      name.textContent = t(achievement.nameKey);
      const progressLabel = document.createElement('div');
      progressLabel.className = 'vi-option-card__subtitle';
      progressLabel.textContent = achievement.unlocked ? '✓' : `${achievement.progress}/${achievement.target}`;
      titleRow.append(name, progressLabel);

      const desc = document.createElement('div');
      desc.className = 'vi-option-card__subtitle';
      desc.textContent = t(achievement.descKey);

      const barTrack = document.createElement('div');
      barTrack.className = 'vi-stat-row__bar';
      barTrack.style.marginTop = '6px';
      const fill = document.createElement('div');
      fill.className = 'vi-stat-row__fill';
      fill.style.width = `${Math.min(100, (achievement.progress / achievement.target) * 100)}%`;
      barTrack.appendChild(fill);

      row.append(titleRow, desc, barTrack);
      panel.appendChild(row);
    }

    this.root.appendChild(panel);
  }
}
