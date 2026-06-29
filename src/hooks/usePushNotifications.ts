import { useEffect } from 'react';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

/**
 * FCM push notification — ruxsat, token saqlash va tap deep link.
 * Ilova completely killed bo'lib, FCM orqali kelgan notification bosilganda
 * to'g'ri sahifaga yo'naltiradi (Telegram kabi).
 */
export function usePushNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const setupPushNotifications = async () => {
      if (!Capacitor.isNativePlatform()) return;

      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        console.log('[FCM] Push permission denied');
        return;
      }

      await PushNotifications.register();
    };

    const addListeners = async () => {
      if (!Capacitor.isNativePlatform()) return;

      // ─── 1. Token olinganda DB ga saqlash ───────────────────────────────────
      await PushNotifications.addListener('registration', async (token: Token) => {
        if (!isMounted) return;
        console.log('[FCM] Token:', token.value);

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { error } = await supabase
            .from('fcm_tokens')
            .upsert(
              {
                user_id: session.user.id,
                token: token.value,
                platform: Capacitor.getPlatform(),
              },
              { onConflict: 'user_id,token' }
            );
          if (error) console.error('[FCM] Token save error:', error);
        }
      });

      // ─── 2. Token xatosi ────────────────────────────────────────────────────
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('[FCM] Registration error:', error);
      });

      // ─── 3. Ilova FOREGROUND da push kelsa ─────────────────────────────────
      // In-app banner PushNotification.tsx orqali ko'rsatiladi, shuning uchun
      // bu yerda faqat log qilamiz (duplicate bo'lmasin deb)
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Foreground push received:', notification.title);
        // PushNotification.tsx realtime orqali in-app banner chiqaradi — hech narsa qilmaymiz
      });

      // ─── 4. Push notification BOSILGANDA — Deep Link ────────────────────────
      // Ilova killed yoki background bo'lgan holat, FCM notification ustiga bosilganda
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        if (!isMounted) return;
        const data = action.notification.data as Record<string, string> | undefined;
        console.log('[FCM] Tapped, data:', data);

        if (!data) {
          navigate('/notifications');
          return;
        }

        const type = data.type;
        const actorId = data.actor_id;
        const conversationId = data.conversation_id;

        // Notification type ga qarab to'g'ri sahifaga yo'naltirish
        switch (type) {
          case 'message':
            // Xabar — chatga o'tish
            if (actorId) navigate(`/chat/${actorId}`);
            else if (conversationId) navigate('/messages');
            else navigate('/messages');
            break;

          case 'follow':
          case 'follow_request':
            // Kuzatish — foydalanuvchi profiliga o'tish
            if (actorId) navigate(`/user/${actorId}`);
            else navigate('/notifications');
            break;

          case 'like':
          case 'story_like':
          case 'comment':
          case 'mention':
          case 'story':
            // Post/Story — bildirishnomalar sahifasiga o'tish
            navigate('/notifications');
            break;

          case 'family_invitation':
          case 'family_invitation_accepted':
          case 'family_connection_request':
            // Oila — qarindoshlar sahifasiga
            navigate('/relatives');
            break;

          case 'collab_request':
          case 'collab_accepted':
            navigate('/notifications');
            break;

          default:
            navigate('/notifications');
        }
      });
    };

    setupPushNotifications();
    addListeners();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [navigate]);
}
