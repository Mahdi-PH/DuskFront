import { ScreenManager } from '../ui/ScreenManager';
import { MainMenu } from '../ui/screens/MainMenu';
import { PlayScreen } from '../ui/screens/PlayScreen';
import { Garage } from '../ui/screens/Garage';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { MissionsScreen } from '../ui/screens/MissionsScreen';
import { LeaderboardScreen } from '../ui/screens/LeaderboardScreen';
import { FriendsScreen } from '../ui/screens/FriendsScreen';
import { EmptyFeatureScreen } from '../ui/screens/EmptyFeatureScreen';
import { LoadingScreen } from '../ui/screens/LoadingScreen';
import { ResultsScreen, type RaceResultsData } from '../ui/screens/ResultsScreen';
import { Game, type RaceSetupOptions } from './Game';
import { localProfileStore } from './LocalProfileStore';
import { getTrackById } from '@velocity-island/shared';
import { t } from '../i18n';
import { authClient } from '../network/AuthClient';

/** Top-level navigation controller: owns the ScreenManager and the currently-running
 * Game instance (if any), wiring menu screens to race setup/results and back. */
export class AppShell {
  private readonly screenManager: ScreenManager;
  private game: Game | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly uiContainer: HTMLElement,
  ) {
    this.screenManager = new ScreenManager(uiContainer);
  }

  start(): void {
    this.showMainMenu();
  }

  private showMainMenu(): void {
    this.teardownGame();
    this.screenManager.show(
      new MainMenu({
        onPlay: () => this.showPlayScreen(),
        onGarage: () => this.showGarage(),
        onMissions: () => this.screenManager.show(new MissionsScreen(() => this.showMainMenu())),
        onLeaderboard: () => this.screenManager.show(new LeaderboardScreen(() => this.showMainMenu())),
        onFriends: () => this.screenManager.show(new FriendsScreen(() => this.showMainMenu())),
        onSettings: () => this.showSettings(),
        onEmptyFeature: (key) => this.screenManager.show(new EmptyFeatureScreen(key, () => this.showMainMenu())),
      }),
    );
  }

  private showPlayScreen(): void {
    this.screenManager.show(
      new PlayScreen({
        onBack: () => this.showMainMenu(),
        onStartRace: (options) => this.startRace(options),
        privateLobby: {
          onCreateRoom: (options) => this.startRace(options),
          onJoinRoom: (roomCode, vehicle) => this.joinPrivateRoom(roomCode, vehicle),
        },
      }),
    );
  }

  private async joinPrivateRoom(roomCode: string, vehicle: Pick<RaceSetupOptions, 'vehicleId' | 'colorwayId'>): Promise<void> {
    try {
      const session = await authClient.ensureSession();
      const res = await authClient.authorizedFetch(`/lobby/join/${roomCode}`);
      if (!res.ok) {
        this.screenManager.show(new EmptyFeatureScreen('play.privateLobby', () => this.showPlayScreen()));
        return;
      }
      const roomInfo = (await res.json()) as { roomId: string; trackId: string; laps: number };

      const loading = new LoadingScreen(getTrackById(roomInfo.trackId).name);
      this.screenManager.show(loading);
      loading.setProgress(30, t('loading.stageTrack'));

      this.game = await Game.create(this.canvas, this.uiContainer);
      this.game.onRaceFinished = (results) => this.showResults(results);
      this.game.onPauseToggled = (paused) => this.togglePauseOverlay(paused);
      this.game.applySettings(localProfileStore.get().settings);

      // Joining an existing room means the host already fixed the track/laps — the
      // local race must be configured to match, not to whatever this client last picked.
      this.game.startRace({
        trackId: roomInfo.trackId,
        vehicleId: vehicle.vehicleId,
        colorwayId: vehicle.colorwayId,
        laps: roomInfo.laps,
        botCount: 0,
        aiDifficulty: 'normal',
      });

      await this.game.joinOnlineRoomById(roomInfo.roomId, {
        accessToken: session.accessToken,
        vehicleId: vehicle.vehicleId,
        displayName: session.displayName,
        colorwayId: vehicle.colorwayId,
        trackId: roomInfo.trackId,
        mode: 'private',
      });

      loading.setProgress(100, t('loading.stageReady'));
      this.screenManager.hideAll();
      this.game.start();
    } catch (err) {
      console.error('Failed to join private room:', err);
      this.screenManager.show(new EmptyFeatureScreen('play.privateLobby', () => this.showPlayScreen()));
    }
  }

  private showGarage(): void {
    this.screenManager.show(new Garage({ onBack: () => this.showMainMenu() }));
  }

  private showSettings(): void {
    this.screenManager.show(
      new SettingsScreen({
        onBack: () => this.showMainMenu(),
        onSettingsChanged: (settings) => this.game?.applySettings(settings),
        onLocaleChanged: () => this.showMainMenu(),
        onResetTouchLayout: () => this.game?.resetTouchLayout(),
        onToggleTouchEditMode: (enabled) => this.game?.setTouchEditMode(enabled),
      }),
    );
  }

  private async startRace(options: RaceSetupOptions): Promise<void> {
    const loading = new LoadingScreen(getTrackById(options.trackId).name);
    this.screenManager.show(loading);
    loading.setProgress(15, t('loading.stageTrack'));

    await new Promise((resolve) => setTimeout(resolve, 60));
    this.game = await Game.create(this.canvas, this.uiContainer);
    loading.setProgress(60, t('loading.stageRacers'));

    this.game.onRaceFinished = (results) => this.showResults(results);
    this.game.onPauseToggled = (paused) => this.togglePauseOverlay(paused);
    this.game.applySettings(localProfileStore.get().settings);

    await new Promise((resolve) => setTimeout(resolve, 60));
    loading.setProgress(100, t('loading.stageReady'));
    await new Promise((resolve) => setTimeout(resolve, 200));

    this.screenManager.hideAll();
    this.game.startRace(options);

    if (options.online?.mode === 'quick' || options.online?.mode === 'ranked') {
      try {
        const session = await authClient.ensureSession();
        await this.game.enableOnlineMode({
          accessToken: session.accessToken,
          vehicleId: options.vehicleId,
          displayName: session.displayName,
          colorwayId: options.colorwayId,
          trackId: options.trackId,
          mode: options.online.mode,
          laps: options.laps,
          botCount: options.botCount,
          aiDifficulty: options.aiDifficulty,
        });
      } catch (err) {
        // Online connection failed (server unreachable, etc) — the race already
        // started locally, so fail soft and let the player keep racing offline
        // rather than losing progress on a connection hiccup.
        console.error('Online mode unavailable, continuing offline:', err);
      }
    } else if (options.online?.mode === 'private') {
      try {
        const session = await authClient.ensureSession();
        const res = await authClient.authorizedFetch('/lobby/create', {
          method: 'POST',
          body: JSON.stringify({ trackId: options.trackId, laps: options.laps, botCount: options.botCount, aiDifficulty: options.aiDifficulty }),
        });
        if (res.ok) {
          const { roomId, roomCode } = (await res.json()) as { roomId: string; roomCode: string };
          await this.game.joinOnlineRoomById(roomId, {
            accessToken: session.accessToken,
            vehicleId: options.vehicleId,
            displayName: session.displayName,
            colorwayId: options.colorwayId,
            trackId: options.trackId,
            mode: 'private',
          });
          this.showRoomCodeBanner(roomCode);
        }
      } catch (err) {
        console.error('Failed to create private room, continuing offline:', err);
      }
    }

    this.game.start();
  }

  private showRoomCodeBanner(roomCode: string): void {
    const banner = document.createElement('div');
    banner.className = 'vi-hud-network vi-glass';
    banner.style.bottom = 'auto';
    banner.style.top = '90px';
    banner.style.left = '50%';
    banner.textContent = `ROOM CODE: ${roomCode}`;
    this.uiContainer.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  private togglePauseOverlay(paused: boolean): void {
    if (paused) {
      const overlay = document.createElement('div');
      overlay.className = 'vi-menu-screen';
      overlay.style.background = 'rgba(12, 31, 61, 0.75)';
      overlay.style.zIndex = '80';
      const panel = document.createElement('div');
      panel.className = 'vi-panel vi-glass';
      panel.style.maxWidth = '360px';
      panel.style.alignItems = 'center';
      panel.style.textAlign = 'center';
      const title = document.createElement('div');
      title.className = 'vi-panel-title';
      title.textContent = t('hud.paused');
      const resumeBtn = document.createElement('button');
      resumeBtn.className = 'vi-btn';
      resumeBtn.textContent = t('hud.resume');
      resumeBtn.addEventListener('click', () => this.game?.resumeFromPause());
      const quitBtn = document.createElement('button');
      quitBtn.className = 'vi-btn vi-btn--secondary';
      quitBtn.textContent = t('hud.quit');
      quitBtn.addEventListener('click', () => this.showMainMenu());
      panel.append(title, resumeBtn, quitBtn);
      overlay.appendChild(panel);
      this.uiContainer.appendChild(overlay);
      this.pauseOverlay = overlay;
    } else {
      this.pauseOverlay?.remove();
      this.pauseOverlay = null;
    }
  }

  private showResults(results: RaceResultsData): void {
    this.pauseOverlay?.remove();
    this.pauseOverlay = null;
    this.teardownGame();
    this.screenManager.show(new ResultsScreen(results, () => this.showMainMenu()));
  }

  private teardownGame(): void {
    if (this.game) {
      this.game.dispose();
      this.game = null;
    }
  }
}
