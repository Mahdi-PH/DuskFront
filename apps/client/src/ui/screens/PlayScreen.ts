import { TRACKS, type AIDifficulty } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import type { RaceSetupOptions } from '../../game/Game';
import { localProfileStore } from '../../game/LocalProfileStore';
import { t } from '../../i18n';

export interface PlayScreenCallbacks {
  onStartRace(options: RaceSetupOptions): void;
  onBack(): void;
  onEmptyFeature(titleKey: string): void;
}

const DIFFICULTIES: AIDifficulty[] = ['easy', 'normal', 'hard', 'expert'];

export class PlayScreen implements Screen {
  readonly root: HTMLDivElement;
  private selectedTrackId = TRACKS[0]!.id;
  private laps = 3;
  private bots = 7;
  private difficulty: AIDifficulty = 'normal';
  private trackGrid: HTMLDivElement;
  private difficultyGrid!: HTMLDivElement;

  constructor(callbacks: PlayScreenCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.play');
    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', callbacks.onBack);
    header.append(title, backBtn);

    const modeRow = document.createElement('div');
    modeRow.className = 'vi-row';
    const modes: Array<[string, () => void]> = [
      [t('play.quickRace'), () => {}],
      [t('play.training'), () => {}],
      [t('play.ranked'), () => callbacks.onEmptyFeature('play.ranked')],
      [t('play.privateLobby'), () => callbacks.onEmptyFeature('play.privateLobby')],
    ];
    modes.forEach(([label, handler], i) => {
      const btn = document.createElement('button');
      btn.className = `vi-btn ${i === 0 ? '' : 'vi-btn--secondary'}`.trim();
      btn.textContent = label;
      btn.addEventListener('click', handler);
      modeRow.appendChild(btn);
    });

    const trackLabel = document.createElement('div');
    trackLabel.className = 'vi-field-label';
    trackLabel.textContent = t('play.selectTrack');
    this.trackGrid = document.createElement('div');
    this.trackGrid.className = 'vi-option-grid';
    this.renderTrackGrid();

    const configRow = document.createElement('div');
    configRow.className = 'vi-row vi-row--spread';

    const lapsField = this.buildStepper(t('play.laps'), 1, 5, this.laps, (v) => {
      this.laps = v;
    });

    const botsField = this.buildStepper(t('play.bots'), 0, 7, this.bots, (v) => {
      this.bots = v;
    });

    configRow.append(lapsField.el, botsField.el);

    const difficultyLabel = document.createElement('div');
    difficultyLabel.className = 'vi-field-label';
    difficultyLabel.textContent = t('play.difficulty');
    this.difficultyGrid = document.createElement('div');
    this.difficultyGrid.className = 'vi-option-grid';
    this.renderDifficultyGrid();

    const startBtn = document.createElement('button');
    startBtn.className = 'vi-btn vi-btn--accent';
    startBtn.textContent = t('play.start');
    startBtn.addEventListener('click', () => {
      const profile = localProfileStore.get();
      callbacks.onStartRace({
        trackId: this.selectedTrackId,
        vehicleId: profile.selectedVehicleId,
        colorwayId: profile.selectedColorwayId,
        laps: this.laps,
        botCount: this.bots,
        aiDifficulty: this.difficulty,
      });
    });

    panel.append(header, modeRow, trackLabel, this.trackGrid, configRow, difficultyLabel, this.difficultyGrid, startBtn);
    this.root.appendChild(panel);
  }

  private renderTrackGrid(): void {
    this.trackGrid.innerHTML = '';
    for (const track of TRACKS) {
      const card = document.createElement('div');
      card.className = `vi-option-card${track.id === this.selectedTrackId ? ' vi-option-card--selected' : ''}`;
      const titleEl = document.createElement('div');
      titleEl.className = 'vi-option-card__title';
      titleEl.textContent = track.name;
      const subEl = document.createElement('div');
      subEl.className = 'vi-option-card__subtitle';
      subEl.textContent = track.environment.replace(/-/g, ' ');
      card.append(titleEl, subEl);
      card.addEventListener('click', () => {
        this.selectedTrackId = track.id;
        this.renderTrackGrid();
      });
      this.trackGrid.appendChild(card);
    }
  }

  private renderDifficultyGrid(): void {
    this.difficultyGrid.innerHTML = '';
    for (const difficulty of DIFFICULTIES) {
      const card = document.createElement('div');
      card.className = `vi-option-card${difficulty === this.difficulty ? ' vi-option-card--selected' : ''}`;
      card.textContent = difficulty.toUpperCase();
      card.addEventListener('click', () => {
        this.difficulty = difficulty;
        this.renderDifficultyGrid();
      });
      this.difficultyGrid.appendChild(card);
    }
  }

  private buildStepper(
    label: string,
    min: number,
    max: number,
    initial: number,
    onChange: (value: number) => void,
  ): { el: HTMLDivElement; valueEl: HTMLSpanElement } {
    const wrapper = document.createElement('div');
    const labelEl = document.createElement('div');
    labelEl.className = 'vi-field-label';
    labelEl.textContent = label;
    const stepper = document.createElement('div');
    stepper.className = 'vi-stepper';
    const minus = document.createElement('button');
    minus.className = 'vi-stepper__btn';
    minus.textContent = '−';
    const valueEl = document.createElement('span');
    valueEl.className = 'vi-stepper__value';
    let value = initial;
    valueEl.textContent = String(value);
    const plus = document.createElement('button');
    plus.className = 'vi-stepper__btn';
    plus.textContent = '+';
    minus.addEventListener('click', () => {
      value = Math.max(min, value - 1);
      valueEl.textContent = String(value);
      onChange(value);
    });
    plus.addEventListener('click', () => {
      value = Math.min(max, value + 1);
      valueEl.textContent = String(value);
      onChange(value);
    });
    stepper.append(minus, valueEl, plus);
    wrapper.append(labelEl, stepper);
    return { el: wrapper, valueEl };
  }
}
