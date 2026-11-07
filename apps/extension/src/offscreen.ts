/**
 * Narad extension — offscreen document. Hosts the engine (WebRTC, crypto, transfers)
 * and answers state queries from the popup; reports events to the service worker.
 */
import { getSetting, MemorySink, naradId, Narad, nameFor, parseSpaceLink, type IncomingDecision, type Transfer } from '@narad/core'
import type { DistributiveOmit, EngineState, InboxItem, ToBackground, ToOffscreen } from './messages'

const SIGNALING_URL = (import.meta.env.VITE_SIGNALING_URL as string | undefined) || 'ws://localhost:8794/ws'
const ICE = (() => {
  try {
    return import.meta.env.VITE_ICE_SERVERS ? (JSON.parse(import.meta.env.VITE_ICE_SERVERS as string) as RTCIceServer[]) : undefined
  } catch {
    return undefined
  }
})()

const state: EngineState = { peers: [], contacts: [], spaces: [], transfers: [], incoming: [], inbox: [], pairing: { mode: 'idle' }, signaling: 'connecting' }
const pending = new Map<string, IncomingDecision>()
const transfers = new Map<string, Transfer>()
let narad: Narad
let pairHandle: ReturnType<Narad['startPairing']> | undefined

const toBackground = (msg: DistributiveOmit<ToBackground, 'target'>) => chrome.runtime.sendMessage({ target: 'background', ...msg } as ToBackground).catch(() => {})

async function boot() {
  const displayName = await getSetting<string>('displayName')
  narad = new Narad({ signalingUrl: SIGNALING_URL, iceServers: ICE, displayName })
  narad.on('ready', (me) => {
    state.me = me
    state.myId = naradId(me.name, me.deviceId)
  })
  narad.on('peers', (peers) => {
    state.peers = peers
    void toBackground({ type: 'peers-changed', peers: peers.map((p) => ({ id: p.info.id, name: p.via.contact?.name ?? p.info.name })) })
  })
  narad.on('contacts', (c) => (state.contacts = c))
  narad.on('spaces', (s) => (state.spaces = s))
  narad.on('room', ({ key, status }) => {
    if (key === 'sabha') state.signaling = status
  })
  narad.on('transfer', (t) => {
    transfers.set(t.id, { ...t })
    state.transfers = [...transfers.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, 20)
  })
  narad.on('incoming', (transfer, decision) => {
    const from = peerName(transfer.peerId)
    const peer = state.peers.find((p) => p.info.id === transfer.peerId)
    if (peer?.via.contact?.autoAccept) return accept(transfer, decision)
    pending.set(transfer.id, decision)
    state.incoming.push({ transfer, from })
    const names = transfer.files.map((f) => f.name).join(', ')
    void toBackground({ type: 'notify', id: `incoming:${transfer.id}`, title: `${from} wants to send`, message: `${names} (${fmt(transfer.bytesTotal)})`, buttons: ['Accept', 'Decline'] })
  })
  narad.on('message', (m) => {
    if (m.direction !== 'in') return
    const from = peerName(m.peerId)
    pushInbox({ id: m.id, peerName: from, kind: 'text', body: m.body, ts: m.ts })
    void toBackground({ type: 'notify', id: `text:${m.id}`, title: from, message: m.body.slice(0, 200), buttons: ['Copy'] })
  })
  narad.on('clip', async ({ body, contact }) => {
    if (!contact?.syncClipboard) return
    await writeClipboard(body)
    lastClipHash = hashText(body)
  })
  await narad.start()
  if (!displayName) narad.me.name = `${nameFor(narad.me.deviceId).name} · Chrome`
  setInterval(() => void clipboardTick(), 1500)
}

// ---- clipboard sync (offscreen documents may read the clipboard via execCommand('paste')) ----
let lastClipHash = ''
function hashText(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return `${s.length}:${h >>> 0}`
}
function readClipboardText(): string {
  const ta = document.createElement('textarea')
  document.body.appendChild(ta)
  ta.focus()
  document.execCommand('paste')
  const v = ta.value
  ta.remove()
  return v
}
async function writeClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}
async function clipboardTick() {
  if (!narad?.clipboardSyncActive()) return
  let text = ''
  try {
    text = readClipboardText()
  } catch {
    return
  }
  if (!text || text.length > 200_000) return
  const h = hashText(text)
  if (h === lastClipHash) return
  const first = lastClipHash === ''
  lastClipHash = h
  if (first) return
  await narad.broadcastClip(text)
}

