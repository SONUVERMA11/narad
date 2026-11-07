/** Token-bucket rate limiter and small per-key counters. Runtime-agnostic. */
export class RateLimiter {
  private tokens: number
  private last = Date.now()
  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity
  }
  /** Returns true if the action is allowed. */
  take(cost = 1): boolean {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec)
    this.last = now
    if (this.tokens < cost) return false
    this.tokens -= cost
    return true
  }
}

export class Counter {
  private m = new Map<string, number>()
  inc(key: string): number {
    const n = (this.m.get(key) ?? 0) + 1
    this.m.set(key, n)
    return n
  }
  dec(key: string): void {
    const n = (this.m.get(key) ?? 1) - 1
    if (n <= 0) this.m.delete(key)
    else this.m.set(key, n)
  }
  get(key: string): number {
    return this.m.get(key) ?? 0
  }
}

/** Metadata-only audit events: never names, never content, room ids hashed by the caller. */
export type AuditEvent =
  | { ev: 'join'; room: string; kind: string; peers: number; ts: number }
  | { ev: 'leave'; room: string; peers: number; ts: number }
  | { ev: 'limit'; what: 'rate' | 'ip' | 'room-full' | 'payload'; ts: number }
export type AuditSink = (e: AuditEvent) => void
export const consoleAudit: AuditSink = (e) => console.log(JSON.stringify({ audit: e }))
