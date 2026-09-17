import { ScreenManager } from '../ui/ScreenManager';
import { MainMenu } from '../ui/screens/MainMenu';
import { PlayScreen } from '../ui/screens/PlayScreen';
import { Garage } from '../ui/screens/Garage';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { MissionsScreen } from '../ui/screens/MissionsScreen';
import { EmptyFeatureScreen } from '../ui/screens/EmptyFeatureScreen';
import { LoadingScreen } from '../ui/screens/LoadingScreen';
import { ResultsScreen, type RaceResultsData } from '../ui/screens/ResultsScreen';
import { Game, type RaceSetupOptions } from './Game';
import { localProfileStore } from './LocalProfileStore';
import { getTrackById } from '@velocity-island/shared';
import { t } from '../i18n';

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
        onSettings: () => this.showSettings(),
        onEmptyFeature: (key) => this.screenManager.show(new EmptyFeatureScreen(key, () => this.showMainMenu())),
      }),
    );
  }

  private showPlayScreen(): void {
    this.screenManager.show(
      new PlayScreen({
        onBack: () => this.showMainMenu(),
        onEmptyFeature: (key) => this.screenManager.show(new EmptyFeatureScreen(key, () => this.showPlayScreen())),
        onStartRace: (options) => this.startRace(options),
      }),
    );
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
    this.game.start();
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
