import type { Screen } from '../ScreenManager';
import { authClient } from '../../network/AuthClient';
import { t } from '../../i18n';

interface FriendEntry {
  friendshipId: string;
  status: 'pending' | 'accepted';
  isIncoming: boolean;
  profile: { userId: string; displayName: string; level: number } | null;
}

interface SearchResult {
  userId: string;
  displayName: string;
  level: number;
}

/** Friends list + search/request/accept, backed by the real /friends/* REST endpoints
 * (apps/server/src/api/friendsRoutes.ts). Requires an account (not a bare guest) to send
 * requests server-side, since guests have no stable, findable display name yet. */
export class FriendsScreen implements Screen {
  readonly root: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly searchInput: HTMLInputElement;
  private readonly searchResultsEl: HTMLDivElement;
  private searchToken = 0;

  constructor(onBack: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.friends');
    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', onBack);
    header.append(title, backBtn);

    const searchRow = document.createElement('div');
    searchRow.className = 'vi-row';
    this.searchInput = document.createElement('input');
    this.searchInput.className = 'vi-slider';
    this.searchInput.placeholder = t('friends.searchPlaceholder');
    this.searchInput.addEventListener('input', () => this.search());
    searchRow.appendChild(this.searchInput);

    this.searchResultsEl = document.createElement('div');
    this.searchResultsEl.className = 'vi-leaderboard-list';

    const listTitle = document.createElement('div');
    listTitle.className = 'vi-settings-section__title';
    listTitle.textContent = t('friends.yourFriends');

    this.listEl = document.createElement('div');
    this.listEl.className = 'vi-leaderboard-list';

    panel.append(header, searchRow, this.searchResultsEl, listTitle, this.listEl);
    this.root.appendChild(panel);

    void this.loadFriends();
  }

  private search(): void {
    const query = this.searchInput.value.trim();
    const token = ++this.searchToken;
    this.searchResultsEl.innerHTML = '';
    if (query.length < 2) return;

    void authClient
      .authorizedFetch(`/friends/search?q=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? (res.json() as Promise<SearchResult[]>) : Promise.reject(new Error(String(res.status)))))
      .then((results) => {
        if (token !== this.searchToken) return;
        this.searchResultsEl.innerHTML = '';
        for (const result of results) {
          this.searchResultsEl.appendChild(this.buildSearchRow(result));
        }
      })
      .catch(() => {
        if (token !== this.searchToken) return;
        this.searchResultsEl.innerHTML = '';
      });
  }

  private buildSearchRow(result: SearchResult): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'vi-leaderboard-row';

    const name = document.createElement('div');
    name.className = 'vi-leaderboard-row__name';
    name.textContent = `${result.displayName} · ${t('leaderboard.level', { level: result.level })}`;

    const addBtn = document.createElement('button');
    addBtn.className = 'vi-btn vi-btn--secondary';
    addBtn.textContent = t('friends.addFriend');
    addBtn.addEventListener('click', () => {
      addBtn.disabled = true;
      void authClient
        .authorizedFetch('/friends/request', {
          method: 'POST',
          body: JSON.stringify({ displayName: result.displayName }),
        })
        .then((res) => {
          if (res.ok) {
            addBtn.textContent = t('friends.requestSent');
            void this.loadFriends();
          } else {
            addBtn.disabled = false;
          }
        })
        .catch(() => {
          addBtn.disabled = false;
        });
    });

    row.append(name, addBtn);
    return row;
  }

  private async loadFriends(): Promise<void> {
    this.listEl.innerHTML = '';
    try {
      const res = await authClient.authorizedFetch('/friends');
      if (!res.ok) throw new Error(String(res.status));
      const entries = (await res.json()) as FriendEntry[];
      this.renderFriends(entries);
    } catch {
      const empty = document.createElement('div');
      empty.className = 'vi-empty-state';
      empty.textContent = t('common.loadFailed');
      this.listEl.appendChild(empty);
    }
  }

  private renderFriends(entries: FriendEntry[]): void {
    this.listEl.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'vi-empty-state';
      empty.textContent = t('friends.empty');
      this.listEl.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const row = document.createElement('div');
      row.className = 'vi-leaderboard-row';

      const name = document.createElement('div');
      name.className = 'vi-leaderboard-row__name';
      const displayName = entry.profile?.displayName ?? t('friends.unknownPlayer');
      const levelSuffix = entry.profile ? ` · ${t('leaderboard.level', { level: entry.profile.level })}` : '';
      name.textContent = displayName + levelSuffix;

      const actions = document.createElement('div');
      actions.className = 'vi-row';

      if (entry.status === 'pending' && entry.isIncoming) {
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'vi-btn';
        acceptBtn.textContent = t('friends.accept');
        acceptBtn.addEventListener('click', () => {
          void authClient
            .authorizedFetch('/friends/accept', { method: 'POST', body: JSON.stringify({ friendshipId: entry.friendshipId }) })
            .then(() => this.loadFriends());
        });
        actions.appendChild(acceptBtn);
      } else if (entry.status === 'pending') {
        const pending = document.createElement('div');
        pending.className = 'vi-leaderboard-row__value';
        pending.textContent = t('friends.pending');
        actions.appendChild(pending);
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'vi-btn vi-btn--secondary';
      removeBtn.textContent = t('friends.remove');
      removeBtn.addEventListener('click', () => {
        void authClient.authorizedFetch(`/friends/${entry.friendshipId}`, { method: 'DELETE' }).then(() => this.loadFriends());
      });
      actions.appendChild(removeBtn);

      row.append(name, actions);
      this.listEl.appendChild(row);
    }
  }
}
