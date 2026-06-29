import { useEffect, useRef, useCallback } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// ─── Brend rang (logotip gradient ochiq ko'k-binafsha) ─────────────────────────
const BRAND_COLOR = '#6C5CE7'; // bildirishnoma ikonka orqa fon rangi

let notifIdCounter = Math.floor(Math.random() * 10000) + 1;
function generateNotifId(): number {
  return notifIdCounter++;
}

export interface NativeNotifData {
  type?: string;
  actorId?: string;
  conversationId?: string;
  postId?: string;
  /** Xabar yuborgan odamning avatar URL — largeIcon uchun */
  avatarUrl?: string;
}

let permissionsRequested = false;

async function ensurePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (permissionsRequested) return true;
  try {
    let status = await LocalNotifications.checkPermissions();
    if (status.display === 'prompt' || status.display === 'prompt-with-rationale') {
      status = await LocalNotifications.requestPermissions();
    }
    permissionsRequested = status.display === 'granted';
    return permissionsRequested;
  } catch {
    return false;
  }
}

/**
 * Notification type bo'yicha guruh ID olish.
 * Xuddi shu guruh ID ga ega bildirishnomalar Android da birlashtiriladi.
 */
function getGroupId(data?: NativeNotifData): string {
  if (data?.conversationId) return `chat_${data.conversationId}`;
  if (data?.type === 'like' || data?.type === 'story_like') return 'group_likes';
  if (data?.type === 'follow' || data?.type === 'follow_request') return 'group_follows';
  if (data?.type === 'comment' || data?.type === 'mention') return 'group_comments';
  if (data?.type?.startsWith('family')) return 'group_family';
  return 'group_general';
}

/**
 * Tizim notification panelida bildirishnoma ko'rsatish.
 * Guruh, avatar, rang va deep link ma'lumotlarini qo'llaydi.
 */
export async function showNativeNotification(
  title: string,
  body: string,
  data?: NativeNotifData,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await ensurePermissions();
  if (!granted) return;

  const groupId = getGroupId(data);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: generateNotifId(),
          title,
          body,
          smallIcon: 'ic_stat_notification',
          // Logotip ikonka rangi (orqa fon)
          iconColor: BRAND_COLOR,
          channelId: 'avlodona_channel',
          // Guruhlash: bitta chatdan kelgan xabarlar birlashadi (Telegram kabi)
          group: groupId,
          // Android notification drawer da ham ko'rinadi
          groupSummary: false,
          extra: {
            ...(data ?? {}),
            // Deep link uchun yo'l
            route: buildRoute(data),
          },
          sound: 'default',
          autoCancel: true,
          ongoing: false,
          // Avatar URL ni largeIcon sifatida ulaymiz
          // (Capacitor local-notifications largeIcon remote URL ni qabul qilmaydi,
          //  shuning uchun biz uni extra ga saqlaymiz, tizim bildirishnoma uchun
          //  avatarni FCM server orqali yuborilganda image sifatida ko'rsatadi)
          attachments: data?.avatarUrl
            ? [{ id: 'avatar', url: data.avatarUrl }]
            : undefined,
        },
      ],
    });
  } catch (err) {
    console.warn('[NativeNotif] schedule failed:', err);
  }
}

/**
 * Bildirishnoma bosilganda qaysi sahifaga o'tish kerakligini aniqlaydi.
 */
function buildRoute(data?: NativeNotifData): string {
  if (!data) return '/notifications';
  switch (data.type) {
    case 'message':
      return data.actorId ? `/chat/${data.actorId}` : '/messages';
    case 'follow':
    case 'follow_request':
      return data.actorId ? `/user/${data.actorId}` : '/notifications';
    case 'like':
    case 'comment':
    case 'mention':
    case 'story_like':
    case 'story':
      return '/notifications';
    case 'family_invitation':
    case 'family_invitation_accepted':
    case 'family_connection_request':
      return '/relatives';
    case 'collab_request':
    case 'collab_accepted':
      return '/notifications';
    default:
      return '/notifications';
  }
}

/**
 * Hook:
 * - Foreground/Background holatini kuzatadi
 * - Ruxsatni oldindan so'raydi
 * - Local notification bosilganda kerakli sahifaga yo'naltiradi
 */
export function useNativeNotifications(navigate?: (path: string) => void) {
  const isBackgroundRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Ruxsat oldindan so'rash
    ensurePermissions();

    // Foreground/Background
    let stateListener: { remove: () => void } | null = null;
    App.addListener('appStateChange', (state) => {
      isBackgroundRef.current = !state.isActive;
    }).then((l) => { stateListener = l; });

    // ─── Local notification bosilganda deep link ──────────────────────────────
    let tapListener: { remove: () => void } | null = null;
    if (navigate) {
      LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const extra = action.notification.extra as NativeNotifData & { route?: string } | undefined;
        const route = extra?.route ?? buildRoute(extra);
        console.log('[NativeNotif] tapped → route:', route);
        navigate(route);
      }).then((l) => { tapListener = l; });
    }

    return () => {
      stateListener?.remove();
      tapListener?.remove();
    };
  }, [navigate]);

  /** Faqat background da native notification yuboradi (foreground da in-app banner yetarli) */
  const notify = useCallback(
    async (title: string, body: string, data?: NativeNotifData) => {
      if (isBackgroundRef.current) {
        await showNativeNotification(title, body, data);
      }
    },
    [],
  );

  /** Har doim native notification yuboradi */
  const notifyAlways = useCallback(
    async (title: string, body: string, data?: NativeNotifData) => {
      await showNativeNotification(title, body, data);
    },
    [],
  );

  return { isBackground: isBackgroundRef, notify, notifyAlways };
}
