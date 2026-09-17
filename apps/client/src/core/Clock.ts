/** Wall-clock delta timer with a clamp to avoid huge spiral-of-death steps after a tab
 * is backgrounded and resumed. */
export class Clock {
  private lastTimeMs: number | null = null;
  elapsedSec = 0;

  tick(nowMs: number): number {
    if (this.lastTimeMs === null) {
      this.lastTimeMs = nowMs;
      return 0;
    }
    const rawDeltaSec = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;
    const deltaSec = Math.min(rawDeltaSec, 1 / 15);
    this.elapsedSec += deltaSec;
    return deltaSec;
  }

  reset(): void {
    this.lastTimeMs = null;
    this.elapsedSec = 0;
  }
}
