import { useEffect, useRef, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Icon } from '@narad/icons'
import { SITE_HOST, useStore } from '../store'
import { t } from '../i18n'

function Modal({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fade fixed inset-0 z-40 flex items-end justify-center bg-night-950/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal data-testid={testId} onClick={onClose}>
      <div className="card-float modal-in w-full max-w-md space-y-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold tracking-tight">{title}</div>
          <button className="btn-icon h-8 w-8 text-sm" onClick={onClose} aria-label="close">
            <Icon name="x" size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Qr({ text }: { text: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    void QRCode.toDataURL(text, { margin: 1, width: 192, color: { dark: '#0b0a18', light: '#ffffff' } }).then(setSrc)
  }, [text])
  return src ? (
    <img src={src} alt="QR" className="mx-auto h-40 w-40 rounded-2xl bg-white p-1.5 shadow-[0_0_0_1px_rgb(255_255_255/0.1),0_20px_40px_-20px_rgb(45_212_191/0.5)]" />
  ) : (
    <div className="mx-auto h-40 w-40 animate-pulse rounded-2xl bg-line/10" />
  )
}

export function PairDialog() {
  const { dialog, openDialog, pairing, showPairCode, enterPairCode, setPairing, lang, myId } = useStore()
  const d = t(lang)
  const [code, setCode] = useState('')
  if (dialog !== 'pair') return null
  const close = () => openDialog(undefined)

  return (
    <Modal title={d.pair} onClose={close} testId="pair-dialog">
      {myId && (
        <div className="flex items-center justify-between rounded-xl bg-night-950/50 px-3 py-2 text-xs text-ash">
          <span>{d.myId}</span>
          <span className="font-mono text-ivory" data-testid="my-id">{myId}</span>
        </div>
      )}
      {pairing.mode === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary py-3" onClick={showPairCode} data-testid="pair-show">
            <Icon name="qr" size={15} /> {d.pairShow}
          </button>
          <button className="btn-ghost py-3" onClick={() => setPairing({ mode: 'enter', code: '', status: 'idle' })} data-testid="pair-enter">
            {d.pairEnter}
          </button>
        </div>
      )}
      {pairing.mode === 'show' && (
        <div className="space-y-4 text-center">
          <div className="text-gradient font-mono text-5xl font-bold tracking-[0.3em]" data-testid="pair-code">
            {pairing.code}
          </div>
          <Qr text={`${location.origin}/#pair=${pairing.code}`} />
          <p className="text-sm text-ash">{d.pairHint}</p>
          <div className="pill-warn mx-auto">{pairing.status === 'waiting' ? d.pairWaiting : d.pairing}</div>
        </div>
      )}
      {pairing.mode === 'enter' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void enterPairCode(code)
          }}
        >
          <p className="text-sm text-ash">{d.pairEnterHint}</p>
          <input
            className="input py-3 text-center font-mono text-3xl tracking-[0.3em]"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={code}
            data-testid="pair-input"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={pairing.status === 'pairing'}
          />
          <button className="btn-primary w-full py-3" type="submit" disabled={code.length !== 6 || pairing.status === 'pairing'} data-testid="pair-submit">
            {pairing.status === 'pairing' ? d.pairing : d.pair}
          </button>
        </form>
      )}
      {pairing.mode === 'done' && (
        <div className="space-y-3 text-center" data-testid="pair-done">
          <div className="float mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-400/15 text-accent-300 shadow-glow"><Icon name="checkCircle" size={34} /></div>
          <div className="text-lg font-bold tracking-tight">
            {d.paired} <span className="text-gradient">{pairing.contact.name}</span>
          </div>
          <button className="btn-primary w-full" onClick={close}>
            OK
          </button>
        </div>
      )}
      {pairing.mode === 'error' && (
        <div className="space-y-3 text-center" data-testid="pair-error">
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {d.pairFailed}: {pairing.message}
          </div>
          <button className="btn-ghost w-full" onClick={() => setPairing({ mode: 'idle' })}>
            <Icon name="rotate" size={14} /> OK
          </button>
        </div>
      )}
    </Modal>
  )
}

