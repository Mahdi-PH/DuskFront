import type { VehicleInputState } from '../vehicles/VehicleController';
import { clamp } from '../vehicles/vehicleMath';

export interface RaceControlInput extends VehicleInputState {
  usePowerUp: boolean;
  pause: boolean;
}

export type InputSource = 'keyboard' | 'gamepad' | 'touch';

const EMPTY_INPUT: RaceControlInput = { throttle: 0, brake: 0, steer: 0, drift: false, boost: false, usePowerUp: false, pause: false };

/** Merges keyboard, Gamepad API and (optionally) touch input into one RaceControlInput per
 * frame. Sources are combined additively (max of throttle/brake/steer magnitude) so a player
 * can freely switch devices mid-session without reconfiguring anything. */
export class InputManager {
  private keys = new Set<string>();
  private touchState: RaceControlInput | null = null;
  private gamepadIndex: number | null = null;
  private autoAccelerate = false;
  private lastActiveSource: InputSource = 'keyboard';

  constructor() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    // A key held down when the window loses focus (alt-tab, app switch) never gets its
    // keyup event, which would otherwise leave that input stuck "on" indefinitely.
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  setAutoAccelerate(enabled: boolean): void {
    this.autoAccelerate = enabled;
  }

  setTouchState(state: RaceControlInput | null): void {
    this.touchState = state;
    if (state) this.lastActiveSource = 'touch';
  }

  getLastActiveSource(): InputSource {
    return this.lastActiveSource;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    this.lastActiveSource = 'keyboard';
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleGamepadConnected = (e: GamepadEvent): void => {
    this.gamepadIndex = e.gamepad.index;
  };

  private handleBlur = (): void => {
    this.keys.clear();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) this.keys.clear();
  };

  private handleGamepadDisconnected = (e: GamepadEvent): void => {
    if (this.gamepadIndex === e.gamepad.index) this.gamepadIndex = null;
  };

  private readKeyboard(): RaceControlInput {
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    const left = this.keys.has('KeyA') || this.keys.has('ArrowLeft');
    const right = this.keys.has('KeyD') || this.keys.has('ArrowRight');
    return {
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      drift: this.keys.has('Space'),
      boost: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      usePowerUp: this.keys.has('KeyE'),
      pause: this.keys.has('Escape'),
    };
  }

  private readGamepad(): RaceControlInput | null {
    if (this.gamepadIndex === null) return null;
    const pads = navigator.getGamepads();
    const pad = pads[this.gamepadIndex];
    if (!pad) return null;

    const rightTrigger = pad.buttons[7]?.value ?? 0;
    const leftTrigger = pad.buttons[6]?.value ?? 0;
    const stickX = pad.axes[0] ?? 0;
    const deadzone = 0.12;
    const steer = Math.abs(stickX) > deadzone ? clamp(stickX, -1, 1) : 0;

    const anyActive =
      rightTrigger > 0.05 ||
      leftTrigger > 0.05 ||
      Math.abs(steer) > 0 ||
      (pad.buttons[0]?.pressed ?? false) ||
      (pad.buttons[1]?.pressed ?? false) ||
      (pad.buttons[2]?.pressed ?? false);
    if (anyActive) this.lastActiveSource = 'gamepad';

    return {
      throttle: rightTrigger,
      brake: leftTrigger,
      steer,
      drift: pad.buttons[0]?.pressed ?? false, // A / Cross
      boost: pad.buttons[1]?.pressed ?? false, // B / Circle
      usePowerUp: pad.buttons[2]?.pressed ?? false, // X / Square
      pause: pad.buttons[9]?.pressed ?? false, // Start
    };
  }

  /** Combines all active sources for this frame. Call once per render frame. */
  poll(): RaceControlInput {
    const keyboard = this.readKeyboard();
    const gamepad = this.readGamepad();
    const touch = this.touchState;

    const sources = [keyboard, gamepad, touch].filter((s): s is RaceControlInput => s !== null);
    if (sources.length === 0) return EMPTY_INPUT;

    const combined: RaceControlInput = {
      throttle: Math.max(...sources.map((s) => s.throttle)),
      brake: Math.max(...sources.map((s) => s.brake)),
      steer: sources.reduce((acc, s) => (Math.abs(s.steer) > Math.abs(acc) ? s.steer : acc), 0),
      drift: sources.some((s) => s.drift),
      boost: sources.some((s) => s.boost),
      usePowerUp: sources.some((s) => s.usePowerUp),
      pause: sources.some((s) => s.pause),
    };

    if (this.autoAccelerate && combined.brake < 0.05) {
      combined.throttle = Math.max(combined.throttle, 0.75);
    }

    return combined;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
