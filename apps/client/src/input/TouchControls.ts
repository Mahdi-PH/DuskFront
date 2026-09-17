import type { RaceControlInput } from './InputManager';

interface TouchLayoutEntry {
  xPct: number;
  yPct: number;
  scale: number;
}

type TouchLayout = Record<string, TouchLayoutEntry>;

const LAYOUT_STORAGE_KEY = 'vi-touch-layout-v1';

const DEFAULT_LAYOUT: TouchLayout = {
  joystick: { xPct: 14, yPct: 78, scale: 1 },
  accelerate: { xPct: 88, yPct: 82, scale: 1 },
  brake: { xPct: 76, yPct: 68, scale: 0.8 },
  drift: { xPct: 62, yPct: 88, scale: 0.85 },
  boost: { xPct: 62, yPct: 68, scale: 0.85 },
  powerup: { xPct: 50, yPct: 40, scale: 1 },
};

function loadLayout(): TouchLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_LAYOUT);
    const parsed = JSON.parse(raw) as TouchLayout;
    return { ...structuredClone(DEFAULT_LAYOUT), ...parsed };
  } catch {
    return structuredClone(DEFAULT_LAYOUT);
  }
}

function saveLayout(layout: TouchLayout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage unavailable (private mode) — layout just won't persist this session.
  }
}

/** Mobile touch control layer: a virtual steering joystick (left), accelerate/brake
 * (right), and drift/boost/power-up buttons. Every element can be dragged to reposition
 * and resized in "edit mode", persisted to localStorage, and reset to defaults. */
export class TouchControls {
  readonly root: HTMLDivElement;
  private layout: TouchLayout;
  private editMode = false;
  private state: RaceControlInput = { throttle: 0, brake: 0, steer: 0, drift: false, boost: false, usePowerUp: false, pause: false };
  private joystickActive = false;
  private joystickTouchId: number | null = null;
  private onChange: ((state: RaceControlInput) => void) | null = null;

  private elements = new Map<string, HTMLDivElement>();

  constructor(container: HTMLElement) {
    this.layout = loadLayout();
    this.root = document.createElement('div');
    this.root.className = 'vi-touch-controls';
    container.appendChild(this.root);

    this.buildJoystick();
    this.buildButton('accelerate', 'ACCEL', 'vi-touch-btn vi-touch-btn--accelerate');
    this.buildButton('brake', 'BRAKE', 'vi-touch-btn vi-touch-btn--brake');
    this.buildButton('drift', 'DRIFT', 'vi-touch-btn vi-touch-btn--drift');
    this.buildButton('boost', 'BOOST', 'vi-touch-btn vi-touch-btn--boost');
    this.buildButton('powerup', '?', 'vi-touch-btn vi-touch-btn--powerup');

    this.applyLayout();
  }

