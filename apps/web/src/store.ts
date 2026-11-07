import { create } from 'zustand'
import {
  getSetting, naradId, Narad, parseSpaceLink, setSetting, spaceLink,
  type ChatMessage, type Contact, type ContactView, type FileMeta, type IncomingDecision, type PeerInfo, type PeerView, type RoomStatus, type ShareHandle, type ShareItems, type SpaceView, type Transfer,
} from '@narad/core'
import { t, type Lang } from './i18n'
import { hasFsAccess, memorySinks, pickDiskSinks, triggerDownload } from './sinks'

export interface ReceivedFile {
  meta: FileMeta
  blob?: Blob
  savedToDisk: boolean
}
export interface Toast {
  id: number
  text: string
  kind?: 'info' | 'error' | 'success'
  action?: { label: string; run: () => void }
}
export type PairingState =
  | { mode: 'idle' }
  | { mode: 'show'; code: string; status: 'waiting' | 'pairing' }
  | { mode: 'enter'; code: string; status: 'idle' | 'pairing' }
  | { mode: 'done'; contact: Contact }
  | { mode: 'error'; message: string }

interface State {
  narad?: Narad
  me?: PeerInfo
  myId?: string
  peers: PeerView[]
  contacts: ContactView[]
  spaces: SpaceView[]
  rooms: Record<string, RoomStatus>
  sabhaEnabled: boolean
  selected?: string
  transfers: Record<string, Transfer>
  received: Record<string, ReceivedFile[]>
  messages: Record<string, ChatMessage[]>
  unread: Record<string, number>
  incoming: { transfer: Transfer; decision: IncomingDecision }[]
  toasts: Toast[]
  lang: Lang
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  dragging: boolean
  dialog?: 'pair' | 'spaces' | 'share' | 'receive'
  pairing: PairingState
  share?: { code: string; status: 'open' | 'stopped' | 'expired'; summary: string; sent: { peerId: string; name: string }[] }
  receive?: { code: string; status: 'joining' | 'connected' | 'error'; peerId?: string; message?: string }

  init: () => Promise<void>
  select: (peerId?: string) => void
  sendFiles: (peerId: string, files: File[], paths?: (string | undefined)[]) => Promise<void>
  sendText: (peerId: string, body: string) => Promise<void>
  sendClipboard: (peerId: string) => Promise<void>
  acceptIncoming: (transferId: string) => Promise<void>
  rejectIncoming: (transferId: string) => void
  cancelTransfer: (t: Transfer) => void
  joinRoom: (code: string) => void
  leaveRoom: (code: string) => void
  rename: (name: string) => Promise<void>
  setLang: (lang: Lang) => void
  toast: (text: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
  setDragging: (v: boolean) => void
  downloadReceived: (transferId: string, index: number) => void
  openDialog: (d?: State['dialog']) => void
  showPairCode: () => void
  enterPairCode: (code: string) => Promise<void>
  setPairing: (p: PairingState) => void
  removeContact: (deviceId: string) => Promise<void>
  setAutoAccept: (deviceId: string, v: boolean) => Promise<void>
  setSyncClipboard: (deviceId: string, v: boolean) => Promise<void>
  pendingClip?: { body: string; from: string }
  applyPendingClip: () => Promise<void>
  multi: string[]
  toggleMulti: (peerId?: string) => void
  selectAllIn: (peerIds: string[]) => void
  sendFilesMulti: (files: File[], paths?: (string | undefined)[]) => Promise<void>
  sendTextMulti: (body: string) => Promise<void>
  sendClipboardMulti: () => Promise<void>
  push: 'unsupported' | 'unavailable' | 'off' | 'on'
  togglePush: () => Promise<void>
  nudge: (deviceId: string) => Promise<void>
  createSpace: (name: string) => Promise<void>
  joinSpaceLink: (link: string) => Promise<void>
  leaveSpace: (secret: string) => Promise<void>
  spaceInvite: (s: SpaceView) => string
  startShare: (items: ShareItems) => void
  stopShare: () => void
  joinShare: (code: string) => Promise<void>
  addShareContact: (peerId: string) => Promise<void>
  shareLink: (code: string) => string
}

/** Site host for this deployment: app.example.com → example.com (used for copy like "open example.com/receive"). */
export const SITE_HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'narad.sh' : location.hostname.replace(/^(app|www)\./, '')
/** Signaling URL: VITE_SIGNALING_URL at build time; otherwise derived from the host, so app.<domain> talks to signaling.<domain> with zero config. */
const SIGNALING_URL =
  (import.meta.env.VITE_SIGNALING_URL as string | undefined) ||
  (location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? `wss://signaling.${SITE_HOST}/ws`
    : `ws://${location.hostname}:8794/ws`)

function iceServers(): RTCIceServer[] | undefined {
  const raw = import.meta.env.VITE_ICE_SERVERS as string | undefined
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as RTCIceServer[]
  } catch {
    console.warn('[narad] VITE_ICE_SERVERS is not valid JSON')
    return undefined
  }
}

