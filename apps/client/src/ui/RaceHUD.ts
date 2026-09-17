import * as THREE from 'three';
import type { WeaponId } from '@velocity-island/shared';
import type { DriftLevel } from '../vehicles/vehicleMath';
import { MiniMap } from './MiniMap';
import { t } from '../i18n';

const WEAPON_LABELS: Record<WeaponId, string> = {
  fireball: 'FIRE',
  shockwave: 'SHOCK',
  turbo: 'TURBO',
  shield: 'GUARD',
  magnet: 'MAG',
  oilTrap: 'OIL',
  emp: 'EMP',
  rocket: 'ROCK',
  phantom: 'GHOST',
};

export interface RaceHUDStandingEntry {
  playerId: string;
  displayName: string;
  colorHex: string;
  position: number;
}

export interface RaceHUDData {
  localPlayerId: string;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  raceTimeMs: number;
  speedKmh: number;
  boostCharge: number;
  driftLevel: DriftLevel;
  heldWeapon: WeaponId | null;
  standings: RaceHUDStandingEntry[];
  minimapMarkers: Array<{ id: string; x: number; z: number; color: string; isLocalPlayer: boolean }>;
  wrongWay: boolean;
}

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  const centis = Math.floor((totalSec * 100) % 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/** Builds and updates the in-race HUD DOM: standings, lap/timer, minimap, power-up
 * slot, speedometer + boost meter, and desktop control legend. Pure DOM (no React) per
 * the project's HTML/CSS UI requirement, updated imperatively once per render frame. */
export class RaceHUD {
  readonly root: HTMLDivElement;
  private readonly minimap = new MiniMap();
  private readonly els: Record<string, HTMLElement> = {};
  private readonly speedNeedle: SVGLineElement;
  private countdownEl: HTMLDivElement | null = null;
  private wrongWayEl: HTMLDivElement | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'vi-hud';
    container.appendChild(this.root);

    this.root.appendChild(this.buildStandingsPanel());
    this.root.appendChild(this.buildLapInfoPanel());
    this.root.appendChild(this.buildMinimapPanel());
    this.root.appendChild(this.buildPowerUpPanel());
    const { panel: speedPanel, needle } = this.buildSpeedPanel();
    this.root.appendChild(speedPanel);
    this.speedNeedle = needle;
    this.root.appendChild(this.buildControlLegend());
  }

  private buildStandingsPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-standings vi-glass';
    const rank = document.createElement('div');
    rank.className = 'vi-hud-standings__rank';
    const rankValue = document.createElement('span');
    rankValue.className = 'vi-hud-standings__rank-value';
    rankValue.textContent = '1/8';
    const rankLabel = document.createElement('span');
    rankLabel.className = 'vi-hud-standings__rank-label';
    rankLabel.textContent = t('hud.position');
    rank.append(rankValue, rankLabel);
    const list = document.createElement('div');
    list.className = 'vi-hud-standings__list';
    panel.append(rank, list);
    this.els.rankValue = rankValue;
    this.els.rankLabel = rankLabel;
    this.els.standingsList = list;
    return panel;
  }

  private buildLapInfoPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-lapinfo vi-glass';

    const lapBlock = document.createElement('div');
    lapBlock.className = 'vi-hud-lapinfo__block';
    const lapValue = document.createElement('div');
    lapValue.className = 'vi-hud-lapinfo__value';
    lapValue.textContent = '1/3';
    const lapLabel = document.createElement('div');
    lapLabel.className = 'vi-hud-lapinfo__label';
    lapLabel.textContent = t('hud.lap');
    lapBlock.append(lapValue, lapLabel);

    const divider = document.createElement('div');
    divider.className = 'vi-hud-lapinfo__divider';

    const timeBlock = document.createElement('div');
    timeBlock.className = 'vi-hud-lapinfo__block';
    const timeValue = document.createElement('div');
    timeValue.className = 'vi-hud-lapinfo__value';
    timeValue.textContent = '0:00.00';
    timeBlock.appendChild(timeValue);

    panel.append(lapBlock, divider, timeBlock);
    this.els.lapValue = lapValue;
    this.els.lapLabel = lapLabel;
    this.els.timeValue = timeValue;
    return panel;
  }

  private buildMinimapPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-minimap vi-glass';
    panel.appendChild(this.minimap.canvas);
    return panel;
  }

  private buildPowerUpPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-powerup';
    const slot = document.createElement('div');
    slot.className = 'vi-hud-powerup__slot vi-glass';
    slot.textContent = '?';
    panel.appendChild(slot);
    this.els.powerupSlot = slot;
    return panel;
  }

  private buildSpeedPanel(): { panel: HTMLDivElement; needle: SVGLineElement } {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-speed vi-glass';

    const gauge = document.createElement('div');
    gauge.className = 'vi-hud-speed__gauge';
    gauge.innerHTML = `
      <svg viewBox="0 0 128 128" width="128" height="128">
        <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(250,246,238,0.12)" stroke-width="8" />
        <circle cx="64" cy="64" r="56" fill="none" stroke="url(#vi-speed-grad)" stroke-width="8"
          stroke-dasharray="264" stroke-dashoffset="66" stroke-linecap="round" transform="rotate(135 64 64)" />
        <defs>
          <linearGradient id="vi-speed-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#2fd9c9" />
            <stop offset="1" stop-color="#ff7a3d" />
          </linearGradient>
        </defs>
        <line x1="64" y1="64" x2="64" y2="20" stroke="#faf6ee" stroke-width="3" stroke-linecap="round" class="vi-speed-needle" transform="rotate(-135 64 64)" />
      </svg>
    `;
    const needle = gauge.querySelector('.vi-speed-needle') as SVGLineElement;

    const valueOverlay = document.createElement('div');
    valueOverlay.className = 'vi-hud-speed__value';
    const number = document.createElement('div');
    number.className = 'vi-hud-speed__number';
    number.textContent = '0';
    const unit = document.createElement('div');
    unit.className = 'vi-hud-speed__unit';
    unit.textContent = 'KM/H';
    valueOverlay.append(number, unit);
    gauge.appendChild(valueOverlay);

    const boost = document.createElement('div');
    boost.className = 'vi-hud-boost';
    const boostLabel = document.createElement('div');
    boostLabel.className = 'vi-hud-boost__label';
    boostLabel.innerHTML = `<span>BOOST</span><span class="vi-hud-boost__pct">0%</span>`;
    const boostBar = document.createElement('div');
    boostBar.className = 'vi-hud-boost__bar';
    const boostFill = document.createElement('div');
    boostFill.className = 'vi-hud-boost__fill';
    boostBar.appendChild(boostFill);
    boost.append(boostLabel, boostBar);

    panel.append(gauge, boost);
    this.els.speedNumber = number;
    this.els.boostFill = boostFill;
    this.els.boostPct = boostLabel.querySelector('.vi-hud-boost__pct')!;
    return { panel, needle };
  }

  private buildControlLegend(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'vi-hud-controls';
    const items: Array<[string, string]> = [
      ['DRIFT', 'SPACE'],
      ['BOOST', 'SHIFT'],
      ['ITEM', 'E'],
    ];
    for (const [icon, key] of items) {
      const item = document.createElement('div');
      item.className = 'vi-hud-control';
      const circle = document.createElement('div');
      circle.className = 'vi-hud-control__icon vi-glass';
      circle.textContent = icon[0]!;
      const keyLabel = document.createElement('div');
      keyLabel.className = 'vi-hud-control__key';
      keyLabel.textContent = key;
      item.append(circle, keyLabel);
      panel.appendChild(item);
    }
    return panel;
  }

  setTrackCurve(curve: THREE.CatmullRomCurve3): void {
    this.minimap.setTrack(curve);
  }

  update(data: RaceHUDData): void {
    this.els.rankValue!.textContent = `${data.position}/${data.totalRacers}`;

    this.els.standingsList!.innerHTML = '';
    for (const entry of data.standings) {
      const row = document.createElement('div');
      row.className = 'vi-hud-standings__row' + (entry.playerId === data.localPlayerId ? ' vi-hud-standings__row--self' : '');
      const num = document.createElement('span');
      num.className = 'vi-hud-standings__row-num';
      num.textContent = String(entry.position);
      const dot = document.createElement('span');
      dot.className = 'vi-hud-standings__row-dot';
      dot.style.background = entry.colorHex;
      const name = document.createElement('span');
      name.className = 'vi-hud-standings__row-name';
      name.textContent = entry.displayName;
      row.append(num, dot, name);
      this.els.standingsList!.appendChild(row);
    }

    this.els.lapValue!.textContent = `${Math.min(data.lap + 1, data.totalLaps)}/${data.totalLaps}`;
    this.els.timeValue!.textContent = formatTime(data.raceTimeMs);

    const slot = this.els.powerupSlot!;
    if (data.heldWeapon) {
      slot.textContent = WEAPON_LABELS[data.heldWeapon];
      slot.classList.add('vi-hud-powerup__slot--filled');
    } else {
      slot.textContent = '?';
      slot.classList.remove('vi-hud-powerup__slot--filled');
    }

    this.els.speedNumber!.textContent = String(Math.round(Math.max(0, data.speedKmh)));
    const speedRatio = Math.min(1, Math.max(0, data.speedKmh) / 220);
    const angle = -135 + speedRatio * 270;
    this.speedNeedle.setAttribute('transform', `rotate(${angle} 64 64)`);

    const boostPct = Math.round(data.boostCharge * 100);
    this.els.boostFill!.style.width = `${boostPct}%`;
    this.els.boostPct!.textContent = `${boostPct}%`;
    this.els.boostFill!.className = `vi-hud-boost__fill${data.driftLevel > 0 ? ` vi-hud-boost__fill--drift-${data.driftLevel}` : ''}`;

    this.minimap.render(data.minimapMarkers);

    if (data.wrongWay && !this.wrongWayEl) {
      this.wrongWayEl = document.createElement('div');
      this.wrongWayEl.className = 'vi-hud-wrongway';
      this.wrongWayEl.textContent = t('hud.wrongWay');
      this.root.appendChild(this.wrongWayEl);
    } else if (!data.wrongWay && this.wrongWayEl) {
      this.wrongWayEl.remove();
      this.wrongWayEl = null;
    }
  }

  showCountdown(value: number | null): void {
    if (value === null) {
      this.countdownEl?.remove();
      this.countdownEl = null;
      return;
    }
    if (!this.countdownEl) {
      this.countdownEl = document.createElement('div');
      this.countdownEl.className = 'vi-hud-countdown';
      this.root.appendChild(this.countdownEl);
    }
    this.countdownEl.innerHTML = '';
    const valueEl = document.createElement('div');
    valueEl.className = 'vi-hud-countdown__value';
    valueEl.textContent = value === 0 ? t('countdown.go') : String(value);
    this.countdownEl.appendChild(valueEl);
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('vi-hidden', !visible);
  }

  dispose(): void {
    this.root.remove();
  }
}
