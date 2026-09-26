// Minimal event bus.
export class Bus {
  constructor() {
    this.map = new Map();
  }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  once(evt, fn) {
    const off = this.on(evt, (...a) => {
      off();
      fn(...a);
    });
    return off;
  }
  off(evt, fn) {
    const s = this.map.get(evt);
    if (s) s.delete(fn);
  }
  emit(evt, payload) {
    const s = this.map.get(evt);
    if (s) for (const fn of [...s]) {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[bus] ${evt} handler failed`, e);
      }
    }
    const any = this.map.get('*');
    if (any) for (const fn of [...any]) fn(evt, payload);
  }
}
