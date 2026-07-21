self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let data = {}

  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }

  const title = data.title || 'Entrelinhas'
  const options = {
    body: data.body || 'Você tem uma nova notificação.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || data.notificationId || 'folio-notification',
    data: { url: data.url || '/?page=notifications' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url || '/?page=notifications', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(item => 'focus' in item)

      if (client) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then(navigatedClient => (navigatedClient || client).focus())
        }

        return client.focus()
      }

      return self.clients.openWindow(targetUrl)
    }),
  )
})
