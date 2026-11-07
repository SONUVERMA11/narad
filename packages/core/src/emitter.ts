/** Minimal typed event emitter (works in browser, workers and Node). */
export class Emitter<Events extends Record<string, unknown[]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<keyof Events, Set<(...args: any[]) => void>>()

  on<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    let set = this.listeners.get(event)
    if (!set) this.listeners.set(event, (set = new Set()))
    set.add(fn)
    return () => set!.delete(fn)
  }

  once<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    const off = this.on(event, ((...args: Events[K]) => {
      off()
      fn(...args)
    }) as (...args: Events[K]) => void)
    return off
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try {
        fn(...args)
      } catch (err) {
        console.error(`[narad] listener for ${String(event)} threw`, err)
      }
    })
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
