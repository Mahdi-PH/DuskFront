import { TRACKS } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { authClient } from '../../network/AuthClient';
import { t } from '../../i18n';

type LeaderboardTab = 'global' | 'weekly' | 'friends' | 'track';

interface ScoreEntry {
  displayName: string;
  totalXp?: number;
  level?: number;
  score?: number;
}

interface TrackEntry {
  displayName: string;
  value: number;
  recordedAt: string;
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  const centis = Math.floor((totalSec * 100) % 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/** Global / Weekly / Friends / Track-record leaderboards, backed by the real
 * /leaderboard/* REST endpoints (apps/server/src/api/leaderboardRoutes.ts) — no
 * placeholder data. Friends and track records need a session, which
 * authClient.authorizedFetch auto-provisions (guest session) if needed. */
export class LeaderboardScreen implements Screen {
  readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly tabButtons: Partial<Record<LeaderboardTab, HTMLButtonElement>> = {};
  private readonly trackPicker: HTMLDivElement;
  private tab: LeaderboardTab = 'global';
  private trackId: string = TRACKS[0]!.id;
  private requestToken = 0;

  constructor(onBack: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.leaderboard');
    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', onBack);
    header.append(title, backBtn);

    const tabsRow = document.createElement('div');
    tabsRow.className = 'vi-row';
    const tabs: Array<[LeaderboardTab, string]> = [
      ['global', t('leaderboard.global')],
      ['weekly', t('leaderboard.weekly')],
      ['friends', t('leaderboard.friends')],
      ['track', t('leaderboard.trackRecords')],
    ];
    for (const [tab, label] of tabs) {
      const btn = document.createElement('button');
      btn.className = `vi-btn ${tab === this.tab ? '' : 'vi-btn--secondary'}`.trim();
      btn.textContent = label;
      btn.addEventListener('click', () => this.setTab(tab));
      this.tabButtons[tab] = btn;
      tabsRow.appendChild(btn);
    }

    this.trackPicker = document.createElement('div');
    this.trackPicker.className = 'vi-option-grid vi-hidden';
    this.renderTrackPicker();

    this.listEl = document.createElement('div');
    this.listEl.className = 'vi-leaderboard-list';

    panel.append(header, tabsRow, this.trackPicker, this.listEl);
    this.root.appendChild(panel);

    void this.load();
  }

  private setTab(tab: LeaderboardTab): void {
    if (tab === this.tab) return;
    this.tab = tab;
    for (const [key, btn] of Object.entries(this.tabButtons)) {
      btn!.classList.toggle('vi-btn--secondary', key !== tab);
    }
    this.trackPicker.classList.toggle('vi-hidden', tab !== 'track');
    void this.load();
  }

  private renderTrackPicker(): void {
    this.trackPicker.innerHTML = '';
    for (const track of TRACKS) {
      const card = document.createElement('div');
      card.className = `vi-option-card${track.id === this.trackId ? ' vi-option-card--selected' : ''}`;
      card.textContent = track.name;
      card.addEventListener('click', () => {
        this.trackId = track.id;
        this.renderTrackPicker();
        void this.load();
      });
      this.trackPicker.appendChild(card);
    }
  }

  private async load(): Promise<void> {
    const token = ++this.requestToken;
    this.listEl.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'vi-empty-state';
    loading.textContent = t('common.loading');
    this.listEl.appendChild(loading);

    try {
      const path =
        this.tab === 'track' ? `/leaderboard/track/${encodeURIComponent(this.trackId)}` : `/leaderboard/${this.tab}`;
      const res = await authClient.authorizedFetch(path);
      if (token !== this.requestToken) return;
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as ScoreEntry[] | TrackEntry[];
      this.renderRows(data);
    } catch {
      if (token !== this.requestToken) return;
      this.renderError();
    }
  }

  private renderError(): void {
    this.listEl.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'vi-empty-state';
    empty.textContent = t('common.loadFailed');
    const retryBtn = document.createElement('button');
    retryBtn.className = 'vi-btn vi-btn--secondary';
    retryBtn.style.marginTop = '12px';
    retryBtn.textContent = t('common.retry');
    retryBtn.addEventListener('click', () => void this.load());
    this.listEl.append(empty, retryBtn);
  }

  private renderRows(entries: ScoreEntry[] | TrackEntry[]): void {
    this.listEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'vi-empty-state';
      empty.textContent = t('common.noData');
      this.listEl.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'vi-leaderboard-row';

      const rank = document.createElement('div');
      rank.className = 'vi-leaderboard-row__rank';
      rank.textContent = String(index + 1);

      const name = document.createElement('div');
      name.className = 'vi-leaderboard-row__name';
      name.textContent = entry.displayName;

      const value = document.createElement('div');
      value.className = 'vi-leaderboard-row__value';
      if (this.tab === 'track') {
        value.textContent = formatTime((entry as TrackEntry).value);
      } else if (this.tab === 'weekly') {
        value.textContent = String((entry as ScoreEntry).score ?? 0);
      } else {
        const e = entry as ScoreEntry;
        value.textContent = `${t('leaderboard.level', { level: e.level ?? 1 })} · ${(e.totalXp ?? 0).toLocaleString()}`;
      }

      row.append(rank, name, value);
      this.listEl.appendChild(row);
    });
  }
}