function accept(transfer: Transfer, decision: IncomingDecision) {
  decision.accept(
    async (meta) =>
      new MemorySink(meta, (blob) => {
        const url = URL.createObjectURL(blob)
        void toBackground({ type: 'download', url, filename: meta.name })
        pushInbox({ id: `${transfer.id}:${meta.index}`, peerName: peerName(transfer.peerId), kind: 'file', body: meta.name, ts: Date.now() })
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000)
      }),
  )
}

function pushInbox(item: InboxItem) {
  state.inbox = [item, ...state.inbox].slice(0, 30)
}
const peerName = (id: string) => {
  const p = state.peers.find((x) => x.info.id === id)
  return p?.via.contact?.name ?? p?.info.name ?? 'Device'
}
const fmt = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`)

async function fetchAsFile(url: string, name?: string): Promise<File | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    const ext = (blob.type.split('/')[1] ?? 'bin').split(';')[0]
    const guessed = name ?? (decodeURIComponent(new URL(url).pathname.split('/').pop() || '') || `narad-${Date.now()}.${ext}`)
    return new File([blob], guessed.includes('.') ? guessed : `${guessed}.${ext}`, { type: blob.type })
  } catch {
    return undefined
  }
}

chrome.runtime.onMessage.addListener((msg: ToOffscreen, _sender, sendResponse) => {
  if (msg.target !== 'offscreen') return false
  void (async () => {
    try {
      switch (msg.type) {
        case 'state':
          return sendResponse(state)
        case 'set-last':
          state.lastPeer = msg.peerId
          return sendResponse(true)
        case 'send-text':
          state.lastPeer = msg.peerId
          await narad.sendText(msg.peerId, msg.body)
          return sendResponse(true)
        case 'send-url': {
          state.lastPeer = msg.peerId
          const file = await fetchAsFile(msg.url, msg.name)
          if (file) await narad.sendFiles(msg.peerId, [file])
          else await narad.sendText(msg.peerId, msg.url)
          return sendResponse(true)
        }
        case 'send-blob-urls': {
          state.lastPeer = msg.peerId
          const files: File[] = []
          for (const f of msg.files) {
            const blob = await (await fetch(f.url)).blob()
            files.push(new File([blob], f.name, { type: f.type }))
          }
          await narad.sendFiles(msg.peerId, files)
          return sendResponse(true)
        }
        case 'incoming-decision': {
          const d = pending.get(msg.transferId)
          const entry = state.incoming.find((i) => i.transfer.id === msg.transferId)
          pending.delete(msg.transferId)
          state.incoming = state.incoming.filter((i) => i.transfer.id !== msg.transferId)
          if (d && entry) msg.accept ? accept(entry.transfer, d) : d.reject()
          return sendResponse(true)
        }
        case 'pair-show': {
          pairHandle?.cancel()
          const h = narad.startPairing()
          pairHandle = h
          state.pairing = { mode: 'show', code: h.code }
          h.done.then((c) => (state.pairing = { mode: 'done', name: c.name })).catch((e: Error) => {
            if (e.message !== 'cancelled') state.pairing = { mode: 'error', message: e.message }
          })
          return sendResponse(h.code)
        }
        case 'pair-enter':
          state.pairing = { mode: 'enter' }
          narad.joinPairing(msg.code).then((c) => (state.pairing = { mode: 'done', name: c.name })).catch((e: Error) => (state.pairing = { mode: 'error', message: e.message }))
          return sendResponse(true)
        case 'pair-reset':
          pairHandle?.cancel()
          state.pairing = { mode: 'idle' }
          return sendResponse(true)
        case 'join-space': {
          const parsed = parseSpaceLink(msg.link)
          if (!parsed) return sendResponse(false)
          await narad.joinSpace(parsed)
          return sendResponse(true)
        }
        case 'leave-space':
          await narad.leaveSpace(msg.secret)
          return sendResponse(true)
        case 'remove-contact':
          await narad.removeContact(msg.deviceId)
          return sendResponse(true)
        case 'nudge':
          return sendResponse(await narad.nudge(msg.deviceId))
        case 'set-contact':
          await narad.updateContact(msg.deviceId, msg.patch)
          return sendResponse(true)
        case 'copy':
          await navigator.clipboard.writeText(msg.text).catch(() => {})
          return sendResponse(true)
      }
    } catch (err) {
      sendResponse({ error: (err as Error).message })
    }
  })()
  return true
})

void boot()
