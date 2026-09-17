export interface Screen {
  root: HTMLElement;
  onShow?(): void;
  onHide?(): void;
  dispose?(): void;
}

/** Shows exactly one full-screen UI screen at a time (Main Menu, Play, Garage,
 * Settings, Results, ...). Screens manage their own DOM/state; this just handles the
 * mount/unmount lifecycle so switching screens never leaks listeners or RAF loops. */
export class ScreenManager {
  private current: Screen | null = null;

  constructor(private readonly container: HTMLElement) {}

  show(screen: Screen): void {
    if (this.current) {
      this.current.onHide?.();
      this.current.root.remove();
    }
    this.current = screen;
    this.container.appendChild(screen.root);
    screen.onShow?.();
  }

  hideAll(): void {
    if (this.current) {
      this.current.onHide?.();
      this.current.root.remove();
      this.current = null;
    }
  }
}
