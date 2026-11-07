import { useEffect, useRef, useState } from 'react'
import type { PeerView } from '@narad/core'
import { Icon } from '@narad/icons'
import { send, type EngineState } from '../messages'

const EMPTY: EngineState = { peers: [], contacts: [], spaces: [], transfers: [], incoming: [], inbox: [], pairing: { mode: 'idle' }, signaling: 'connecting' }

async function readClipboard(): Promise<{ text?: string; files: { url: string; name: string; type: string }[] }> {
  const files: { url: string; name: string; type: string }[] = []
  let text: string | undefined
  try {
    for (const item of await navigator.clipboard.read()) {
      const img = item.types.find((t) => t.startsWith('image/'))
      if (img) {
        const blob = await item.getType(img)
        files.push({ url: URL.createObjectURL(blob), name: `clipboard-${Date.now()}.${img.split('/')[1]}`, type: img })
      } else if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text()
    }
  } catch {
    try {
      text = await navigator.clipboard.readText()
    } catch {
      /* no access */
    }
  }
  return { text, files }
}

export function App() {
  const [s, setS] = useState<EngineState>(EMPTY)
  const [flash, setFlash] = useState<string>()
  const [code, setCode] = useState('')
  const [spaceLink, setSpaceLink] = useState('')
  const [tab, setTab] = useState<'devices' | 'inbox' | 'pair'>('devices')
  const fileInput = useRef<HTMLInputElement>(null)
  const target = useRef<string>()

  useEffect(() => {
    let alive = true
    const tick = async () => {
      await send({ target: 'background', type: 'ensure-offscreen' })
      const st = await send<EngineState>({ target: 'offscreen', type: 'state' }).catch(() => undefined)
      if (alive && st) setS(st)
    }
    void tick()
    const id = setInterval(tick, 1000)
    // Keyboard command "send clipboard to last device" opened us with a pending flag.
    void chrome.storage.session.get('pendingClipboard').then(async (r) => {
      if (!r.pendingClipboard) return
      await chrome.storage.session.remove('pendingClipboard')
      const st = await send<EngineState>({ target: 'offscreen', type: 'state' })
      if (st.lastPeer) await sendClipboard(st.lastPeer)
    })
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const toast = (m: string) => {
    setFlash(m)
    setTimeout(() => setFlash(undefined), 2500)
  }

  async function sendClipboard(peerId: string) {
    const { text, files } = await readClipboard()
    if (files.length) await send({ target: 'offscreen', type: 'send-blob-urls', peerId, files })
    else if (text?.trim()) await send({ target: 'offscreen', type: 'send-text', peerId, body: text })
    else return toast('Clipboard is empty')
    toast('Sent ✓')
  }
  async function sendPage(peerId: string) {
    // Prefer the active web tab; never share our own extension pages.
    const tabs = (await chrome.tabs.query({ lastFocusedWindow: true })).filter((t) => t.url && !t.url.startsWith('chrome-extension://'))
    const tab = tabs.find((t) => t.active) ?? tabs.sort((a, b) => ((b as { lastAccessed?: number }).lastAccessed ?? 0) - ((a as { lastAccessed?: number }).lastAccessed ?? 0))[0]
    if (tab?.url) {
      await send({ target: 'offscreen', type: 'send-text', peerId, body: tab.title ? `${tab.title}\n${tab.url}` : tab.url })
      toast('Sent ✓')
    }
  }
  async function sendFiles(peerId: string, list: FileList | null) {
    const files = Array.from(list ?? []).map((f) => ({ url: URL.createObjectURL(f), name: f.name, type: f.type }))
    if (!files.length) return
    await send({ target: 'offscreen', type: 'send-blob-urls', peerId, files })
    toast('Sending…')
  }

  const name = (p: PeerView) => p.via.contact?.name ?? p.info.name
  const active = s.transfers.filter((t) => t.status === 'active')

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <img src="icon48.png" className="h-6 w-6 rounded-md" alt="" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold leading-tight">Narad</div>
          <div className="truncate text-[10px] text-ash">{s.me ? `${s.me.name} · ${s.myId}` : 'starting…'}</div>
        </div>
        <span className={`h-2 w-2 rounded-full ${s.signaling === 'open' ? 'bg-emerald-400' : 'bg-amber-400'}`} title={s.signaling} />
      </header>

      <nav className="flex border-b border-white/10 text-xs">
        {(['devices', 'inbox', 'pair'] as const).map((t) => (
          <button key={t} className={`flex-1 py-1.5 capitalize ${tab === t ? 'border-b-2 border-accent-400 text-accent-300' : 'text-ash'}`} onClick={() => setTab(t)}>
            {t === 'devices' ? `Devices (${s.peers.length})` : t === 'inbox' ? `Inbox${s.inbox.length ? ` (${s.inbox.length})` : ''}` : 'Pair / Spaces'}
          </button>
        ))}
      </nav>

      {s.incoming.map(({ transfer, from }) => (
        <div key={transfer.id} className="m-2 rounded-lg border border-accent-400/40 bg-accent-400/10 p-2 text-xs">
          <div className="font-medium">
            {from} → {transfer.files.map((f) => f.name).join(', ')}
          </div>
          <div className="mt-1 flex gap-1">
            <button className="btn-primary flex-1" onClick={() => void send({ target: 'offscreen', type: 'incoming-decision', transferId: transfer.id, accept: true })}>
              Accept
            </button>
            <button className="btn-ghost flex-1" onClick={() => void send({ target: 'offscreen', type: 'incoming-decision', transferId: transfer.id, accept: false })}>
              Decline
            </button>
          </div>
        </div>
      ))}

      {tab === 'devices' && (
        <div className="max-h-[420px] overflow-y-auto p-2">
          {s.peers.length === 0 && s.contacts.length === 0 && (
            <div className="p-4 text-center text-xs text-ash">No device online. Open Narad on another device on this Wi‑Fi, or pair one.</div>
          )}
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => void sendFiles(target.current!, e.target.files)} />
          {s.peers.map((p) => (
            <div key={p.info.id} className={`mb-2 rounded-lg border p-2 ${s.lastPeer === p.info.id ? 'border-accent-400/50 bg-white/5' : 'border-white/10'}`}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {name(p)} {p.via.contact ? <Icon name="star" size={10} fill className="text-sona-400" /> : null}
                  </div>
                  <div className="truncate text-[10px] text-ash">
                    {p.info.device.os} · {p.info.device.browser}
                    {p.via.spaces.map((sp) => ` · @${sp.name}`).join('')}
                    {p.state === 'secure' ? <> · <Icon name="lock" size={10} className="text-emerald-300" /></> : null}
                  </div>
                </div>
              </div>
              {p.via.contact && (
                <div className="mt-1 flex gap-3 text-[10px] text-ash">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!p.via.contact.autoAccept} onChange={(e) => void send({ target: 'offscreen', type: 'set-contact', deviceId: p.via.contact!.deviceId, patch: { autoAccept: e.target.checked } })} />
                    auto‑accept
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!p.via.contact.syncClipboard} onChange={(e) => void send({ target: 'offscreen', type: 'set-contact', deviceId: p.via.contact!.deviceId, patch: { syncClipboard: e.target.checked } })} />
                    clipboard sync
                  </label>
                </div>
              )}
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                <button className="btn-ghost" onClick={() => void sendClipboard(p.info.id)} title="Send clipboard">
                  <Icon name="clipboard" size={12} /> Clipboard
                </button>
                <button className="btn-ghost" onClick={() => void sendPage(p.info.id)} title="Send this page's link">
                  <Icon name="link" size={12} /> Page
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    target.current = p.info.id
                    fileInput.current?.click()
                  }}
                >
                  <Icon name="paperclip" size={12} /> Files
                </button>
              </div>
            </div>
          ))}
          {s.contacts
            .filter((c) => c.online.length === 0)
            .map((c) => (
              <div key={c.deviceId} className="mb-2 flex items-center gap-2 rounded-lg border border-white/5 p-2 opacity-50">
                <span className="text-xl grayscale">{c.emoji}</span>
                <div className="flex-1 truncate">{c.name} <Icon name="star" size={10} fill className="text-sona-400" /> · offline</div>
                <button className="btn-ghost" title="Nudge (push)" onClick={() => void send<string>({ target: 'offscreen', type: 'nudge', deviceId: c.deviceId }).then((r) => toast(r === 'sent' ? 'Nudge sent' : r === 'no-subscription' ? 'They have nudges off' : r === 'too-soon' ? 'Already nudged' : 'Push unavailable'))}>
                  <Icon name="bell" size={12} />
                </button>
                <button className="text-ash/70 hover:text-rose-300" onClick={() => void send({ target: 'offscreen', type: 'remove-contact', deviceId: c.deviceId })}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          {active.map((t) => (
            <div key={t.id} className="mb-1 text-[10px] text-ash">
              {t.direction === 'send' ? '⬆' : '⬇'} {t.files[0]?.name} · {Math.round((t.bytesDone / Math.max(1, t.bytesTotal)) * 100)}%
            </div>
          ))}
          <div className="mt-1 text-center text-[10px] text-ash/70">Right‑click anything on a page → Send to Narad · ⌘/Ctrl+Shift+Y sends clipboard to last device</div>
        </div>
      )}

      {tab === 'inbox' && (
        <div className="max-h-[420px] overflow-y-auto p-2">
          {s.inbox.length === 0 && <div className="p-4 text-center text-xs text-ash">Nothing received yet.</div>}
          {s.inbox.map((i) => (
            <div key={i.id} className="mb-2 rounded-lg border border-white/10 p-2 text-xs">
              <div className="flex justify-between text-[10px] text-ash">
                <span>{i.peerName}</span>
                <span>{new Date(i.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words">{i.kind === 'file' ? <><Icon name="download" size={11} /> {i.body} (downloaded)</> : i.body}</div>
              {i.kind === 'text' && (
                <button className="btn-ghost mt-1" onClick={() => navigator.clipboard.writeText(i.body).then(() => toast('Copied ✓'))}>
                  Copy
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'pair' && (
        <div className="space-y-3 p-3 text-xs">
          <div className="rounded-lg border border-white/10 p-2">
            <div className="mb-1 font-medium">Pair a device (SPAKE2)</div>
            {s.pairing.mode === 'idle' && (
              <div className="flex gap-1">
                <button className="btn-primary flex-1" onClick={() => void send({ target: 'offscreen', type: 'pair-show' })}>
                  Show my code
                </button>
                <form
                  className="flex flex-1 gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void send({ target: 'offscreen', type: 'pair-enter', code })
                    setCode('')
                  }}
                >
                  <input className="input" placeholder="their code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
                  <button className="btn-ghost" disabled={code.length !== 6}>
                    Go
                  </button>
                </form>
              </div>
            )}
            {s.pairing.mode === 'show' && (
              <div className="text-center">
                <div className="font-mono text-3xl tracking-[0.3em]">{s.pairing.code}</div>
                <div className="text-[10px] text-amber-300">Enter this code on the other device · waiting…</div>
              </div>
            )}
            {s.pairing.mode === 'enter' && <div className="text-amber-300">Pairing…</div>}
            {s.pairing.mode === 'done' && <div className="text-emerald-300"><Icon name="checkCircle" size={12} /> Paired with {s.pairing.name}</div>}
            {s.pairing.mode === 'error' && <div className="text-rose-300">Failed: {s.pairing.message}</div>}
            {s.pairing.mode !== 'idle' && (
              <button className="btn-ghost mt-2 w-full" onClick={() => void send({ target: 'offscreen', type: 'pair-reset' })}>
                Reset
              </button>
            )}
          </div>
          <div className="rounded-lg border border-white/10 p-2">
            <div className="mb-1 font-medium">Spaces</div>
            {s.spaces.map((sp) => (
              <div key={sp.secret} className="flex items-center justify-between py-0.5">
                <span>
                  @{sp.name} · {sp.members.length} online
                </span>
                <button className="text-ash/70 hover:text-rose-300" onClick={() => void send({ target: 'offscreen', type: 'leave-space', secret: sp.secret })}>
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
            <form
              className="mt-1 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                void send<boolean>({ target: 'offscreen', type: 'join-space', link: spaceLink }).then((ok) => toast(ok ? 'Joined ✓' : 'Invalid link'))
                setSpaceLink('')
              }}
            >
              <input className="input" placeholder="paste space invite link" value={spaceLink} onChange={(e) => setSpaceLink(e.target.value)} />
              <button className="btn-ghost" disabled={!spaceLink.trim()}>
                Join
              </button>
            </form>
            <div className="mt-1 text-[10px] text-ash/70">Create spaces from the Narad web app.</div>
          </div>
        </div>
      )}

      {flash && <div className="fixed inset-x-0 bottom-2 mx-auto w-max rounded-lg bg-emerald-500 px-3 py-1 text-xs text-night-950 shadow">{flash}</div>}
    </div>
  )
}