export function SpacesDialog() {
  const { dialog, openDialog, spaces, createSpace, joinSpaceLink, leaveSpace, spaceInvite, toast, lang, selectAllIn, narad } = useStore()
  const [license, setLicense] = useState('')
  const d = t(lang)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [qrFor, setQrFor] = useState<string>()
  if (dialog !== 'spaces') return null
  const close = () => openDialog(undefined)

  return (
    <Modal title={d.spaces} onClose={close} testId="spaces-dialog">
      <p className="text-xs leading-relaxed text-ash">{d.spaceHint}</p>
      <ul className="space-y-2">
        {spaces.map((s) => (
          <li key={s.secret} className="rounded-xl border border-neel-400/15 bg-neel-400/[0.06] p-3" data-testid="space-item">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5 font-semibold tracking-tight text-neel-300"><Icon name="spaces" size={13} />@{s.name}</div>
                <div className="text-xs text-ash">
                  {s.members.length} {d.members}
                  {s.status !== 'open' ? ' · ' + d.connecting : ''}
                </div>
              </div>
              <div className="flex gap-1">
                {s.members.length > 0 && (
                  <button className="btn-icon h-8 w-8 text-sm" title={d.sendToAll} onClick={() => selectAllIn(s.members.map((m) => m.id))} data-testid="space-send-all">
                    <Icon name="users" size={14} />
                  </button>
                )}
                <button className="btn-icon h-8 w-8 text-sm" title={d.copyLink} onClick={() => navigator.clipboard.writeText(spaceInvite(s)).then(() => toast(d.linkCopied, 'success'))}>
                  <Icon name="copy" size={14} />
                </button>
                <button className="btn-icon h-8 w-8 text-sm" title="QR" onClick={() => setQrFor(qrFor === s.secret ? undefined : s.secret)}>
                  <Icon name="qr" size={14} />
                </button>
                <button className="btn-icon h-8 w-8 text-sm text-rose-300" title={d.spaceLeave} onClick={() => void leaveSpace(s.secret)}>
                  <Icon name="logout" size={14} />
                </button>
              </div>
            </div>
            {qrFor === s.secret && (
              <div className="mt-3">
                <Qr text={spaceInvite(s)} />
              </div>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void createSpace(name)
          setName('')
        }}
      >
        <input className="input" placeholder={d.spaceName} value={name} onChange={(e) => setName(e.target.value)} data-testid="space-name" />
        <button className="btn-primary shrink-0" type="submit" disabled={!name.trim()} data-testid="space-create">
          <Icon name="plus" size={14} /> {d.spaceCreate}
        </button>
      </form>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void joinSpaceLink(link)
          setLink('')
        }}
      >
        <input className="input" placeholder={d.spaceLinkPlaceholder} value={link} onChange={(e) => setLink(e.target.value)} data-testid="space-link" />
        <button className="btn-ghost shrink-0" type="submit" disabled={!link.trim()} data-testid="space-join">
          {d.spaceJoin}
        </button>
      </form>
      <div className="border-t border-line/[0.06] pt-3">
        <div className="eyebrow mb-2">Team</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void narad?.setLicense(license.trim() || undefined).then(() => toast(license.trim() ? 'Team license saved · reconnects apply it' : 'License removed', 'success'))
            setLicense('')
          }}
        >
          <input className="input font-mono text-xs" placeholder="Team license (paste token)" value={license} onChange={(e) => setLicense(e.target.value)} />
          <button className="btn-ghost shrink-0" type="submit">
            Save
          </button>
        </form>
      </div>
    </Modal>
  )
}

