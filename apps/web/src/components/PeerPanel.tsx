import { useEffect, useRef, useState } from 'react'
import type { Transfer } from '@narad/core'
import { Icon } from '@narad/icons'
import { useStore } from '../store'
import { t } from '../i18n'
import { formatBytes, formatSpeed, formatTime } from '../format'

export function PeerPanel() {
  const { selected, peers, messages, transfers, lang, select, sendText, sendFiles, sendClipboard, cancelTransfer, toast, setAutoAccept, setSyncClipboard, removeContact, addShareContact } = useStore()
  const d = t(lang)
  const peer = peers.find((p) => p.info.id === selected)
  const [text, setText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const msgs = selected ? (messages[selected] ?? []) : []
  const peerTransfers = Object.values(transfers)
    .filter((x) => x.peerId === selected)
    .sort((a, b) => a.startedAt - b.startedAt)

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [msgs.length, peerTransfers.length, selected])

  if (!peer || !selected) return null

  const submit = async () => {
    const body = text
    setText('')
    await sendText(selected, body)
  }
  const secure = peer.state === 'secure'

  return (
    <section className="card-float rise flex h-full flex-col overflow-hidden" data-testid="peer-panel">
      <div className="flex items-center gap-3 border-b border-line/[0.06] bg-line/[0.02] p-3">
        <button className="btn-icon lg:hidden" onClick={() => select(undefined)} aria-label="back">
          <Icon name="arrowLeft" />
        </button>
        <div className={`avatar h-11 w-11 text-2xl ${secure ? 'avatar-ring' : ''}`}>{peer.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate font-semibold tracking-tight">
            {peer.via.contact?.name ?? peer.info.name}
            {peer.via.contact ? <Icon name="star" size={12} fill className="text-sona-400" /> : null}
          </div>
          <div className="truncate text-xs text-ash">
            {secure && peer.sas ? (
              <span title={d.verified} className="inline-flex items-center gap-1.5">
                <Icon name="lock" size={11} className="text-emerald-300" />
                <span className="tracking-[0.2em]" data-testid="sas">{peer.sas.join(' ')}</span>
                {peer.route ? <span className="pill-dim px-1.5 py-0.5 text-[10px]">{d.route[peer.route]}</span> : null}
              </span>
            ) : peer.state === 'new' || peer.state === 'closed' ? (
              d.selectPeer
            ) : (
              <span className="text-amber-300">{d.connecting}</span>
            )}
          </div>
        </div>
        {!peer.via.contact && peer.via.share && secure && (
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => void addShareContact(peer.info.id)} title={d.addContact} data-testid="add-contact">
            <Icon name="star" size={13} className="text-sona-400" /> <span className="hidden sm:inline">{d.addContact}</span>
          </button>
        )}
        {peer.via.contact && (
          <div className="flex items-center gap-2 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5 text-ash transition hover:text-ivory" title={d.autoAccept}>
              <input type="checkbox" className="accent-accent-400" checked={!!peer.via.contact.autoAccept} onChange={(e) => void setAutoAccept(peer.via.contact!.deviceId, e.target.checked)} />
              <span className="hidden xl:inline">{d.autoAccept}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-ash transition hover:text-ivory" title={d.syncClipboard}>
              <input type="checkbox" className="accent-accent-400" data-testid="sync-clip" checked={!!peer.via.contact.syncClipboard} onChange={(e) => void setSyncClipboard(peer.via.contact!.deviceId, e.target.checked)} />
              <Icon name="clipboardSync" size={15} className="text-accent-300" />
            </label>
            <button className="text-ash-dim transition hover:text-rose-300" title={d.removeContact} onClick={() => void removeContact(peer.via.contact!.deviceId)}>
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
      </div>

      <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto p-3">
        {msgs.length === 0 && peerTransfers.length === 0 && (
          <div className="fade flex h-full flex-col items-center justify-center gap-2 text-center text-ash-dim">
            <Icon name="mail" size={34} className="opacity-40" strokeWidth={1.4} />
            <div className="text-xs">{d.typeMessage}</div>
          </div>
        )}
        {[...msgs.map((m) => ({ k: 'm' as const, ts: m.ts, m })), ...peerTransfers.map((x) => ({ k: 't' as const, ts: x.startedAt, x }))]
          .sort((a, b) => a.ts - b.ts)
          .map((item) =>
            item.k === 'm' ? (
              <div key={item.m.id} className={`rise flex ${item.m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`group max-w-[85%] px-3.5 py-2 text-sm leading-relaxed shadow-[0_6px_18px_-10px_rgb(0_0_0/0.7)] ${
                    item.m.direction === 'out'
                      ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-accent-300 via-accent-400 to-accent-600 text-night-950'
                      : 'rounded-2xl rounded-bl-md border border-line/[0.07] bg-line/[0.07]'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words" data-testid="chat-message">{item.m.body}</div>
                  <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-60">
                    <button className="hidden group-hover:inline" onClick={() => navigator.clipboard.writeText(item.m.body).then(() => toast(d.copied, 'success'))}>
                      {d.copy}
                    </button>
                    {formatTime(item.m.ts)}
                  </div>
                </div>
              </div>
            ) : (
              <TransferCard key={item.x.id} transfer={item.x} onCancel={() => cancelTransfer(item.x)} />
            ),
          )}
      </div>

      <form
        className="flex items-end gap-2 border-t border-line/[0.06] bg-line/[0.02] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void sendFiles(selected, files)
          }}
        />
        <input
          ref={dirInput}
          type="file"
          className="hidden"
          data-testid="dir-input"
          // @ts-expect-error non-standard but universally supported
          webkitdirectory=""
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            void sendFiles(selected, files)
          }}
        />
        <button type="button" className="btn-icon" title={d.sendFiles} onClick={() => fileInput.current?.click()}>
          <Icon name="paperclip" />
        </button>
        <button type="button" className="btn-icon hidden sm:inline-flex" title={d.sendFolder} onClick={() => dirInput.current?.click()}>
          <Icon name="folder" />
        </button>
        <button type="button" className="btn-icon" title={`${d.sendClipboard} (⌘/Ctrl+Shift+V)`} onClick={() => void sendClipboard(selected)}>
          <Icon name="clipboard" />
        </button>
        <textarea
          className="input max-h-40 min-h-[38px] flex-1 resize-none"
          rows={1}
          placeholder={d.typeMessage}
          value={text}
          data-testid="composer"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
        />
        <button type="submit" className="btn-primary" disabled={!text.trim()} data-testid="send">
          <Icon name="send" size={15} /> {d.send}
        </button>
      </form>
    </section>
  )
}

