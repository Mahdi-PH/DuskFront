import { VEHICLES, type VehicleDefinition, type VehicleStats } from '@velocity-island/shared';
import type { Screen } from '../ScreenManager';
import { VehicleShowcaseScene } from '../VehicleShowcaseScene';
import { localProfileStore } from '../../game/LocalProfileStore';
import { t } from '../../i18n';

export interface GarageCallbacks {
  onBack(): void;
}

const STAT_KEYS: Array<keyof VehicleStats> = ['speed', 'acceleration', 'handling', 'drift', 'boost', 'durability'];

export class Garage implements Screen {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private showcase: VehicleShowcaseScene | null = null;
  private index: number;
  private statsEl: HTMLDivElement;
  private colorwaysEl: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private taglineEl: HTMLDivElement;
  private selectBtn: HTMLButtonElement;
  private lockedNoticeEl: HTMLDivElement;
  private selectedColorwayId: string;
  private resizeHandler = () => this.showcase?.resize(this.canvas.clientWidth, this.canvas.clientHeight);

  constructor(callbacks: GarageCallbacks) {
    const profile = localProfileStore.get();
    this.index = Math.max(0, VEHICLES.findIndex((v) => v.id === profile.selectedVehicleId));
    this.selectedColorwayId = profile.selectedColorwayId;

    this.root = document.createElement('div');
    this.root.className = 'vi-menu-screen';

    const panel = document.createElement('div');
    panel.className = 'vi-panel vi-glass';

    const header = document.createElement('div');
    header.className = 'vi-panel-header';
    const title = document.createElement('div');
    title.className = 'vi-panel-title';
    title.textContent = t('menu.garage');
    const backBtn = document.createElement('button');
    backBtn.className = 'vi-btn vi-btn--secondary';
    backBtn.textContent = t('play.back');
    backBtn.addEventListener('click', callbacks.onBack);
    header.append(title, backBtn);

    const layout = document.createElement('div');
    layout.className = 'vi-garage-layout';

    const showcaseWrap = document.createElement('div');
    showcaseWrap.style.position = 'relative';
    showcaseWrap.style.minHeight = '280px';
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '280px';
    showcaseWrap.appendChild(this.canvas);

    const carousel = document.createElement('div');
    carousel.className = 'vi-row vi-row--spread';
    const prevBtn = document.createElement('button');
    prevBtn.className = 'vi-btn vi-btn--secondary';
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => this.cycle(-1));
    const nextBtn = document.createElement('button');
    nextBtn.className = 'vi-btn vi-btn--secondary';
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => this.cycle(1));
    this.nameEl = document.createElement('div');
    this.nameEl.className = 'vi-title';
    this.nameEl.style.fontSize = '20px';
    carousel.append(prevBtn, this.nameEl, nextBtn);

    const details = document.createElement('div');
    this.taglineEl = document.createElement('div');
    this.taglineEl.style.opacity = '0.75';
    this.taglineEl.style.fontSize = '12px';
    this.taglineEl.style.marginBottom = '14px';

    this.statsEl = document.createElement('div');
    this.statsEl.className = 'vi-garage-stats';

    const colorwayLabel = document.createElement('div');
    colorwayLabel.className = 'vi-field-label';
    colorwayLabel.textContent = t('garage.colorway');
    colorwayLabel.style.marginTop = '16px';
    this.colorwaysEl = document.createElement('div');
    this.colorwaysEl.className = 'vi-colorway-swatches';

    this.lockedNoticeEl = document.createElement('div');
    this.lockedNoticeEl.className = 'vi-empty-state';

    this.selectBtn = document.createElement('button');
    this.selectBtn.className = 'vi-btn vi-btn--accent';
    this.selectBtn.style.marginTop = '16px';
    this.selectBtn.addEventListener('click', () => this.selectCurrent());

    details.append(this.taglineEl, this.statsEl, colorwayLabel, this.colorwaysEl, this.lockedNoticeEl, this.selectBtn);

    layout.append(showcaseWrap, details);
    panel.append(header, carousel, layout);
    this.root.appendChild(panel);

    window.addEventListener('resize', this.resizeHandler);
  }

  onShow(): void {
    this.showcase = new VehicleShowcaseScene(this.canvas);
    this.showcase.setAutoRotate(false);
    this.renderCurrent();
    this.showcase.resize(this.canvas.clientWidth || 400, 280);
    this.showcase.start();
  }

  onHide(): void {
    this.showcase?.dispose();
    this.showcase = null;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.showcase?.dispose();
  }

  private cycle(direction: number): void {
    this.index = (this.index + direction + VEHICLES.length) % VEHICLES.length;
    const vehicle = VEHICLES[this.index]!;
    this.selectedColorwayId = vehicle.colorways[0]!;
    this.renderCurrent();
  }

  private renderCurrent(): void {
    const vehicle = VEHICLES[this.index]!;
    const unlocked = localProfileStore.isUnlocked(vehicle);
    const profile = localProfileStore.get();
    const isSelected = profile.selectedVehicleId === vehicle.id;

    this.showcase?.setVehicle(vehicle, this.selectedColorwayId);
    this.nameEl.textContent = vehicle.name;
    this.taglineEl.textContent = vehicle.tagline;

    this.renderStats(vehicle);
    this.renderColorways(vehicle);

    if (!unlocked && vehicle.unlock.type === 'level') {
      this.lockedNoticeEl.textContent = t('garage.locked', { level: vehicle.unlock.level });
      this.lockedNoticeEl.style.display = 'block';
    } else {
      this.lockedNoticeEl.style.display = 'none';
    }

    this.selectBtn.disabled = !unlocked;
    this.selectBtn.textContent = isSelected ? t('garage.selected') : t('garage.select');
  }

  private renderStats(vehicle: VehicleDefinition): void {
    this.statsEl.innerHTML = '';
    for (const key of STAT_KEYS) {
      const row = document.createElement('div');
      row.className = 'vi-stat-row';
      const label = document.createElement('div');
      label.className = 'vi-stat-row__label';
      label.textContent = t(`garage.stats.${key}`);
      const barTrack = document.createElement('div');
      barTrack.className = 'vi-stat-row__bar';
      const fill = document.createElement('div');
      fill.className = 'vi-stat-row__fill';
      fill.style.width = `${vehicle.stats[key]}%`;
      barTrack.appendChild(fill);
      row.append(label, barTrack);
      this.statsEl.appendChild(row);
    }
  }

  private renderColorways(vehicle: VehicleDefinition): void {
    this.colorwaysEl.innerHTML = '';
    for (const colorwayId of vehicle.colorways) {
      const swatch = document.createElement('div');
      swatch.className = `vi-colorway-swatch${colorwayId === this.selectedColorwayId ? ' vi-colorway-swatch--selected' : ''}`;
      swatch.style.background = this.colorwayPreviewHex(colorwayId);
      swatch.addEventListener('click', () => {
        this.selectedColorwayId = colorwayId;
        this.showcase?.setVehicle(vehicle, colorwayId);
        this.renderColorways(vehicle);
      });
      this.colorwaysEl.appendChild(swatch);
    }
  }

  private colorwayPreviewHex(colorwayId: string): string {
    if (colorwayId.includes('turquoise')) return '#2fd9c9';
    if (colorwayId.includes('coral') || colorwayId.includes('reef')) return '#ff5c6c';
    if (colorwayId.includes('sunset') || colorwayId.includes('orange')) return '#ff7a3d';
    if (colorwayId.includes('navy') || colorwayId.includes('deep')) return '#0c1f3d';
    if (colorwayId.includes('green') || colorwayId.includes('tropical')) return '#2fb872';
    if (colorwayId.includes('white') || colorwayId.includes('warm')) return '#faf6ee';
    return '#1e6fb8';
  }

  private selectCurrent(): void {
    const vehicle = VEHICLES[this.index]!;
    if (!localProfileStore.isUnlocked(vehicle)) return;
    localProfileStore.selectVehicle(vehicle.id, this.selectedColorwayId);
    this.renderCurrent();
  }
}
