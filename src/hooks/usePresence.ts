import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePresence = (userId?: string | null) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsOnline(false);
      return;
    }

    const checkPresence = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('last_seen, hide_online_status')
          .eq('id', userId)
          .single();

        if (data && !data.hide_online_status && data.last_seen) {
          const lastSeen = new Date(data.last_seen).getTime();
          // Consider online if seen within last 2 minutes
          setIsOnline(Date.now() - lastSeen < 2 * 60 * 1000);
        } else {
          setIsOnline(false);
        }
      } catch (e) {
        setIsOnline(false);
      }
    };

    checkPresence();
    const interval = setInterval(checkPresence, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [userId]);

  return isOnline;
};
