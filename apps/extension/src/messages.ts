/** Messages between popup ⇄ background ⇄ offscreen (all via chrome.runtime.sendMessage). */
import type { ContactView, PeerInfo, PeerView, SpaceView, Transfer } from '@narad/core'

export interface InboxItem {
  id: string
  peerName: string
  kind: 'text' | 'file'
  body: string
  ts: number
}
export interface EngineState {
  me?: PeerInfo
  myId?: string
  peers: PeerView[]
  contacts: ContactView[]
  spaces: SpaceView[]
  transfers: Transfer[]
  incoming: { transfer: Transfer; from: string }[]
  inbox: InboxItem[]
  lastPeer?: string
  pairing: { mode: 'idle' } | { mode: 'show'; code: string } | { mode: 'enter' } | { mode: 'done'; name: string } | { mode: 'error'; message: string }
  signaling: 'open' | 'connecting' | 'closed'
}

export type ToOffscreen =
  | { target: 'offscreen'; type: 'state' }
  | { target: 'offscreen'; type: 'send-text'; peerId: string; body: string }
  | { target: 'offscreen'; type: 'send-url'; peerId: string; url: string; name?: string }
  | { target: 'offscreen'; type: 'send-blob-urls'; peerId: string; files: { url: string; name: string; type: string }[] }
  | { target: 'offscreen'; type: 'incoming-decision'; transferId: string; accept: boolean }
  | { target: 'offscreen'; type: 'pair-show' }
  | { target: 'offscreen'; type: 'pair-enter'; code: string }
  | { target: 'offscreen'; type: 'pair-reset' }
  | { target: 'offscreen'; type: 'join-space'; link: string }
  | { target: 'offscreen'; type: 'leave-space'; secret: string }
  | { target: 'offscreen'; type: 'remove-contact'; deviceId: string }
  | { target: 'offscreen'; type: 'set-contact'; deviceId: string; patch: { autoAccept?: boolean; syncClipboard?: boolean } }
  | { target: 'offscreen'; type: 'nudge'; deviceId: string }
  | { target: 'offscreen'; type: 'set-last'; peerId: string }
  | { target: 'offscreen'; type: 'copy'; text: string }

export type ToBackground =
  | { target: 'background'; type: 'ensure-offscreen' }
  | { target: 'background'; type: 'peers-changed'; peers: { id: string; name: string }[] }
  | { target: 'background'; type: 'notify'; id: string; title: string; message: string; buttons?: string[] }
  | { target: 'background'; type: 'download'; url: string; filename: string }

export type AnyMessage = ToOffscreen | ToBackground

/** Omit that distributes over unions (plain Omit collapses a union to its common keys). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

export const send = <T = unknown>(msg: AnyMessage): Promise<T> => chrome.runtime.sendMessage(msg) as Promise<T>
