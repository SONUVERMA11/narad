/**
 * Narad wire protocol — shared by clients and the signaling server (Akash).
 * The signaling server never sees content: only presence and SDP/ICE blobs.
 */

export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface DeviceInfo {
  os: string
  browser: string
  type: DeviceType
}

export interface PeerInfo {
  /** Session-unique id: `${deviceId}:${tabSuffix}` */
  id: string
  /** Stable per-browser identity (hash of identity public key) */
  deviceId: string
  name: string
  device: DeviceInfo
}

// ---- Signaling (WebSocket, one socket per room) ----

export type ClientSignalMsg =
  | { t: 'join'; peer: PeerInfo; license?: string }
  | { t: 'signal'; to: string; data: SignalData }
  | { t: 'ping' }

export type ServerSignalMsg =
  | { t: 'joined'; room: string; kind: RoomKind; you: string; peers: PeerInfo[] }
  | { t: 'peer-joined'; peer: PeerInfo }
  | { t: 'peer-left'; id: string }
  | { t: 'signal'; from: string; data: SignalData }
  | { t: 'pong' }
  | { t: 'error'; message: string }

export type RoomKind = 'sabha' | 'code'

export type SignalData =
  | { kind: 'description'; description: { type: string; sdp?: string } }
  | { kind: 'candidate'; candidate: RTCIceCandidateInit | null }

// ---- DataChannel control messages (encrypted after `hello`) ----

export interface FileMeta {
  index: number
  name: string
  size: number
  type: string
  lastModified?: number
  /** Relative path inside a sent folder, e.g. "photos/2026/a.jpg". Absent for loose files. */
  path?: string
}

export type ControlMsg =
  | { t: 'hello'; pub: string; name: string; deviceId: string } // plaintext, once
  | { t: 'text'; id: string; body: string; ts: number }
  | { t: 'clip'; body: string; ts: number }
  | { t: 'offer-files'; id: string; seq: number; files: FileMeta[] }
  | { t: 'accept'; id: string }
  | { t: 'reject'; id: string }
  | { t: 'file-start'; id: string; index: number }
  | { t: 'file-end'; id: string; index: number }
  | { t: 'done'; id: string }
  | { t: 'cancel'; id: string; reason?: string }
  // ---- resume after a dropped connection ----
  | { t: 'resume-offer'; id: string }
  | { t: 'resume-request'; id: string; fromFile: number; fromOffset: number }
  | { t: 'resume-reject'; id: string }
  // ---- share-by-code: the receiver asks to keep the sender as a contact (both sides already ran SPAKE2 on the code) ----
  | { t: 'contact-add' }
  | { t: 'resume-ack'; id: string; seq: number; fromFile: number; fromOffset: number }
  // ---- pairing (SPAKE2) ----
  | { t: 'pake'; role: 'A' | 'B'; msg: string }
  | { t: 'pake-confirm'; mac: string }
  | { t: 'pair-info'; deviceId: string; name: string; identityPub: string }
  | { t: 'pair-fail'; reason: string }

/** Frame type byte (first byte of every DataChannel message). */
export const FRAME = {
  PLAIN_JSON: 0x00,
  ENC_JSON: 0x01,
  ENC_CHUNK: 0x02,
} as const

/** Chunk plaintext header: u16 seq | u16 fileIndex | u32 chunkIndex */
export const CHUNK_HEADER = 8
/** Keep ciphertext comfortably under the 64 KiB cross-browser SCTP message limit. */
export const CHUNK_DATA = 65536 - 128
export const PROTOCOL_VERSION = 1
