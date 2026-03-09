// Custom push notification handler for incoming calls
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || "Avlodona";
  const options = {
    body: data.body || "Yangi bildirishnoma",
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || 'default',
    data: data,
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: data.type === 'incoming_call',
    actions: data.type === 'incoming_call' ? [
      { action: 'answer', title: '📞 Javob berish' },
      { action: 'decline', title: '❌ Rad etish' }
    ] : [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/messages';

  if (data.type === 'incoming_call' && data.caller_id) {
    url = `/chat/${data.caller_id}`;
  }

  if (event.action === 'decline') {
    // Just close notification
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
