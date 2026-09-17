type GamepadWithVibration = Omit<Gamepad, 'vibrationActuator'> & {
  vibrationActuator?: {
    playEffect(type: 'dual-rumble', params: { duration: number; strongMagnitude: number; weakMagnitude: number }): Promise<void>;
  };
};

/** Gamepad rumble (Vibration Actuator API) + mobile Vibration API haptics for
 * collisions, boost, drift, explosions and race finish. A single settings flag
 * disables both. */
export class HapticsManager {
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private rumble(strongMagnitude: number, weakMagnitude: number, durationMs: number): void {
    if (!this.enabled) return;
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      const gp = pad as GamepadWithVibration | null;
      gp?.vibrationActuator?.playEffect('dual-rumble', { duration: durationMs, strongMagnitude, weakMagnitude }).catch(() => {});
    }
  }

  private vibrateMobile(pattern: number | number[]): void {
    if (!this.enabled) return;
    navigator.vibrate?.(pattern);
  }

  collision(strength: number): void {
    this.rumble(0.4 + strength * 0.6, 0.3, 150 + strength * 150);
    this.vibrateMobile(Math.round(40 + strength * 60));
  }

  boost(): void {
    this.rumble(0.2, 0.5, 200);
    this.vibrateMobile(30);
  }

  drift(): void {
    this.rumble(0.1, 0.15, 60);
  }

  explosion(): void {
    this.rumble(0.8, 0.6, 300);
    this.vibrateMobile([60, 40, 80]);
  }

  finish(): void {
    this.rumble(0.3, 0.3, 400);
    this.vibrateMobile([50, 50, 50, 50, 100]);
  }
}
