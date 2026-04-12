import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

export const GlobalCallListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Listen for interactions with the incoming call notification
    LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      if (!isMounted) return;

      const { actionId, notification } = action;
      const callerId = notification.extra?.callerId;

      if (!callerId) return;

      // Handle App open/Notification Click
      if (actionId === 'tap') {
        navigate(`/chat/${callerId}?answerCall=true`);
        return;
      }

      // Handle Answer Button
      if (actionId === 'answer') {
        navigate(`/chat/${callerId}?answerCall=true`);
        return;
      }

      // Handle Decline Button
      if (actionId === 'decline') {
        try {
          // If the user declines from notification, we invoke the supabase edge function or just update locally
          // The edge function requires the specific call id. Since we might not have it in the notification extra,
          // it's safer to just decline by updating the latest pending call for this user.
          
          const { data: userResp } = await supabase.auth.getUser();
          if (!userResp.user?.id) return;
          
          const { data: calls } = await supabase
            .from('calls')
            .select('id, room_name')
            .eq('receiver_id', userResp.user.id)
            .eq('caller_id', callerId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);

          if (calls && calls.length > 0) {
            await supabase.functions.invoke('end-call', {
              body: { 
                call_id: calls[0].id,
                room_name: calls[0].room_name 
              },
            });
          }
        } catch (e) {
          console.error("Failed to decline call from notification:", e);
        }
      }
    });

    return () => {
      isMounted = false;
      LocalNotifications.removeAllListeners();
    };
  }, [navigate]);

  return null;
};
