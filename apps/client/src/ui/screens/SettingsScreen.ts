import { GRAPHICS_QUALITY_LEVELS, SUPPORTED_LOCALES, type SupportedLocale } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { localProfileStore, type LocalSettings } from '../../game/LocalProfileStore';
import { t, setLocale } from '../../i18n';

export interface SettingsScreenCallbacks {
  onBack(): void;
  onSettingsChanged(settings: LocalSettings): void;
  onLocaleChanged(): void;
  onResetTouchLayout(): void;
  onToggleTouchEditMode(enabled: boolean): void;
}

function buildToggle(initial: boolean, onChange: (value: boolean) => void): HTMLDivElement {
  const toggle = document.createElement('div');
  toggle.className = `vi-toggle${initial ? ' vi-toggle--on' : ''}`;
  const knob = document.createElement('div');
  knob.className = 'vi-toggle__knob';
  toggle.appendChild(knob);
  let value = initial;
  toggle.addEventListener('click', () => {
    value = !value;
    toggle.classList.toggle('vi-toggle--on', value);
    onChange(value);
  });
  return toggle;
}

function buildSlider(initial: number, onChange: (value: number) => void): HTMLInputElement {
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'vi-slider';
  slider.min = '0';
  slider.max = '1';
  slider.step = '0.05';
  slider.value = String(initial);
  slider.addEventListener('input', () => onChange(parseFloat(slider.value)));
  return slider;
}

export class SettingsScreen implements Screen {
  readonly root: HTMLDivElement;
  private touchEditMode = false;

  constructor(private readonly callbacks: SettingsScreenCallbacks) {
    const settings = localProfileStore.get().settings;

    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.settings');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'vi-btn vi-btn--secondary';
    closeBtn.textContent = t('settings.close');
    closeBtn.addEventListener('click', callbacks.onBack);
    header.append(title, closeBtn);
    panel.appendChild(header);

    panel.appendChild(this.buildGraphicsSection(settings));
    panel.appendChild(this.buildAudioSection(settings));
    panel.appendChild(this.buildLanguageSection());
    panel.appendChild(this.buildAccessibilitySection(settings));
    panel.appendChild(this.buildControlsSection(settings));

    this.root.appendChild(panel);
  }

  private update(patch: Partial<LocalSettings>): void {
    localProfileStore.updateSettings(patch);
    this.callbacks.onSettingsChanged(localProfileStore.get().settings);
  }

  private buildGraphicsSection(settings: LocalSettings): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.graphics');
    const grid = document.createElement('div');
    grid.className = 'vi-option-grid';
    for (const quality of GRAPHICS_QUALITY_LEVELS) {
      const card = document.createElement('div');
      card.className = `vi-option-card${quality === settings.graphicsQuality ? ' vi-option-card--selected' : ''}`;
      card.textContent = quality.toUpperCase();
      card.addEventListener('click', () => {
        this.update({ graphicsQuality: quality });
        Array.from(grid.children).forEach((c) => c.classList.remove('vi-option-card--selected'));
        card.classList.add('vi-option-card--selected');
      });
      grid.appendChild(card);
    }
    section.append(titleEl, grid);
    return section;
  }

  private buildAudioSection(settings: LocalSettings): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.audio');

    const rows: Array<[string, number, (v: number) => void]> = [
      [t('settings.masterVolume'), settings.masterVolume, (v) => this.update({ masterVolume: v })],
      [t('settings.musicVolume'), settings.musicVolume, (v) => this.update({ musicVolume: v })],
      [t('settings.sfxVolume'), settings.sfxVolume, (v) => this.update({ sfxVolume: v })],
    ];
    section.appendChild(titleEl);
    for (const [label, value, onChange] of rows) {
      const row = document.createElement('div');
      row.className = 'vi-row vi-row--spread';
      const labelEl = document.createElement('div');
      labelEl.className = 'vi-field-label';
      labelEl.textContent = label;
      const slider = buildSlider(value, onChange);
      slider.style.maxWidth = '220px';
      row.append(labelEl, slider);
      section.appendChild(row);
    }
    return section;
  }

  private buildLanguageSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.language');
    const grid = document.createElement('div');
    grid.className = 'vi-option-grid';
    for (const locale of SUPPORTED_LOCALES) {
      const card = document.createElement('div');
      const isSelected = locale === localProfileStore.get().settings.locale;
      card.className = `vi-option-card${isSelected ? ' vi-option-card--selected' : ''}`;
      card.textContent = locale === 'ar' ? 'العربية' : 'English';
      card.addEventListener('click', () => {
        this.setLocale(locale);
        Array.from(grid.children).forEach((c) => c.classList.remove('vi-option-card--selected'));
        card.classList.add('vi-option-card--selected');
      });
      grid.appendChild(card);
    }
    section.append(titleEl, grid);
    return section;
  }

  private setLocale(locale: SupportedLocale): void {
    this.update({ locale });
    setLocale(locale);
    this.callbacks.onLocaleChanged();
  }

  private buildAccessibilitySection(settings: LocalSettings): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.accessibility');
    section.appendChild(titleEl);

    const toggleRows: Array<[string, boolean, (v: boolean) => void]> = [
      [t('settings.cameraShake'), settings.cameraShakeEnabled, (v) => this.update({ cameraShakeEnabled: v })],
      [t('settings.reducedMotion'), settings.reducedMotion, (v) => this.update({ reducedMotion: v })],
      [t('settings.vibration'), settings.vibrationEnabled, (v) => this.update({ vibrationEnabled: v })],
      [t('settings.autoAccelerate'), settings.autoAccelerate, (v) => this.update({ autoAccelerate: v })],
    ];
    for (const [label, value, onChange] of toggleRows) {
      const row = document.createElement('div');
      row.className = 'vi-row vi-row--spread';
      const labelEl = document.createElement('div');
      labelEl.className = 'vi-field-label';
      labelEl.textContent = label;
      row.append(labelEl, buildToggle(value, onChange));
      section.appendChild(row);
    }
    return section;
  }

  private buildControlsSection(_settings: LocalSettings): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.controls');
    section.appendChild(titleEl);

    const row = document.createElement('div');
    row.className = 'vi-row';

    const editBtn = document.createElement('button');
    editBtn.className = 'vi-btn vi-btn--secondary';
    editBtn.textContent = t('settings.editTouchLayout');
    editBtn.addEventListener('click', () => {
      this.touchEditMode = !this.touchEditMode;
      this.callbacks.onToggleTouchEditMode(this.touchEditMode);
      editBtn.classList.toggle('vi-btn--accent', this.touchEditMode);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'vi-btn vi-btn--secondary';
    resetBtn.textContent = t('settings.resetTouchLayout');
    resetBtn.addEventListener('click', () => this.callbacks.onResetTouchLayout());

    row.append(editBtn, resetBtn);
    section.appendChild(row);
    return section;
  }
}
