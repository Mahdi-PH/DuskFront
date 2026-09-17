import './ui/theme.css';
import './ui/touch-controls.css';
import './ui/race-hud.css';
import './ui/menu-screens.css';
import { initI18n } from './i18n';
import { AppShell } from './game/AppShell';

function bootstrap(): void {
  initI18n();

  const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
  const app = document.getElementById('app') as HTMLElement;

  const shell = new AppShell(canvas, app);
  shell.start();
}

try {
  bootstrap();
} catch (err) {
  console.error('Failed to start Velocity Island', err);
  const app = document.getElementById('app');
  if (app) {
    const fallback = document.createElement('div');
    fallback.id = 'boot-fallback';
    fallback.textContent = 'Failed to start the game. Please check the console for details.';
    app.appendChild(fallback);
  }
}
