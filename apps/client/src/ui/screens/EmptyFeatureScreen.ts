import type { Screen } from '../ScreenManager';
import { t } from '../../i18n';

/** Generic "requires an online connection" placeholder for backend-dependent features
 * (Events, Leaderboard, Friends) so the menu never dead-ends or fakes data that doesn't
 * exist yet — an honest empty state instead of a broken promise. */
export class EmptyFeatureScreen implements Screen {
  readonly root: HTMLDivElement;

  constructor(titleKey: string, onBack: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t(titleKey);
    header.appendChild(title);

    const empty = document.createElement('div');
    empty.className = 'vi-empty-state';
    empty.textContent = t('empty.onlineRequired');

    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', onBack);

    panel.append(header, empty, backBtn);
    this.root.appendChild(panel);
  }
}
