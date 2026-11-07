/**
 * Narad extension — service worker.
 * Owns context menus, notifications, downloads and the offscreen document that hosts the engine.
 * It holds no state of its own (MV3 kills it after ~30s idle); the offscreen document is the brain.
 */
import type { AnyMessage, DistributiveOmit, EngineState, ToOffscreen } from './messages'

const MENU_ROOT = 'narad-root'
let creatingOffscreen: Promise<void> | undefined

async function ensureOffscreen(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] })
  if (contexts.length > 0) return
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.WEB_RTC, chrome.offscreen.Reason.BLOBS, chrome.offscreen.Reason.CLIPBOARD],
        justification: 'Keeps encrypted peer-to-peer connections to your devices alive for one-click sharing.',
      })
      .finally(() => (creatingOffscreen = undefined))
  }
  await creatingOffscreen
}

async function toOffscreen<T = unknown>(msg: DistributiveOmit<ToOffscreen, 'target'>): Promise<T> {
  await ensureOffscreen()
  return chrome.runtime.sendMessage({ target: 'offscreen', ...msg } as ToOffscreen) as Promise<T>
}

// ---- context menus ----

let menuPeers: { id: string; name: string }[] = []
let menuTimer: ReturnType<typeof setTimeout> | undefined

function rebuildMenus() {
  if (menuTimer) clearTimeout(menuTimer)
  menuTimer = setTimeout(() => {
    chrome.contextMenus.removeAll(() => {
      const contexts: chrome.contextMenus.ContextType[] = ['selection', 'link', 'image', 'page']
      chrome.contextMenus.create({ id: MENU_ROOT, title: 'Send to Narad', contexts })
      if (menuPeers.length === 0) {
        chrome.contextMenus.create({ id: 'narad-none', parentId: MENU_ROOT, title: 'No device online — open Narad', contexts })
        return
      }
      for (const p of menuPeers) chrome.contextMenus.create({ id: `peer:${p.id}`, parentId: MENU_ROOT, title: p.name, contexts })
    })
  }, 150)
}

chrome.contextMenus.onClicked.addListener((info) => {
  void (async () => {
    const id = String(info.menuItemId)
    if (id === 'narad-none') {
      await chrome.action.openPopup?.().catch(() => {})
      return
    }
    if (!id.startsWith('peer:')) return
    const peerId = id.slice(5)
    await toOffscreen({ type: 'set-last', peerId })
    if (info.selectionText) await toOffscreen({ type: 'send-text', peerId, body: info.selectionText })
    else if (info.mediaType === 'image' && info.srcUrl) await toOffscreen({ type: 'send-url', peerId, url: info.srcUrl })
    else if (info.linkUrl) await toOffscreen({ type: 'send-text', peerId, body: info.linkUrl })
    else if (info.pageUrl) await toOffscreen({ type: 'send-text', peerId, body: info.pageUrl })
  })()
})

// ---- keyboard command: send clipboard to last peer (clipboard is readable only from the focused popup) ----
chrome.commands.onCommand.addListener((command) => {
  if (command !== 'send-clipboard') return
  void chrome.storage.session.set({ pendingClipboard: Date.now() }).then(() => chrome.action.openPopup?.().catch(() => {}))
})

// ---- notifications (incoming files / messages) ----
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('incoming:')) {
    void toOffscreen({ type: 'incoming-decision', transferId: notificationId.slice(9), accept: buttonIndex === 0 })
  } else if (notificationId.startsWith('text:')) {
    void chrome.storage.session.get('texts').then((r) => {
      const text = (r.texts as Record<string, string> | undefined)?.[notificationId]
      if (text) void toOffscreen({ type: 'copy', text })
    })
  }
  chrome.notifications.clear(notificationId)
})
chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id)
  void chrome.action.openPopup?.().catch(() => {})
})

// ---- message router ----
chrome.runtime.onMessage.addListener((msg: AnyMessage, _sender, sendResponse) => {
  if (msg.target !== 'background') return false
  switch (msg.type) {
    case 'ensure-offscreen':
      ensureOffscreen().then(() => sendResponse(true), () => sendResponse(false))
      return true
    case 'peers-changed':
      menuPeers = msg.peers
      rebuildMenus()
      void chrome.action.setBadgeText({ text: msg.peers.length ? String(msg.peers.length) : '' })
      void chrome.action.setBadgeBackgroundColor({ color: '#f97316' })
      break
    case 'notify':
      if (msg.id.startsWith('text:')) {
        void chrome.storage.session.get('texts').then((r) => chrome.storage.session.set({ texts: { ...(r.texts as object), [msg.id]: msg.message } }))
      }
      chrome.notifications.create(msg.id, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: msg.title,
        message: msg.message,
        buttons: msg.buttons?.map((title) => ({ title })),
        requireInteraction: msg.id.startsWith('incoming:'),
      })
      break
    case 'download':
      void chrome.downloads.download({ url: msg.url, filename: msg.filename, saveAs: false })
      break
  }
  return false
})

chrome.runtime.onInstalled.addListener(() => {
  rebuildMenus()
  void ensureOffscreen()
})
chrome.runtime.onStartup.addListener(() => void ensureOffscreen())
void ensureOffscreen()

export type { EngineState }
