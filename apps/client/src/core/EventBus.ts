type Listener<T> = (payload: T) => void;

/** Minimal typed pub/sub so gameplay systems (HUD, audio, camera) can react to events
 * without being directly wired to the systems that raise them. */
export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners: { [K in keyof EventMap]?: Set<Listener<EventMap[K]>> } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    let set = this.listeners[event];
    if (!set) {
      set = new Set();
      this.listeners[event] = set;
    }
    set.add(listener);
    return () => set!.delete(listener);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners[event]?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners = {};
  }
}
