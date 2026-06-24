import { useEffect, useRef, useCallback } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * useNativeNotifications
 *
 * Tizim notification panelida (yuqori slayd) bildirishnoma ko'rsatish uchun hook.
 * - LocalNotifications.schedule() orqali native OS notificationi yuboradi
 * - App foreground/background holatini kuzatadi
 * - Ruxsatni bir marta so'raydi
 */

let notifIdCounter = 1;

function generateNotifId(): number {
  return notifIdCounter++;
}

export interface NativeNotifData {
  type?: string;
  actorId?: string;
  conversationId?: string;
  postId?: string;
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
 * Tizim notification panelida bildirishnoma ko'rsatish
 */
export async function showNativeNotification(
  title: string,
  body: string,
  data?: NativeNotifData,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const granted = await ensurePermissions();
  if (!granted) return;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: generateNotifId(),
          title,
          body,
          smallIcon: 'ic_stat_notification',
          channelId: 'avlodona_channel',
          extra: data ?? {},
          sound: 'default',
          autoCancel: true,
          // Heads-up (peek) notification uchun muhim:
          ongoing: false,
        },
      ],
    });
  } catch (err) {
    console.warn('[NativeNotif] schedule failed:', err);
  }
}

/**
 * Hook: App fonda/o'chirilgan holatini kuzatadi va permission so'raydi.
 * Returns { isBackground } — bildirishnoma mantig'iga yordamchi
 */
export function useNativeNotifications() {
  const isBackgroundRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Ruxsat oldindan so'rash
    ensurePermissions();

    // Foreground/Background holatini kuzatish
    let listener: { remove: () => void } | null = null;

    App.addListener('appStateChange', (state) => {
      isBackgroundRef.current = !state.isActive;
    }).then((l) => {
      listener = l;
    });

    return () => {
      listener?.remove();
    };
  }, []);

  /**
   * Bildirishnomani ko'rsatish:
   * - Foreground da: native notification YUBORILMAYDI (in-app banner yetarli)
   * - Background da: tizim panelida native notification ko'rinadi
   */
  const notify = useCallback(
    async (title: string, body: string, data?: NativeNotifData) => {
      // Background holatda yoki foreground da ham yuborish uchun
      // (foreground da ham yubormaslik kerak — in-app banner ko'rinadi)
      if (isBackgroundRef.current) {
        await showNativeNotification(title, body, data);
      }
    },
    [],
  );

  /**
   * Har doim (foreground va background) native notification yuborish
   * Asosan fon xizmatlari uchun
   */
  const notifyAlways = useCallback(
    async (title: string, body: string, data?: NativeNotifData) => {
      await showNativeNotification(title, body, data);
    },
    [],
  );

  return {
    /** true bo'lsa ilova fonda */
    isBackground: isBackgroundRef,
    /** Faqat background da native notification yuboradi */
    notify,
    /** Har doim native notification yuboradi */
    notifyAlways,
  };
}
