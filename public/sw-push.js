// Custom push notification handler.
// Telegram kabi: tap → chat ochiladi; "Javob" → composer fokuslangan holatda chat ochiladi.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};

  const isCall    = data.type === 'incoming_call';
  const isMessage = data.type === 'message';

  const title = data.title || 'Avlodona';
  const actions = [];
  if (isCall) {
    actions.push({ action: 'answer',  title: '📞 Javob berish' });
    actions.push({ action: 'decline', title: '❌ Rad etish' });
  } else if (isMessage) {
    actions.push({ action: 'reply', title: '💬 Javob' });
    actions.push({ action: 'mark_read', title: '✓ O\'qildi' });
  }

  const options = {
    body: data.body || 'Yangi bildirishnoma',
    icon: data.avatar_url || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.tag || data.conversation_id || data.type || 'default',
    renotify: false,
    data,
    vibrate: isCall ? [300, 100, 300, 100, 300] : [200, 80, 200],
    requireInteraction: isCall,
    actions,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/notifications';

  if (data.type === 'incoming_call' && data.actor_id) {
    url = `/chat/${data.actor_id}`;
    if (event.action === 'decline') return;
  } else if (data.type === 'message' && data.actor_id) {
    url = `/chat/${data.actor_id}`;
    if (event.action === 'reply') {
      url = `/chat/${data.actor_id}?reply=1`;
    }
    if (event.action === 'mark_read') {
      return;
    }
  } else if (data.actor_id) {
    url = `/user/${data.actor_id}`;
    if (data.post_id) url += `?postId=${data.post_id}`;
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