let toastSeq = 0
let initStarted = false
let pairHandle: ReturnType<Narad['startPairing']> | undefined
let shareHandle: ShareHandle | undefined

export const useStore = create<State>((set, get) => ({
  peers: [],
  contacts: [],
  spaces: [],
  rooms: {},
  sabhaEnabled: new URLSearchParams(location.search).get('sabha') !== '0',
  transfers: {},
  received: {},
  messages: {},
  unread: {},
  incoming: [],
  toasts: [],
  lang: (localStorage.getItem('narad:lang') as Lang) || (navigator.language.startsWith('hi') ? 'hi' : 'en'),
  theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  dragging: false,
  pairing: { mode: 'idle' },
  multi: [],
  push: 'PushManager' in window && 'serviceWorker' in navigator ? 'unavailable' : 'unsupported',

  async init() {
    if (get().narad || initStarted) return
    initStarted = true
    const displayName = await getSetting<string>('displayName')
    const narad = new Narad({ signalingUrl: SIGNALING_URL, iceServers: iceServers(), displayName, sabha: get().sabhaEnabled })
    narad.on('ready', (me) => set({ me, myId: naradId(me.name, me.deviceId) }))
    narad.on('peers', (peers) => {
      set({ peers })
      const sel = get().selected
      if (sel && !peers.some((p) => p.info.id === sel)) set({ selected: undefined })
      const multi = get().multi.filter((id) => peers.some((p) => p.info.id === id))
      if (multi.length !== get().multi.length) set({ multi })
    })
    narad.on('contacts', (contacts) => set({ contacts }))
    narad.on('share', (e) =>
      set((s) => {
        if (!s.share || s.share.code !== e.code) return {}
        if (e.event === 'sent') return { share: { ...s.share, sent: [...s.share.sent, { peerId: e.peerId!, name: e.name ?? '?' }] } }
        if (e.event === 'stopped') return { share: { ...s.share, status: e.reason === 'expired' ? 'expired' : 'stopped' } }
        get().toast(`${e.name ?? ''}: ${e.reason ?? 'failed'}`, 'error')
        return {}
      }),
    )
    narad.on('spaces', (spaces) => set({ spaces }))
    narad.on('room', ({ key, status }) =>
      set((s) => {
        const rooms = { ...s.rooms }
        if (status === 'closed' && !narad.rooms().some((r) => r.key === key)) delete rooms[key]
        else rooms[key] = status
        return { rooms }
      }),
    )
    narad.on('transfer', (t) =>
      set((s) => ({
        transfers: { ...s.transfers, [t.id]: { ...t } },
        incoming: t.status === 'pending' ? s.incoming : s.incoming.filter((i) => i.transfer.id !== t.id),
      })),
    )
    narad.on('incoming', (transfer, decision) => {
      const peer = narad.peers().find((p) => p.info.id === transfer.peerId)
      if (peer?.via.contact?.autoAccept) {
        set((s) => ({ received: { ...s.received, [transfer.id]: transfer.files.map((meta) => ({ meta, savedToDisk: false })) } }))
        decision.accept(memorySinks((blob, meta) => storeBlob(set, transfer.id, meta, blob)))
        get().toast(`⬇ ${peer.info.name}: ${transfer.files.map((f) => f.name).join(', ')}`)
        return
      }
      set((s) => ({ incoming: [...s.incoming, { transfer, decision }] }))
      notify(`${peer?.info.name ?? 'Someone'} → ${transfer.files.map((f) => f.name).join(', ')}`)
    })
    narad.on('message', (m) => {
      set((s) => ({
        messages: { ...s.messages, [m.peerId]: [...(s.messages[m.peerId] ?? []), m] },
        unread: m.direction === 'in' && s.selected !== m.peerId ? { ...s.unread, [m.peerId]: (s.unread[m.peerId] ?? 0) + 1 } : s.unread,
      }))
      if (m.direction === 'in') notify(`${narad.peers().find((p) => p.info.id === m.peerId)?.info.name ?? ''}: ${m.body.slice(0, 80)}`)
    })
    narad.on('clip', async ({ body, contact }) => {
      const from = contact?.name ?? 'peer'
      if (!contact?.syncClipboard) {
        set({ pendingClip: { body, from } })
        get().toast(`${t(get().lang).clipReceived} ${from}`, 'info')
        return
      }
      try {
        await navigator.clipboard.writeText(body)
        lastClipHash = hashText(body)
        get().toast(`📋 ${t(get().lang).clipApplied} ${from}`, 'success')
      } catch {
        set({ pendingClip: { body, from } }) // no focus: apply when the user comes back
      }
    })
    narad.on('complete', (t) => {
      if (t.direction === 'receive') {
        const inMemory = (get().received[t.id] ?? []).filter((f) => f.blob && !f.savedToDisk)
        if (inMemory.length === 1) triggerDownload(inMemory[0]!.blob!, inMemory[0]!.meta.name)
      }
    })
    set({ narad })
    ;(window as unknown as { __narad: Narad }).__narad = narad // dev/test hook
    await narad.start()
    if (narad.clipboardSyncActive()) startClipboardWatcher(get)
    void initPush(get, set)
    const code = new URLSearchParams(location.search).get('room')
    if (code) narad.joinRoom(code)
    await handleHash(get)
    window.addEventListener('hashchange', () => void handleHash(get))
  },

  select(peerId) {
    set((s) => ({ selected: peerId, unread: peerId ? { ...s.unread, [peerId]: 0 } : s.unread }))
  },

  async sendFiles(peerId, files, paths) {
    if (!files.length) return
    try {
      await get().narad!.sendFiles(peerId, files, paths)
    } catch (err) {
      get().toast((err as Error).message, 'error')
    }
  },

  async sendText(peerId, body) {
    if (!body.trim()) return
    try {
      await get().narad!.sendText(peerId, body)
    } catch (err) {
      get().toast((err as Error).message, 'error')
    }
  },

  async sendClipboard(peerId) {
    const files: File[] = []
    let text = ''
    try {
      if (navigator.clipboard.read) {
        for (const item of await navigator.clipboard.read()) {
          const imgType = item.types.find((t) => t.startsWith('image/'))
          if (imgType) {
            const blob = await item.getType(imgType)
            files.push(new File([blob], `clipboard-${Date.now()}.${imgType.split('/')[1] ?? 'png'}`, { type: imgType }))
          } else if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text()
        }
      } else text = await navigator.clipboard.readText()
    } catch {
      /* permission denied / unsupported */
    }
    if (files.length) await get().sendFiles(peerId, files)
    else if (text.trim()) await get().sendText(peerId, text)
    else get().toast('clipboardEmpty', 'info')
  },

  async acceptIncoming(transferId) {
    const entry = get().incoming.find((i) => i.transfer.id === transferId)
    if (!entry) return
    const { transfer, decision } = entry
    const useDisk = hasFsAccess && transfer.bytesTotal > 0
    let factory = useDisk ? await pickDiskSinks(transfer.files) : undefined
    if (useDisk && !factory) return // picker cancelled; keep the request visible
    const savedToDisk = !!factory
    set((s) => ({ received: { ...s.received, [transferId]: transfer.files.map((meta) => ({ meta, savedToDisk })) } }))
    factory ??= memorySinks((blob, meta) => storeBlob(set, transferId, meta, blob))
    decision.accept(factory)
    set((s) => ({ incoming: s.incoming.filter((i) => i.transfer.id !== transferId) }))
  },

  rejectIncoming(transferId) {
    get().incoming.find((i) => i.transfer.id === transferId)?.decision.reject()
    set((s) => ({ incoming: s.incoming.filter((i) => i.transfer.id !== transferId) }))
  },

  cancelTransfer(t) {
    get().narad?.cancel(t.peerId, t.id)
  },

  joinRoom(code) {
    const c = code.trim().toLowerCase()
    if (!c) return
    get().narad?.joinRoom(c)
    const url = new URL(location.href)
    url.searchParams.set('room', c)
    history.replaceState(null, '', url)
  },
  leaveRoom(code) {
    get().narad?.leaveRoom(code)
    const url = new URL(location.href)
    url.searchParams.delete('room')
    history.replaceState(null, '', url)
  },

  async rename(name) {
    await setSetting('displayName', name.trim().slice(0, 40))
    location.reload()
  },
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('narad:theme', theme)
    set({ theme })
  },
  setLang(lang) {
    localStorage.setItem('narad:lang', lang)
    set({ lang })
  },
  toast(text, kind = 'info') {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },
  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  setDragging(v) {
    if (get().dragging !== v) set({ dragging: v })
  },
  downloadReceived(transferId, index) {
    const f = get().received[transferId]?.find((x) => x.meta.index === index)
    if (f?.blob) triggerDownload(f.blob, f.meta.name)
  },

  // ---- pairing ----
  openDialog(d) {
    if (!d && get().pairing.mode === 'show') pairHandle?.cancel()
    set({ dialog: d, pairing: d ? get().pairing : { mode: 'idle' } })
  },
  setPairing(p) {
    set({ pairing: p })
  },
  showPairCode() {
    const narad = get().narad!
    pairHandle?.cancel()
    const handle = narad.startPairing()
    pairHandle = handle
    set({ dialog: 'pair', pairing: { mode: 'show', code: handle.code, status: 'waiting' } })
    handle.done
      .then((contact) => {
        if (pairHandle === handle) set({ pairing: { mode: 'done', contact } })
      })
      .catch((err: Error) => {
        if (pairHandle === handle && err.message !== 'cancelled') set({ pairing: { mode: 'error', message: err.message } })
      })
  },
  async enterPairCode(code) {
    const narad = get().narad!
    set({ dialog: 'pair', pairing: { mode: 'enter', code, status: 'pairing' } })
    try {
      const contact = await narad.joinPairing(code)
      set({ pairing: { mode: 'done', contact } })
    } catch (err) {
      set({ pairing: { mode: 'error', message: (err as Error).message } })
    }
  },
  async removeContact(deviceId) {
    await get().narad?.removeContact(deviceId)
  },
  async setAutoAccept(deviceId, v) {
    await get().narad?.updateContact(deviceId, { autoAccept: v })
  },
  async setSyncClipboard(deviceId, v) {
    await get().narad?.updateContact(deviceId, { syncClipboard: v })
    if (v) startClipboardWatcher(get)
  },
  // ---- group send ----
  toggleMulti(peerId) {
    if (!peerId) return set({ multi: [] })
    set((s) => ({ multi: s.multi.includes(peerId) ? s.multi.filter((x) => x !== peerId) : [...s.multi, peerId] }))
  },
  selectAllIn(peerIds) {
    set({ multi: [...new Set(peerIds)], selected: undefined, dialog: undefined })
  },
  async sendFilesMulti(files, paths) {
    const ids = get().multi
    if (!ids.length || !files.length) return
    const results = await get().narad!.sendFilesToMany(ids, files, paths)
    const ok = results.filter((r) => r.status === 'fulfilled').length
    get().toast(t(get().lang).sentTo(ok), ok === ids.length ? 'success' : 'error')
  },
  async sendTextMulti(body) {
    const ids = get().multi
    if (!ids.length || !body.trim()) return
    const results = await get().narad!.sendTextToMany(ids, body)
    const ok = results.filter((r) => r.status === 'fulfilled').length
    get().toast(t(get().lang).sentTo(ok), ok === ids.length ? 'success' : 'error')
  },
  async sendClipboardMulti() {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      /* no access */
    }
    if (text.trim()) await get().sendTextMulti(text)
    else get().toast('clipboardEmpty', 'info')
  },
  async togglePush() {
    const narad = get().narad!
    const d = t(get().lang)
    if (get().push === 'on') {
      await narad.unregisterPush()
      const reg = await navigator.serviceWorker.ready
      await (await reg.pushManager.getSubscription())?.unsubscribe()
      set({ push: 'off' })
      return
    }
    try {
      if ((await Notification.requestPermission()) !== 'granted') return
      const key = await narad.pushPublicKey()
      if (!key) return set({ push: 'unavailable' })
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      await narad.registerPush(sub.toJSON())
      set({ push: 'on' })
      get().toast(d.pushOn, 'success')
    } catch (err) {
      get().toast((err as Error).message, 'error')
    }
  },
  async nudge(deviceId) {
    const d = t(get().lang)
    const r = await get().narad!.nudge(deviceId)
    get().toast(r === 'sent' ? d.nudged : r === 'no-subscription' ? d.nudgeNoSub : r === 'too-soon' ? d.nudgeSoon : d.pairFailed, r === 'sent' ? 'success' : 'info')
  },
  async applyPendingClip() {
    const p = get().pendingClip
    if (!p) return
    try {
      await navigator.clipboard.writeText(p.body)
      lastClipHash = hashText(p.body)
      set({ pendingClip: undefined })
      get().toast(`${t(get().lang).clipApplied} ${p.from}`, 'success')
    } catch {
      /* needs focus; stays pending */
    }
  },

  // ---- spaces ----
  async createSpace(name) {
    if (!name.trim()) return
    const narad = get().narad!
    const space = await narad.createSpace(name)
    await navigator.clipboard.writeText(spaceLink(location.origin, space)).catch(() => {})
    get().toast(`${get().lang === 'hi' ? 'स्पेस बना, लिंक कॉपी हुआ' : 'Space created, invite link copied'}: ${space.name}`, 'success')
  },
  async joinSpaceLink(link) {
    const parsed = parseSpaceLink(link)
    if (!parsed) {
      get().toast('Invalid space link', 'error')
      return
    }
    const s = await get().narad!.joinSpace(parsed)
    get().toast(`✓ ${s.name}`, 'success')
  },
  async leaveSpace(secret) {
    await get().narad?.leaveSpace(secret)
  },
  spaceInvite(s) {
    return spaceLink(location.origin, s)
  },

  // ---- share by code ----
  startShare(items) {
    const narad = get().narad!
    shareHandle?.stop()
    const handle = narad.startShare(items)
    shareHandle = handle
    const n = items.files?.length ?? 0
    const summary = [n ? (n === 1 ? items.files![0]!.name : `${n} files`) : '', items.text?.trim() ? `“${items.text.trim().slice(0, 40)}${items.text.trim().length > 40 ? '…' : ''}”` : ''].filter(Boolean).join(' + ')
    set({ dialog: 'share', share: { code: handle.code, status: 'open', summary, sent: [] } })
  },
  stopShare() {
    shareHandle?.stop()
    shareHandle = undefined
    set((s) => ({ share: s.share ? { ...s.share, status: 'stopped' } : undefined }))
  },
  async joinShare(code) {
    const clean = code.replace(/\D/g, '')
    set({ dialog: 'receive', receive: { code: clean, status: 'joining' } })
    try {
      const peerId = await get().narad!.joinShare(clean)
      set({ receive: { code: clean, status: 'connected', peerId }, dialog: undefined })
      get().select(peerId)
    } catch (err) {
      set({ receive: { code: clean, status: 'error', message: (err as Error).message } })
    }
  },
  async addShareContact(peerId) {
    try {
      const c = await get().narad!.addShareContact(peerId)
      get().toast(`${t(get().lang).contactAdded}: ${c.name}`, 'success')
    } catch (err) {
      get().toast((err as Error).message, 'error')
    }
  },
  shareLink(code) {
    return `${location.origin}/#code=${code}`
  },
}))

