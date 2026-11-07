import { useEffect } from 'react'
import { Header } from './components/Header'
import { PeerGrid } from './components/PeerGrid'
import { PeerPanel } from './components/PeerPanel'
import { DropOverlay, IncomingModal, Toasts } from './components/Overlays'
import { PairDialog, ReceiveDialog, ShareDialog, SpacesDialog } from './components/Dialogs'
import { useStore } from './store'
import { t } from './i18n'
import { filesFromDrop } from './sinks'
import { Icon } from '@narad/icons'

const DEVELOPER = (import.meta.env.VITE_DEVELOPER_NAME as string | undefined) || ''
const DEVELOPER_URL = (import.meta.env.VITE_DEVELOPER_URL as string | undefined) || ''

export default function App() {
  const { init, selected, lang, setDragging, sendFiles, sendClipboard } = useStore()
  const d = t(lang)

  useEffect(() => {
    void init()
    if ('Notification' in window && Notification.permission === 'default') {
      const ask = () => {
        void Notification.requestPermission()
        window.removeEventListener('pointerdown', ask)
      }
      window.addEventListener('pointerdown', ask)
    }
  }, [init])

  useEffect(() => {
    let depth = 0
    const onEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      depth++
      setDragging(true)
    }
    const onLeave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      depth = 0
      setDragging(false)
      const sel = useStore.getState().selected
      if (!sel || !e.dataTransfer) return
      void filesFromDrop(e.dataTransfer).then(({ files, paths }) => {
        if (files.length) void sendFiles(sel, files, paths)
      })
    }
    const onPaste = (e: ClipboardEvent) => {
      const sel = useStore.getState().selected
      const files = Array.from(e.clipboardData?.files ?? [])
      if (sel && files.length) {
        e.preventDefault()
        void sendFiles(sel, files)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        const sel = useStore.getState().selected
        if (sel) {
          e.preventDefault()
          void sendClipboard(sel)
        }
      }
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('keydown', onKey)
    }
  }, [setDragging, sendFiles, sendClipboard])

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 gap-4 px-4 pb-4 pt-4 sm:px-6">
        <div className={`min-h-0 flex-1 overflow-y-auto ${selected ? 'hidden lg:block' : ''}`}>
          <PeerGrid />
        </div>
        {selected && (
          <div className="min-h-0 w-full lg:w-[420px] xl:w-[480px]">
            <PeerPanel />
          </div>
        )}
      </main>
      <footer className="flex items-center justify-center gap-2 px-4 pb-3 text-[11px] text-ash-dim sm:px-6">
        <span className="h-px w-8 bg-gradient-to-r from-transparent to-line/10" />
        <Icon name="lock" size={11} /> {d.nothingStored}
        <span className="h-px w-8 bg-gradient-to-l from-transparent to-line/10" />
        {DEVELOPER && (
          <span className="text-ash-dim">
            · Developed by {DEVELOPER_URL ? <a className="underline underline-offset-2 hover:text-accent-300" href={DEVELOPER_URL} rel="author">{DEVELOPER}</a> : DEVELOPER}
          </span>
        )}
      </footer>
      <IncomingModal />
      <PairDialog />
      <SpacesDialog />
      <ShareDialog />
      <ReceiveDialog />
      <DropOverlay />
      <Toasts />
    </div>
  )
}
