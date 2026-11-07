import { useRef, useState } from 'react'
import type { ContactView, PeerView } from '@narad/core'
import { Icon, type IconName } from '@narad/icons'
import { useStore } from '../store'
import { t } from '../i18n'
import { filesFromDrop } from '../sinks'

const DEVICE_ICON: Record<'desktop' | 'mobile' | 'tablet', IconName> = { desktop: 'laptop', mobile: 'phone', tablet: 'tablet' }

export function PeerGrid() {
  const { peers, contacts, selected, lang, multi, toggleMulti } = useStore()
  const d = t(lang)
  const offline = contacts.filter((c) => c.online.length === 0)
  const multiMode = multi.length > 0
  if (peers.length === 0 && offline.length === 0)
    return (
      <div className="card rise relative flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-10 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_220px_at_50%_30%,rgb(255_138_61/0.12),transparent_70%)]" />
        <div className="relative mb-2 flex h-32 w-32 items-center justify-center">
          <div className="orbit absolute inset-0 rounded-full border border-dashed border-kesar-500/30" />
          <div className="orbit-rev absolute inset-3 rounded-full border border-accent-400/25" />
          <div className="absolute inset-6 rounded-full bg-kesar-500/20 blur-xl diya-glow" />
          <div className="float relative text-6xl drop-shadow-[0_8px_24px_rgb(255_138_61/0.5)]">🪔</div>
        </div>
        <div className="relative text-2xl font-extrabold tracking-tight">{d.noPeers}</div>
        <p className="relative max-w-sm text-sm leading-relaxed text-ash">{d.noPeersHint}</p>
      </div>
    )
  return (
    <div className="space-y-5">
      {peers.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-ash">
          {multiMode ? (
            <>
              <span className="pill-neel" data-testid="multi-count">
                <Icon name="users" size={12} /> {d.selected(multi.length)}
              </span>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => toggleMulti(undefined)}>
                <Icon name="x" size={12} /> {d.clear}
              </button>
            </>
          ) : (
            <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => toggleMulti(peers[0]!.info.id)} data-testid="select-many">
              <Icon name="checkSquare" size={13} /> {d.selectMany}
            </button>
          )}
        </div>
      )}
      {peers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {peers.map((p, i) => (
            <PeerCard key={p.info.id} peer={p} active={selected === p.info.id} multi={multiMode ? multi.includes(p.info.id) : undefined} index={i} />
          ))}
        </div>
      )}
      {multiMode && <MultiBar />}
      {offline.length > 0 && (
        <div>
          <div className="eyebrow mb-3">{d.offlineContacts}</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {offline.map((c) => (
              <OfflineContact key={c.deviceId} contact={c} />
            ))}
          </div>
        </div>
      )}
      {!selected && peers.length > 0 && <div className="pt-2 text-center text-xs text-ash-dim">{d.selectPeer}</div>}
    </div>
  )
}

function Badges({ peer }: { peer: PeerView }) {
  const { lang } = useStore()
  const d = t(lang)
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {peer.via.contact && (
        <span className="pill-sona px-1.5 py-0.5 text-[10px]" title={d.via.contact} data-testid="badge-contact">
          <Icon name="star" size={10} fill /> {d.contact}
        </span>
      )}
      {peer.via.spaces.map((s) => (
        <span key={s.secret} className="pill-neel px-1.5 py-0.5 text-[10px]" title={d.via.space} data-testid="badge-space">
          @{s.name}
        </span>
      ))}
      {peer.via.sabha && !peer.via.contact && peer.via.spaces.length === 0 && (
        <span className="pill-dim px-1.5 py-0.5 text-[10px]">
          <Icon name="wifi" size={10} /> {d.nearby}
        </span>
      )}
    </div>
  )
}

function MultiBar() {
  const { multi, lang, sendFilesMulti, sendTextMulti, sendClipboardMulti } = useStore()
  const d = t(lang)
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  return (
    <div className="card-float rise sticky bottom-2 flex flex-wrap items-center gap-2 border-neel-400/25 p-3" data-testid="multi-bar">
      <span className="pill-neel">
        <Icon name="users" size={12} /> {d.sendToAll} · {multi.length}
      </span>
      <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => void sendFilesMulti(Array.from(e.target.files ?? []))} />
      <button className="btn-ghost" onClick={() => fileInput.current?.click()}>
        <Icon name="paperclip" /> {d.sendFiles}
      </button>
      <button className="btn-ghost" onClick={() => void sendClipboardMulti()}>
        <Icon name="clipboard" /> {d.sendClipboard}
      </button>
      <form
        className="flex min-w-[200px] flex-1 gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void sendTextMulti(text)
          setText('')
        }}
      >
        <input className="input" placeholder={d.typeMessage} value={text} onChange={(e) => setText(e.target.value)} data-testid="multi-text" />
        <button className="btn-primary" disabled={!text.trim()} data-testid="multi-send">
          <Icon name="send" size={15} /> {d.send}
        </button>
      </form>
    </div>
  )
}