function TransferCard({ transfer: x, onCancel }: { transfer: Transfer; onCancel: () => void }) {
  const { lang, received, downloadReceived } = useStore()
  const d = t(lang)
  const pct = x.bytesTotal ? Math.min(100, Math.round((x.bytesDone / x.bytesTotal) * 100)) : x.status === 'done' ? 100 : 0
  const files = received[x.id]
  const failed = x.status === 'error' || x.status === 'cancelled' || x.status === 'rejected'
  const live = x.status === 'active'
  return (
    <div className={`rise flex ${x.direction === 'send' ? 'justify-end' : 'justify-start'}`} data-testid="transfer" data-status={x.status}>
      <div className="w-[88%] rounded-2xl border border-line/[0.08] bg-night-950/60 p-3 text-sm shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${failed ? 'bg-rose-500/15 text-rose-300' : x.status === 'done' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-accent-400/15 text-accent-300'}`}>
            <Icon name={x.files[0]?.path ? 'folder' : x.direction === 'send' ? 'upload' : 'download'} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold tracking-tight">
              {x.files.length === 1 && !x.files[0]!.path ? x.files[0]!.name : x.files[0]?.path ? `${x.files[0]!.path.split('/')[0]} · ${x.files.length}` : `${x.files.length} files`}
            </div>
            <div className="text-[11px] text-ash">{formatBytes(x.bytesTotal)}</div>
          </div>
          <div className={`shrink-0 font-mono text-xs tabular-nums ${failed ? 'text-rose-300' : x.status === 'done' ? 'text-emerald-300' : 'text-accent-300'}`}>{pct}%</div>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line/[0.08]">
          <div className={`h-full rounded-full transition-all duration-300 ${failed ? 'bg-rose-400' : x.status === 'done' ? 'bg-emerald-400' : live ? 'progress-bar' : 'bg-accent-400/60'}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ash">
          <span>
            {d.status[x.status]}
            {live ? ` · ${formatSpeed(x.speed)}` : ''}
            {x.resumed ? ` · ${d.resumed} ×${x.resumed}` : ''}
            {x.error ? ` · ${x.error}` : ''}
          </span>
          {(x.status === 'active' || x.status === 'pending' || x.status === 'paused') && (
            <button className="font-semibold text-rose-300 transition hover:text-rose-200" onClick={onCancel}>
              {d.cancel}
            </button>
          )}
        </div>
        {x.direction === 'receive' && x.status === 'done' && files && (
          <ul className="mt-2.5 space-y-1 border-t border-line/[0.06] pt-2">
            {files.map((f) => (
              <li key={f.meta.index} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-ash">{f.meta.path ?? f.meta.name}</span>
                {f.savedToDisk ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300"><Icon name="check" size={12} /> {d.saved}</span>
                ) : f.blob ? (
                  <button className="inline-flex items-center gap-1 font-semibold text-accent-300 transition hover:text-accent-200" onClick={() => downloadReceived(x.id, f.meta.index)}>
                    <Icon name="download" size={12} /> {d.download}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
