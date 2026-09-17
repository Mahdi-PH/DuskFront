import './ui/theme.css';
import './ui/touch-controls.css';
import './ui/race-hud.css';
import { initI18n } from './i18n';
import { Game } from './game/Game';

async function bootstrap(): Promise<void> {
  initI18n();

  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const app = document.getElementById('app') as HTMLElement;

  const game = await Game.create(canvas, app);
  game.startRace({
    trackId: 'sunset-bay',
    vehicleId: 'wave',
    colorwayId: 'ocean-blue',
    laps: 3,
    botCount: 7,
    aiDifficulty: 'normal',
  });
  game.start();

  window.addEventListener('beforeunload', () => game.dispose());
}

bootstrap().catch((err) => {
  console.error('Failed to start Velocity Island', err);
  const app = document.getElementById('app');
  if (app) {
    const fallback = document.createElement('div');
    fallback.id = 'boot-fallback';
    fallback.textContent = 'Failed to start the game. Please check the console for details.';
    app.appendChild(fallback);
  }
});
