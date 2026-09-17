const STORAGE_KEY = 'vi-auth-v1';

export interface AuthSession {
  userId: string;
  displayName: string;
  isGuest: boolean;
  accessToken: string;
  refreshToken: string;
}

function getServerUrl(): string {
  return (import.meta.env.VITE_SERVER_HTTP_URL as string | undefined) ?? 'http://localhost:2567';
}

function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private mode — session just won't survive a reload.
  }
}

/** Talks to the server's REST auth endpoints and keeps the resulting session in
 * localStorage. Auto-creates a guest account on first use so online features work
 * without forcing registration, per the offline-fallback/guest-account requirements. */
export class AuthClient {
  private session: AuthSession | null = loadSession();

  getSession(): AuthSession | null {
    return this.session;
  }

  async ensureSession(): Promise<AuthSession> {
    if (this.session) return this.session;
    const res = await fetch(`${getServerUrl()}/auth/guest`, { method: 'POST' });
    if (!res.ok) throw new Error(`Guest auth failed: ${res.status}`);
    const data = (await res.json()) as AuthSession;
    this.session = data;
    saveSession(data);
    return data;
  }

  async register(email: string, password: string, displayName: string): Promise<AuthSession> {
    const res = await fetch(`${getServerUrl()}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!res.ok) throw new Error(`Register failed: ${res.status}`);
    const data = (await res.json()) as AuthSession;
    this.session = data;
    saveSession(data);
    return data;
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const res = await fetch(`${getServerUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = (await res.json()) as AuthSession;
    this.session = data;
    saveSession(data);
    return data;
  }

  /** Upgrades the current guest session to a full email account, keeping the same
   * userId (and therefore all progress) — calls PATCH-equivalent /auth/upgrade. */
  async upgradeToEmail(email: string, password: string, displayName: string): Promise<void> {
    if (!this.session) throw new Error('No active session to upgrade');
    const res = await fetch(`${getServerUrl()}/auth/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.session.accessToken}` },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!res.ok) throw new Error(`Upgrade failed: ${res.status}`);
    this.session = { ...this.session, isGuest: false, displayName };
    saveSession(this.session);
  }

  async refresh(): Promise<AuthSession> {
    if (!this.session) throw new Error('No session to refresh');
    const res = await fetch(`${getServerUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.session.refreshToken }),
    });
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
    const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
    this.session = { ...this.session, ...tokens };
    saveSession(this.session);
    return this.session;
  }

  /** Fetch wrapper that retries once with a refreshed access token on a 401. */
  async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const session = await this.ensureSession();
    const doFetch = (token: string) =>
      fetch(`${getServerUrl()}${path}`, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

    let res = await doFetch(session.accessToken);
    if (res.status === 401) {
      const refreshed = await this.refresh();
      res = await doFetch(refreshed.accessToken);
    }
    return res;
  }

  logout(): void {
    this.session = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore.
    }
  }
}

export const authClient = new AuthClient();