export function ShareDialog() {
  const { dialog, openDialog, lang, share, startShare, stopShare, shareLink, toast } = useStore()
  const d = t(lang)
  const [files, setFiles] = useState<{ file: File; path?: string }[]>([])
  const [text, setText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const dirInput = useRef<HTMLInputElement>(null)
  if (dialog !== 'share') return null
  const close = () => openDialog(undefined)
  const addFiles = (list: FileList | null, withPaths = false) => {
    if (!list) return
    setFiles((f) => [...f, ...Array.from(list).map((file) => ({ file, path: withPaths ? (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined : undefined }))])
  }
  const link = share ? shareLink(share.code) : ''
  const live = share && share.status === 'open'

  return (
    <Modal title={d.shareTitle} onClose={close} testId="share-dialog">
      {!live ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!files.length && !text.trim()) return toast(d.shareNothing, 'info')
            startShare({ files: files.map((f) => f.file), paths: files.map((f) => f.path), text })
            setFiles([])
            setText('')
          }}
        >
          <p className="text-sm text-ash">{d.shareHint.replace('narad.sh', SITE_HOST)}</p>
          <textarea className="input min-h-20 resize-none" placeholder={d.shareText} value={text} onChange={(e) => setText(e.target.value)} data-testid="share-text" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => fileInput.current?.click()}>
              <Icon name="paperclip" size={14} /> {d.shareFiles}
            </button>
            <button type="button" className="btn-ghost" onClick={() => dirInput.current?.click()}>
              <Icon name="folder" size={14} /> {d.shareFolder}
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} data-testid="share-files" />
            <input ref={dirInput} type="file" hidden {...({ webkitdirectory: '' } as Record<string, string>)} onChange={(e) => addFiles(e.target.files, true)} />
          </div>
          {files.length > 0 && (
            <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-ash" data-testid="share-list">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 truncate">
                  <Icon name="file" size={12} /> <span className="truncate text-ivory">{f.path ?? f.file.name}</span>
                  <button type="button" className="ml-auto opacity-60 hover:opacity-100" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="remove"><Icon name="x" size={12} /></button>
                </li>
              ))}
            </ul>
          )}
          <button className="btn-primary w-full py-3" type="submit" data-testid="share-start">
            <Icon name="sparkles" size={15} /> {d.shareStart}
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-center">
          <div className="text-xs text-ash">{d.shareCodeHint.replace('narad.sh', SITE_HOST)}</div>
          <div className="text-gradient font-mono text-5xl font-bold tracking-[0.3em]" data-testid="share-code">{share.code}</div>
          <Qr text={link} />
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="truncate font-mono text-ash" data-testid="share-link">{link}</span>
            <button className="btn-icon h-7 w-7" title={d.copyLink} onClick={() => navigator.clipboard.writeText(link).then(() => toast(d.linkCopied, 'success'))}><Icon name="copy" size={12} /></button>
          </div>
          <div className="rounded-xl bg-night-950/50 p-3 text-left text-xs">
            <div className="truncate text-ash">{share.summary}</div>
            {share.sent.length === 0 ? (
              <div className="pill-warn mt-2">{d.shareWaiting}</div>
            ) : (
              <ul className="mt-2 space-y-1" data-testid="share-sent">
                {share.sent.map((s) => (
                  <li key={s.peerId} className="flex items-center gap-2 text-ivory"><Icon name="checkCircle" size={13} className="text-accent-300" /> {d.shareSentTo} {s.name}</li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn-ghost w-full" onClick={stopShare} data-testid="share-stop">{d.shareStop}</button>
        </div>
      )}
      {share && share.status !== 'open' && (
        <div className="text-center text-xs text-ash">{share.status === 'expired' ? d.shareExpired : d.shareStopped}</div>
      )}
    </Modal>
  )
}

export function ReceiveDialog() {
  const { dialog, openDialog, lang, receive, joinShare } = useStore()
  const d = t(lang)
  const [code, setCode] = useState('')
  if (dialog !== 'receive') return null
  const close = () => openDialog(undefined)
  const busy = receive?.status === 'joining'
  return (
    <Modal title={d.receiveTitle} onClose={close} testId="receive-dialog">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 6) void joinShare(code)
        }}
      >
        <p className="text-sm text-ash">{d.receiveHint}</p>
        <input
          className="input text-center font-mono text-3xl tracking-[0.4em]"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          data-testid="receive-input"
        />
        <button className="btn-primary w-full py-3" type="submit" disabled={code.length !== 6 || busy} data-testid="receive-join">
          {busy ? d.receiveJoining : d.receiveJoin}
        </button>
        {receive?.status === 'error' && <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-2 text-xs text-rose-200" data-testid="receive-error">{d.receiveFailed}</div>}
      </form>
    </Modal>
  )
}
