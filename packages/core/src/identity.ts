/**
 * Device identity: a non-extractable ECDSA P-256 keypair stored in IndexedDB.
 * The deviceId is a hash of the public key. Used today for a stable id;
 * used tomorrow (Phase 2) to sign pairing and prove "same device as last time".
 */
import { sha256Hex, toBase64 } from './crypto'

const DB = 'narad'
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function kvDel(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function kvList<T>(prefix: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'))
    const out: T[] = []
    req.onsuccess = () => {
      const cur = req.result
      if (!cur) return resolve(out)
      out.push(cur.value as T)
      cur.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

/** Small persistent store for app records (contacts, spaces). Safe no-ops when IndexedDB is unavailable. */
export const store = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await kvGet<T>(key)
    } catch {
      return undefined
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await kvSet(key, value)
    } catch {
      /* ignore */
    }
  },
  async del(key: string): Promise<void> {
    try {
      await kvDel(key)
    } catch {
      /* ignore */
    }
  },
  async list<T>(prefix: string): Promise<T[]> {
    try {
      return await kvList<T>(prefix)
    } catch {
      return []
    }
  },
}

export interface Identity {
  deviceId: string
  publicKey: CryptoKey
  privateKey: CryptoKey
  /** SPKI public key, base64 — shared with contacts at pairing time. */
  publicKeyB64: string
}

export async function loadOrCreateIdentity(): Promise<Identity> {
  try {
    const existing = await kvGet<{ publicKey: CryptoKey; privateKey: CryptoKey }>('identity')
    if (existing) {
      const spki = new Uint8Array(await crypto.subtle.exportKey('spki', existing.publicKey))
      return { ...existing, deviceId: (await sha256Hex(spki)).slice(0, 16), publicKeyB64: toBase64(spki) }
    }
  } catch {
    /* fall through: private mode / blocked IDB → ephemeral identity */
  }
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
  try {
    await kvSet('identity', { publicKey: kp.publicKey, privateKey: kp.privateKey })
  } catch {
    /* ephemeral */
  }
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey))
  return { publicKey: kp.publicKey, privateKey: kp.privateKey, deviceId: (await sha256Hex(spki)).slice(0, 16), publicKeyB64: toBase64(spki) }
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  try {
    return await kvGet<T>(`setting:${key}`)
  } catch {
    return undefined
  }
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  try {
    await kvSet(`setting:${key}`, value)
  } catch {
    /* ignore */
  }
}
