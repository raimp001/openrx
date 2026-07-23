// ── Shared in-memory stores ──────────────────────────────
// TODO(multi-instance): these stores are per-process. On any multi-instance
// or serverless deployment, conversation memory / action feed / context cache
// will diverge between instances. Back these interfaces with Redis or Postgres
// (Prisma) for production; the in-memory implementations remain the demo-mode
// and single-instance fallback.

export interface KeyValueStore<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  has(key: string): boolean
  delete(key: string): boolean
  keys(): IterableIterator<string>
  entries(): IterableIterator<[string, T]>
  readonly size: number
}

export interface ActionLogStore<T> {
  unshift(entry: T): void
  pop(): T | undefined
  slice(start: number, end?: number): T[]
  readonly length: number
}

/**
 * Map-backed key/value store with optional LRU-style capacity eviction.
 * Insertion order is preserved; when `maxEntries` is exceeded the oldest
 * entry is evicted. Callers can "touch" a key via delete+set to refresh it.
 */
export class InMemoryLRUStore<T> implements KeyValueStore<T> {
  private map = new Map<string, T>()

  constructor(private readonly maxEntries?: number) {}

  get(key: string): T | undefined {
    return this.map.get(key)
  }

  set(key: string, value: T): void {
    if (!this.map.has(key) && this.maxEntries !== undefined && this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) this.map.delete(oldestKey)
    }
    this.map.set(key, value)
  }

  has(key: string): boolean {
    return this.map.has(key)
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  keys(): IterableIterator<string> {
    return this.map.keys()
  }

  entries(): IterableIterator<[string, T]> {
    return this.map.entries()
  }

  get size(): number {
    return this.map.size
  }
}

/** Array-backed capped action log (newest first). */
export class InMemoryActionLogStore<T> implements ActionLogStore<T> {
  private entries: T[] = []

  constructor(private readonly maxEntries = 50) {}

  unshift(entry: T): void {
    this.entries.unshift(entry)
    if (this.entries.length > this.maxEntries) this.entries.pop()
  }

  pop(): T | undefined {
    return this.entries.pop()
  }

  slice(start: number, end?: number): T[] {
    return this.entries.slice(start, end)
  }

  get length(): number {
    return this.entries.length
  }
}

// Stores are memoized on globalThis so that Next.js dev-server module
// reloading (and multiple import graphs in serverless bundles) cannot create
// a second instance that silently drops state.
const globalForStores = globalThis as unknown as {
  __openrxMemoryStores?: Map<string, unknown>
}

function getSingleton<T>(key: string, create: () => T): T {
  if (!globalForStores.__openrxMemoryStores) {
    globalForStores.__openrxMemoryStores = new Map<string, unknown>()
  }
  const stores = globalForStores.__openrxMemoryStores
  if (!stores.has(key)) stores.set(key, create())
  return stores.get(key) as T
}

export function getConversationStore<T>(): InMemoryLRUStore<T> {
  return getSingleton("conversations", () => new InMemoryLRUStore<T>())
}

export function getContextCacheStore<T>(): InMemoryLRUStore<T> {
  return getSingleton("context-cache", () => new InMemoryLRUStore<T>())
}

export function getActionLogStore<T>(): InMemoryActionLogStore<T> {
  return getSingleton("action-log", () => new InMemoryActionLogStore<T>(50))
}
