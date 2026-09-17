import { GRAPHICS_QUALITY_LEVELS, SUPPORTED_LOCALES, type SupportedLocale } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { localProfileStore, type LocalSettings } from '../../game/LocalProfileStore';
import { t, setLocale } from '../../i18n';
import { authClient } from '../../network/AuthClient';

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

    panel.appendChild(this.buildAccountSection());
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

  private buildAccountSection(): HTMLDivElement {
    const section = document.createElement('div');
    section.className = 'vi-settings-section';
    const titleEl = document.createElement('div');
    titleEl.className = 'vi-settings-section__title';
    titleEl.textContent = t('settings.account');
    section.appendChild(titleEl);

    const statusEl = document.createElement('div');
    statusEl.className = 'vi-empty-state';
    statusEl.style.padding = '0';
    statusEl.style.textAlign = 'start';
    const session = authClient.getSession();
    statusEl.textContent = !session || session.isGuest ? t('settings.accountGuest') : t('settings.accountSignedIn', { email: session.displayName });
    section.appendChild(statusEl);

    const emailInput = document.createElement('input');
    emailInput.className = 'vi-slider';
    emailInput.type = 'email';
    emailInput.placeholder = t('settings.email');
    const passwordInput = document.createElement('input');
    passwordInput.className = 'vi-slider';
    passwordInput.type = 'password';
    passwordInput.placeholder = t('settings.password');
    const nameInput = document.createElement('input');
    nameInput.className = 'vi-slider';
    nameInput.placeholder = t('settings.displayName');

    const messageEl = document.createElement('div');
    messageEl.style.fontSize = '11px';

    const row = document.createElement('div');
    row.className = 'vi-row';
    const signInBtn = document.createElement('button');
    signInBtn.className = 'vi-btn vi-btn--secondary';
    signInBtn.textContent = t('settings.signIn');
    signInBtn.addEventListener('click', () => {
      void authClient
        .login(emailInput.value, passwordInput.value)
        .then(() => {
          messageEl.textContent = t('settings.accountSuccess');
          statusEl.textContent = t('settings.accountSignedIn', { email: authClient.getSession()!.displayName });
        })
        .catch(() => {
          messageEl.textContent = t('settings.accountError');
        });
    });

    const saveBtn = document.createElement('button');
    saveBtn.className = 'vi-btn vi-btn--accent';
    saveBtn.textContent = t('settings.createAccount');
    saveBtn.addEventListener('click', () => {
      const session = authClient.getSession();
      const action =
        session && !session.isGuest
          ? Promise.reject(new Error('already upgraded'))
          : session
            ? authClient.upgradeToEmail(emailInput.value, passwordInput.value, nameInput.value || session.displayName)
            : authClient.register(emailInput.value, passwordInput.value, nameInput.value);
      void action
        .then(() => {
          messageEl.textContent = t('settings.accountSuccess');
          statusEl.textContent = t('settings.accountSignedIn', { email: authClient.getSession()?.displayName ?? emailInput.value });
        })
        .catch(() => {
          messageEl.textContent = t('settings.accountError');
        });
    });

    row.append(signInBtn, saveBtn);
    section.append(emailInput, passwordInput, nameInput, row, messageEl);
    return section;
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
