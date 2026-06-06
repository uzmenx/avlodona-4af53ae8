import { useEffect } from 'react';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export function usePushNotifications() {
  useEffect(() => {
    let isMounted = true;

    const setupPushNotifications = async () => {
      if (!Capacitor.isNativePlatform()) {
        return; // Web platformada ishlamaydi
      }

      // Ruxsat so'rash
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notifications permission denied');
        return;
      }

      // Qurilmani ro'yxatdan o'tkazish
      await PushNotifications.register();
    };

    const addListeners = async () => {
      if (!Capacitor.isNativePlatform()) return;

      // Token olinganda
      await PushNotifications.addListener('registration', async (token: Token) => {
        if (!isMounted) return;
        console.log('Push registration success, token: ' + token.value);
        
        // Jori foydalanuvchini olish
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          // Tokenni bazaga saqlash
          const { error } = await supabase
            .from('fcm_tokens')
            .upsert({ 
              user_id: session.user.id, 
              token: token.value,
              platform: Capacitor.getPlatform()
            }, { onConflict: 'user_id,token' });
            
          if (error) {
            console.error('Error saving FCM token:', error);
          }
        }
      });

      // Token olishda xatolik bo'lsa
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on registration: ', error);
      });

      // Ilova ochiq paytida push kelsa
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ', notification);
        // Bu yerda qo'shimcha mantiq yoki in-app notification chiqarish mumkin
      });

      // Push notification bosilganda
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('Push action performed: ', notification);
        // Bu yerda router orqali tegishli sahifaga o'tish kabi amallarni bajarish mumkin
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
  }, []);
}