  subscribe(callback: (state: RaceControlInput) => void): void {
    this.onChange = callback;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  setEditMode(enabled: boolean): void {
    this.editMode = enabled;
    this.root.classList.toggle('vi-touch-controls--edit', enabled);
  }

  resetLayout(): void {
    this.layout = structuredClone(DEFAULT_LAYOUT);
    saveLayout(this.layout);
    this.applyLayout();
  }

  private buildJoystick(): void {
    const base = document.createElement('div');
    base.className = 'vi-touch-joystick';
    base.dataset.key = 'joystick';
    const knob = document.createElement('div');
    knob.className = 'vi-touch-joystick__knob';
    base.appendChild(knob);
    this.root.appendChild(base);
    this.elements.set('joystick', base);
    this.makeDraggable(base, 'joystick');

    const radius = 46;
    const handleStart = (clientX: number, clientY: number, touchId: number | null) => {
      if (this.editMode) return;
      this.joystickActive = true;
      this.joystickTouchId = touchId;
      updateFromClient(clientX, clientY);
    };
    const updateFromClient = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.state.steer = Math.max(-1, Math.min(1, dx / radius));
      this.emit();
    };
    const handleEnd = () => {
      this.joystickActive = false;
      this.joystickTouchId = null;
      knob.style.transform = 'translate(0px, 0px)';
      this.state.steer = 0;
      this.emit();
    };

    base.addEventListener('touchstart', (e) => {
      if (this.editMode) return;
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (touch) handleStart(touch.clientX, touch.clientY, touch.identifier);
    });
    window.addEventListener('touchmove', (e) => {
      if (!this.joystickActive) return;
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.joystickTouchId) updateFromClient(touch.clientX, touch.clientY);
      }
    });
    window.addEventListener('touchend', (e) => {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === this.joystickTouchId) handleEnd();
      }
    });

    // Mouse fallback for desktop testing with touch-emulation.
    base.addEventListener('mousedown', (e) => {
      if (this.editMode) return;
      handleStart(e.clientX, e.clientY, null);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.joystickActive && this.joystickTouchId === null) updateFromClient(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (this.joystickActive && this.joystickTouchId === null) handleEnd();
    });
  }

  private buildButton(key: keyof RaceControlInput | 'accelerate' | 'brake' | 'drift' | 'boost' | 'powerup', label: string, className: string): void {
    const el = document.createElement('div');
    el.className = className;
    el.dataset.key = key as string;
    el.textContent = label;
    this.root.appendChild(el);
    this.elements.set(key as string, el);
    this.makeDraggable(el, key as string);

    const press = (down: boolean) => {
      if (this.editMode) return;
      switch (key) {
        case 'accelerate':
          this.state.throttle = down ? 1 : 0;
          break;
        case 'brake':
          this.state.brake = down ? 1 : 0;
          break;
        case 'drift':
          this.state.drift = down;
          break;
        case 'boost':
          this.state.boost = down;
          break;
        case 'powerup':
          this.state.usePowerUp = down;
          break;
      }
      el.classList.toggle('vi-touch-btn--active', down);
      this.emit();
    };

    el.addEventListener('touchstart', (e) => {
      if (this.editMode) return;
      e.preventDefault();
      press(true);
    });
    el.addEventListener('touchend', (e) => {
      e.preventDefault();
      press(false);
    });
    el.addEventListener('mousedown', () => press(true));
    el.addEventListener('mouseup', () => press(false));
    el.addEventListener('mouseleave', () => press(false));
  }

  private makeDraggable(el: HTMLDivElement, key: string): void {
    let dragging = false;
    let startX = 0;
    let startY = 0;

    const onPointerDown = (clientX: number, clientY: number) => {
      if (!this.editMode) return;
      dragging = true;
      startX = clientX;
      startY = clientY;
    };
    const onPointerMove = (clientX: number, clientY: number) => {
      if (!dragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      startX = clientX;
      startY = clientY;
      const entry = this.layout[key]!;
      entry.xPct = Math.min(96, Math.max(4, entry.xPct + (dx / window.innerWidth) * 100));
      entry.yPct = Math.min(96, Math.max(4, entry.yPct + (dy / window.innerHeight) * 100));
      this.positionElement(el, entry);
    };
    const onPointerUp = () => {
      if (dragging) saveLayout(this.layout);
      dragging = false;
    };

    el.addEventListener('touchstart', (e) => {
      if (!this.editMode) return;
      const t = e.touches[0];
      if (t) onPointerDown(t.clientX, t.clientY);
    });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (t) onPointerMove(t.clientX, t.clientY);
    });
    el.addEventListener('touchend', onPointerUp);
    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    el.addEventListener('wheel', (e) => {
      if (!this.editMode) return;
      e.preventDefault();
      const entry = this.layout[key]!;
      entry.scale = Math.min(1.6, Math.max(0.6, entry.scale - Math.sign(e.deltaY) * 0.05));
      this.positionElement(el, entry);
      saveLayout(this.layout);
    });
  }

  private positionElement(el: HTMLDivElement, entry: TouchLayoutEntry): void {
    el.style.left = `${entry.xPct}%`;
    el.style.top = `${entry.yPct}%`;
    el.style.transform = `translate(-50%, -50%) scale(${entry.scale})`;
  }

  private applyLayout(): void {
    for (const [key, el] of this.elements) {
      const entry = this.layout[key];
      if (entry) this.positionElement(el, entry);
    }
  }

  private emit(): void {
    this.onChange?.({ ...this.state });
  }
}
