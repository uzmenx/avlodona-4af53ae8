import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface IncomingMessage {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string | null;
  media_type?: 'image' | 'video' | 'audio' | null;
}

interface SenderProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

/**
 * Global real-time message listener.
 * Mounted once at App level — works regardless of which page the user is on.
 * Shows a toast with sender info when a new message arrives and the user
 * is NOT already inside that specific chat page.
 */
export const useGlobalMessageListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Keep a ref to location so the async callback always reads the latest value
  const locationRef = useRef(location.pathname);
  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`global-msg-listener-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const msg = payload.new as IncomingMessage;

          // Ignore own messages
          if (!msg || msg.sender_id === user.id) return;

          // Ignore if user is already inside this specific chat
          const currentPath = locationRef.current;
          // /chat/:userId — check by sender_id since that maps to the chat route
          if (currentPath === `/chat/${msg.sender_id}`) return;

          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', msg.sender_id)
            .maybeSingle();

          const profile = sender as SenderProfile | null;
          if (!profile) return;

          const senderName =
            profile.name || profile.username || 'Foydalanuvchi';

          // Build preview text based on media type
          let preview = msg.content?.trim() ?? '';
          if (msg.media_type === 'image') preview = '📷 Rasm yubordi';
          else if (msg.media_type === 'video') preview = '🎥 Video yubordi';
          else if (msg.media_type === 'audio') preview = '🎤 Ovozli xabar';
          else if (!preview) preview = '📎 Fayl yubordi';

          // Show in-app toast notification (Telegram-style)
          toast(senderName, {
            description: preview.slice(0, 100),
            duration: 5000,
            action: {
              label: 'Ochish',
              onClick: () => navigate(`/chat/${msg.sender_id}`),
            },
          });

          // Notify useConversations to refresh the list
          window.dispatchEvent(
            new CustomEvent('avlodona:new-message', {
              detail: {
                conversationId: msg.conversation_id,
                senderId: msg.sender_id,
              },
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // navigate is stable, user.id changes only on login/logout
  }, [user?.id, navigate]);
};
