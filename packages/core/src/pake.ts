/**
 * SPAKE2 over ristretto255 (RFC 9382 construction, Narad-specific M/N points).
 * Lets two devices turn a short 6-digit code into a strong shared secret, with
 * NO offline dictionary attack: an eavesdropper or active MITM gets exactly one guess.
 *
 * `context` must bind the run to the transport (we pass the channel fingerprint =
 * hash of both ECDH public keys), so a relay that MITMs the DataChannel key exchange
 * ends up with a different transcript on each side and the confirmation fails.
 */
import { RistrettoPoint } from '@noble/curves/ed25519'
import { sha256, sha512 } from '@noble/hashes/sha2'
import { hmac } from '@noble/hashes/hmac'
import { hkdf } from '@noble/hashes/hkdf'

const te = new TextEncoder()
const ORDER = RistrettoPoint.Fn.ORDER
const M = RistrettoPoint.hashToCurve(sha512(te.encode('narad-spake2-M-v1')))
const N = RistrettoPoint.hashToCurve(sha512(te.encode('narad-spake2-N-v1')))

export type PakeRole = 'A' | 'B'

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let n = 0n
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!)
  return n
}

function scalarFromPassword(password: string, context: string): bigint {
  const w = bytesToBigIntLE(sha512(te.encode(`narad-spake2-pw|${context}|${password}`))) % ORDER
  return w === 0n ? 1n : w
}

function randomScalar(): bigint {
  const r = bytesToBigIntLE(crypto.getRandomValues(new Uint8Array(64))) % ORDER
  return r === 0n ? 1n : r
}

export interface PakeResult {
  /** 32-byte session key, only equal on both sides if the password matched. */
  key: Uint8Array
  /** What we send to prove we derived the key. */
  myConfirm: Uint8Array
  /** What the other side must send. */
  theirConfirm: Uint8Array
}

export class Spake2 {
  readonly message: Uint8Array
  private readonly x: bigint
  private readonly w: bigint
  private finished = false

  constructor(
    readonly role: PakeRole,
    password: string,
    readonly context: string,
  ) {
    this.w = scalarFromPassword(password, context)
    this.x = randomScalar()
    const blind = (role === 'A' ? M : N).multiply(this.w)
    this.message = RistrettoPoint.BASE.multiply(this.x).add(blind).toBytes()
  }

  finish(theirMessage: Uint8Array): PakeResult {
    if (this.finished) throw new Error('spake2: already finished')
    this.finished = true
    const theirPoint = RistrettoPoint.fromBytes(theirMessage) // throws on invalid encodings
    if (theirPoint.equals(RistrettoPoint.ZERO)) throw new Error('spake2: degenerate peer message')
    const theirBlind = (this.role === 'A' ? N : M).multiply(this.w)
    const K = theirPoint.subtract(theirBlind).multiply(this.x).toBytes()
    const pA = this.role === 'A' ? this.message : theirMessage
    const pB = this.role === 'A' ? theirMessage : this.message
    const transcript = concat(te.encode(`narad-spake2-v1|${this.context}|`), lp(pA), lp(pB), lp(K), lp(numToBytesLE(this.w)))
    const okm = hkdf(sha256, sha256(transcript), undefined, te.encode('narad-spake2-keys'), 64)
    const key = okm.slice(0, 32)
    const confirmKey = okm.slice(32, 64)
    const confA = hmac(sha256, confirmKey, te.encode('confirm-A'))
    const confB = hmac(sha256, confirmKey, te.encode('confirm-B'))
    return { key, myConfirm: this.role === 'A' ? confA : confB, theirConfirm: this.role === 'A' ? confB : confA }
  }
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

/** Derive purpose-specific secrets from the PAKE key. */
export function deriveFromPake(key: Uint8Array, purpose: string, length = 32): Uint8Array {
  return hkdf(sha256, key, undefined, te.encode(`narad-pake|${purpose}`), length)
}

export function randomPairCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000
  return n.toString().padStart(6, '0')
}

function lp(b: Uint8Array): Uint8Array {
  const len = new Uint8Array(4)
  new DataView(len.buffer).setUint32(0, b.length)
  return concat(len, b)
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
function numToBytesLE(n: bigint): Uint8Array {
  const out = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    out[i] = Number(n & 0xffn)
    n >>= 8n
  }
  return out
}
