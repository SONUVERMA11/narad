/// <reference lib="webworker" />
/**
 * Narad service worker: offline shell (workbox precache) + the push "nudge".
 * A nudge carries no payload: the notification only says a contact wants to reach you.
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Narad', {
      body: 'A contact wants to send you something. Open Narad to receive it.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'narad-nudge',
      renotify: true,
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const w = wins[0]
      return w ? w.focus() : self.clients.openWindow('/')
    }),
  )
})