function PeerCard({ peer, active, multi, index }: { peer: PeerView; active: boolean; multi?: boolean; index: number }) {
  const { select, sendFiles, lang, unread, transfers, toggleMulti } = useStore()
  const d = t(lang)
  const over = useRef(false)
  const busy = Object.values(transfers).some((x) => x.peerId === peer.info.id && x.status === 'active')
  const secure = peer.state === 'secure'
  const stateLabel = secure ? d.secure : peer.state === 'connecting' || peer.state === 'connected' ? d.connecting : ''
  const route = peer.route ? d.route[peer.route] : ''
  const displayName = peer.via.contact?.name ?? peer.info.name

  return (
    <button
      data-testid="peer-card"
      data-peer-name={displayName}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={`card rise group relative flex flex-col items-center gap-2.5 p-4 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-line/[0.14] focus-visible:outline-none ${
        active ? 'border-accent-400/60 shadow-glow' : ''
      } ${multi ? 'border-neel-400/60 shadow-glow-neel' : ''}`}
      onClick={(e) => (multi !== undefined || e.shiftKey || e.metaKey || e.ctrlKey ? toggleMulti(peer.info.id) : select(peer.info.id))}
      aria-pressed={multi}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        over.current = true
        e.currentTarget.classList.add('ring-2', 'ring-emerald-400')
      }}
      onDragLeave={(e) => {
        over.current = false
        e.currentTarget.classList.remove('ring-2', 'ring-emerald-400')
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.classList.remove('ring-2', 'ring-emerald-400')
        useStore.getState().setDragging(false)
        select(peer.info.id)
        void filesFromDrop(e.dataTransfer).then(({ files, paths }) => sendFiles(peer.info.id, files, paths))
      }}
    >
      {multi !== undefined && (
        <span className={`absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-md border transition ${multi ? 'border-neel-400 bg-neel-400 text-night-950' : 'border-line/20 bg-line/5 text-transparent'}`}>
          <Icon name="check" size={12} strokeWidth={3} />
        </span>
      )}
      {unread[peer.info.id] ? (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-gradient-to-br from-sona-400 to-kesar-500 px-1.5 text-[11px] font-bold text-night-950 shadow-glow-kesar">{unread[peer.info.id]}</span>
      ) : null}
      <div className={`avatar h-16 w-16 text-3xl transition-transform duration-300 group-hover:scale-105 ${secure ? 'avatar-ring' : ''} ${busy ? 'pulse-ring' : ''}`}>{peer.emoji}</div>
      <div className="font-semibold leading-tight tracking-tight">{displayName}</div>
      <div className="flex items-center gap-1 text-[11px] text-ash">
        <Icon name={DEVICE_ICON[peer.info.device.type]} size={12} /> {peer.info.device.os} · {peer.info.device.browser}
      </div>
      <Badges peer={peer} />
      <div className="flex h-5 items-center gap-1 text-xs">
        {secure ? (
          <span className="pill-ok px-2 py-0.5" title={peer.sas?.join(' ')}>
            <Icon name="lock" size={11} /> {stateLabel}
            {route ? ` · ${route}` : ''}
          </span>
        ) : stateLabel ? (
          <span className="pill-warn px-2 py-0.5">{stateLabel}</span>
        ) : null}
      </div>
    </button>
  )
}

function OfflineContact({ contact }: { contact: ContactView }) {
  const { lang, removeContact, nudge, push } = useStore()
  const d = t(lang)
  return (
    <div className="card rise relative flex flex-col items-center gap-2 p-4 text-center opacity-70 transition hover:opacity-100" data-testid="offline-contact">
      <button className="absolute right-2 top-2 text-ash-dim transition hover:text-rose-300" title={d.removeContact} onClick={() => void removeContact(contact.deviceId)}>
        <Icon name="x" size={13} />
      </button>
      <div className="avatar h-16 w-16 text-3xl grayscale">{contact.emoji}</div>
      <div className="font-semibold leading-tight tracking-tight">{contact.name}</div>
      <div className="flex items-center gap-1 text-[11px] text-ash-dim">
        <Icon name="star" size={10} fill className="text-sona-400/70" /> {d.contact} · {d.offline}
      </div>
      {push !== 'unsupported' && push !== 'unavailable' && (
        <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => void nudge(contact.deviceId)} title={d.nudge}>
          <Icon name="bell" size={13} /> {d.nudge}
        </button>
      )}
    </div>
  )
}
