import { Icon } from '@narad/icons'
import { useStore } from '../store'
import { t } from '../i18n'
import { formatBytes } from '../format'

export function IncomingModal() {
  const { incoming, peers, lang, acceptIncoming, rejectIncoming } = useStore()
  const d = t(lang)
  const first = incoming[0]
  if (!first) return null
  const { transfer } = first
  const from = peers.find((p) => p.info.id === transfer.peerId)
  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-night-950/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal data-testid="incoming">
      <div className="card-float modal-in w-full max-w-md space-y-4 p-5">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-ring h-12 w-12 text-2xl">{from ? from.emoji : <Icon name="package" size={22} />}</div>
          <div className="min-w-0">
            <div className="eyebrow">{from?.info.name ?? '…'}</div>
            <div className="truncate text-lg font-bold tracking-tight">
              {d.incoming} {transfer.files.length === 1 ? transfer.files[0]!.name : `${transfer.files.length} files`}
            </div>
            <div className="text-xs text-ash">{formatBytes(transfer.bytesTotal)}</div>
          </div>
        </div>
        {transfer.files.length > 1 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl bg-night-950/50 p-3 text-sm">
            {transfer.files.map((f) => (
              <li key={f.index} className="flex justify-between gap-2">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-ash">{formatBytes(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => rejectIncoming(transfer.id)} data-testid="reject">
            {d.reject}
          </button>
          <button className="btn-primary flex-1" onClick={() => void acceptIncoming(transfer.id)} data-testid="accept">
            <Icon name="download" size={15} /> {d.accept}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toasts() {
  const { toasts, dismissToast, lang, pendingClip, applyPendingClip } = useStore()
  const d = t(lang)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {pendingClip && (
        <button className="toast-in pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-accent-400/40 bg-night-900/90 px-4 py-2 text-sm font-medium text-accent-300 shadow-glow backdrop-blur-xl" onClick={() => void applyPendingClip()} data-testid="apply-clip">
          <Icon name="clipboard" size={14} /> {d.clipReceived} {pendingClip.from} · <span className="underline underline-offset-2">{d.apply}</span>
        </button>
      )}
      {toasts.map((x) => (
        <button
          key={x.id}
          onClick={() => dismissToast(x.id)}
          className={`toast-in pointer-events-auto rounded-xl border px-4 py-2 text-sm font-medium shadow-float backdrop-blur-xl ${
            x.kind === 'error' ? 'border-rose-400/40 bg-rose-500/15 text-rose-200' : x.kind === 'success' ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-line/10 bg-night-900/85 text-ivory'
          }`}
        >
          {x.text === 'clipboardEmpty' ? d.clipboardEmpty : x.text}
        </button>
      ))}
    </div>
  )
}

export function DropOverlay() {
  const { dragging, selected, peers, lang } = useStore()
  const d = t(lang)
  if (!dragging) return null
  const target = peers.find((p) => p.info.id === selected)?.info.name
  return (
    <div className="fade pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-night-950/70 p-6 backdrop-blur-sm">
      <div className="card-float flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent-400/70 px-12 py-10 text-center">
        <div className="float text-accent-300"><Icon name="inbox" size={52} strokeWidth={1.5} /></div>
        <div className="text-xl font-bold tracking-tight">
          {d.dropHere} <span className="text-gradient">{target ?? '…'}</span>
        </div>
      </div>
    </div>
  )
}
