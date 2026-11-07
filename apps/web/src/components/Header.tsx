import { useState } from 'react'
import { randomRoomCode } from '@narad/core'
import { Icon } from '@narad/icons'
import { useStore } from '../store'
import { t } from '../i18n'

export function Header() {
  const { me, myId, lang, setLang, theme, setTheme, rooms, joinRoom, leaveRoom, rename, toast, peers, spaces, openDialog, sabhaEnabled, push, togglePush } = useStore()
  const d = t(lang)
  const [roomOpen, setRoomOpen] = useState(false)
  const [code, setCode] = useState('')
  const codeRooms = Object.keys(rooms).filter((k) => !['sabha'].includes(k) && !k.startsWith('p-') && !k.startsWith('s-') && !k.startsWith('pair-') && !k.startsWith('share-'))
  const sabha = rooms.sabha
  const inviteLink = (c: string) => `${location.origin}/?room=${encodeURIComponent(c)}`

  return (
    <header className="glass sticky top-0 z-20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-accent-400/30 blur-lg diya-glow" />
            <img src="/icon.svg" alt="" className="relative h-10 w-10 rounded-2xl shadow-[0_0_0_1px_rgb(255_255_255/0.08)]" />
          </div>
          <div>
            <div className="text-gradient text-xl font-extrabold leading-tight tracking-tight">Narad</div>
            <div className="hidden text-[11px] font-medium tracking-wide text-ash sm:block">{d.tagline}</div>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {sabhaEnabled ? (
            <span className={`hidden sm:inline-flex ${sabha === 'open' ? 'pill-ok' : 'pill-warn'}`} title={d.sabha}>
              <span className={`relative flex h-2 w-2 ${sabha === 'open' ? 'pulse-ring' : ''}`}>
                <span className={`h-2 w-2 rounded-full ${sabha === 'open' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </span>
              <Icon name="wifi" size={12} />
              {sabha === 'open' ? d.devicesOnline(peers.filter((p) => p.via.sabha).length) : d.reconnecting}
            </span>
          ) : (
            <span className="pill-dim hidden sm:inline-flex" title={d.sabhaOff}>
              <Icon name="ban" size={12} /> {d.sabha}
            </span>
          )}

          {spaces.map((s) => (
            <button key={s.secret} className="pill-neel transition hover:bg-neel-400/20" onClick={() => openDialog('spaces')} data-testid="space-chip">
              <Icon name="spaces" size={12} />@{s.name} · {s.members.length}
            </button>
          ))}

          {codeRooms.map((c) => (
            <span key={c} className="pill-kesar">
              <Icon name="link" size={12} />#{c}
              <button className="ml-1 opacity-70 transition hover:opacity-100" title={d.copyLink} onClick={() => navigator.clipboard.writeText(inviteLink(c)).then(() => toast(d.linkCopied, 'success'))}>
                <Icon name="copy" size={12} />
              </button>
              <button className="opacity-70 transition hover:opacity-100" title={d.leave} onClick={() => leaveRoom(c)}>
                <Icon name="x" size={12} />
              </button>
            </span>
          ))}

          <button className="btn-primary !py-1.5" onClick={() => openDialog('share')} title={d.shareTitle} data-testid="open-share">
            <Icon name="send" /> <span className="hidden sm:inline">{d.share}</span>
          </button>
          <button className="btn-ghost" onClick={() => openDialog('receive')} title={d.receiveTitle} data-testid="open-receive">
            <Icon name="download" className="text-sona-400" /> <span className="hidden sm:inline">{d.receive}</span>
          </button>
          <button className="btn-ghost" onClick={() => openDialog('pair')} title={d.pair} data-testid="open-pair">
            <Icon name="pair" className="text-accent-300" /> <span className="hidden sm:inline">{d.pair}</span>
          </button>
          <button className="btn-ghost" onClick={() => openDialog('spaces')} title={d.spaces} data-testid="open-spaces">
            <Icon name="spaces" className="text-neel-300" /> <span className="hidden sm:inline">{d.spaces}</span>
          </button>

          <div className="relative">
            <button className="btn-ghost" onClick={() => setRoomOpen((v) => !v)} aria-expanded={roomOpen} title={d.joinRoom}>
              <Icon name="link" className="text-kesar-300" /> <span className="hidden sm:inline">{d.joinRoom}</span>
            </button>
            {roomOpen && (
              <form
                className="card-float modal-in absolute right-0 z-30 mt-2 w-80 space-y-3 p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  joinRoom(code)
                  setCode('')
                  setRoomOpen(false)
                }}
              >
                <label className="eyebrow">{d.roomCode}</label>
                <input className="input font-mono" autoFocus placeholder="pink-mango-42" value={code} onChange={(e) => setCode(e.target.value)} />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary flex-1" disabled={!code.trim()}>
                    {d.joinRoom}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    onClick={() => {
                      const c = randomRoomCode()
                      joinRoom(c)
                      navigator.clipboard.writeText(inviteLink(c)).then(() => toast(d.linkCopied, 'success')).catch(() => {})
                      setRoomOpen(false)
                    }}
                  >
                    <Icon name="sparkles" size={14} /> {d.createRoom}
                  </button>
                </div>
              </form>
            )}
          </div>

          {(push === 'off' || push === 'on') && (
            <button className={`btn-icon ${push === 'on' ? 'text-accent-300 shadow-glow' : 'text-ash'}`} onClick={() => void togglePush()} title={`${push === 'on' ? d.pushOn : d.pushOff} · ${d.pushHint}`} data-testid="push-toggle">
              <Icon name={push === 'on' ? 'bell' : 'bellOff'} />
            </button>
          )}
          <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="theme" title={theme === 'dark' ? 'Light theme' : 'Dark theme'} data-testid="theme-toggle">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button className="btn-icon text-xs font-bold" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} aria-label="language">
            {lang === 'en' ? 'हिं' : 'EN'}
          </button>

          {me && (
            <button
              className="btn-ghost"
              title={`${d.rename} · ${myId ?? ''}`}
              onClick={() => {
                const n = prompt(d.namePrompt, me.name)
                if (n && n.trim() && n !== me.name) void rename(n)
              }}
            >
              <span className="text-xs font-medium text-ash">{d.youAre}</span>
              <span className="font-semibold">{me.name}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