async function initPush(get: () => State, set: (p: Partial<State>) => void) {
  if (get().push === 'unsupported') return
  const narad = get().narad!
  const key = await narad.pushPublicKey()
  if (!key) return set({ push: 'unavailable' })
  if (!narad.pushEnabled()) return set({ push: 'off' })
  // Re-file the current subscription (push services rotate endpoints; contacts may be new).
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
    await narad.registerPush(sub.toJSON())
    set({ push: 'on' })
  } catch {
    set({ push: 'off' })
  }
}

// ---- clipboard sync watcher: only while this tab is focused and some contact has sync on ----
let lastClipHash = ''
let clipTimer: ReturnType<typeof setInterval> | undefined
function hashText(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return `${s.length}:${h >>> 0}`
}
function startClipboardWatcher(get: () => State) {
  if (clipTimer) return
  const tick = async () => {
    const st = get()
    if (!document.hasFocus() || !st.narad?.clipboardSyncActive()) return
    if (st.pendingClip) void st.applyPendingClip()
    let text: string
    try {
      text = await navigator.clipboard.readText()
    } catch {
      return
    }
    if (!text || text.length > 200_000) return
    const h = hashText(text)
    if (h === lastClipHash) return
    const first = lastClipHash === ''
    lastClipHash = h
    if (first) return // don't push whatever was already there when sync started
    await st.narad!.broadcastClip(text)
  }
  clipTimer = setInterval(() => void tick(), 1500)
  window.addEventListener('focus', () => void tick())
}

function storeBlob(set: (fn: (s: State) => Partial<State>) => void, transferId: string, meta: FileMeta, blob: Blob) {
  set((s) => ({
    received: { ...s.received, [transferId]: (s.received[transferId] ?? []).map((f) => (f.meta.index === meta.index ? { ...f, blob } : f)) },
  }))
}

/** #pair=123456 → enter that code; #code=123456 → receive a share; #space=name.secret → join that space. The fragment never reaches the server. */
async function handleHash(get: () => State) {
  const hash = location.hash.slice(1)
  if (!hash) return
  const params = new URLSearchParams(hash)
  const pair = params.get('pair')
  const code = params.get('code')
  const space = parseSpaceLink(hash)
  history.replaceState(null, '', location.pathname + location.search)
  if (pair) await get().enterPairCode(pair)
  else if (code) await get().joinShare(code)
  else if (space) {
    await get().narad!.joinSpace(space)
    get().toast(`✓ ${space.name}`, 'success')
  }
}

function notify(body: string) {
  if (document.visibilityState === 'visible') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification('Narad', { body, icon: '/icon.svg' })
  } catch {
    /* noop */
  }
}
