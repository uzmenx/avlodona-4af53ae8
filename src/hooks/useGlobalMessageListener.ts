import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface IncomingMessage {
  id: string;
  sender_id: string;
  conversation_id: string;
  content: string | null;
  media_type?: 'image' | 'video' | 'audio' | null;
  media_url?: string | null;
}

/**
 * Global real-time message listener.
 * Mounted once at App level — works regardless of which page the user is on.
 * Dispatches a custom DOM event for PushNotification.tsx to handle the in-app banner.
 * Does NOT show a sonner toast (that was the duplicate "cheap" notification).
 */
export const useGlobalMessageListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Expose navigate so PushNotification can use it via DOM event
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ senderId: string }>;
      navigate(`/chat/${ce.detail.senderId}`);
    };
    window.addEventListener('avlodona:open-chat', handler as EventListener);
    return () => window.removeEventListener('avlodona:open-chat', handler as EventListener);
  }, [navigate]);

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
          if (!msg || msg.sender_id === user.id) return;

          // If user is already in this specific chat, don't show banner
          const currentPath = locationRef.current;
          if (currentPath === `/chat/${msg.sender_id}`) {
            // Still refresh conversation list
            window.dispatchEvent(new CustomEvent('avlodona:new-message', {
              detail: { conversationId: msg.conversation_id, senderId: msg.sender_id },
            }));
            return;
          }

          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', msg.sender_id)
            .maybeSingle();

          if (!sender) return;

          // Build preview text
          let preview = msg.content?.trim() ?? '';
          let mediaThumb: string | null = null;

          if (msg.media_type === 'image') {
            preview = '📷 Rasm';
            mediaThumb = msg.media_url ?? null;
          } else if (msg.media_type === 'video') {
            preview = '🎥 Video';
            mediaThumb = msg.media_url ?? null;
          } else if (msg.media_type === 'audio') {
            preview = '🎤 Ovozli xabar';
          } else if (!preview) {
            preview = '📎 Fayl';
          }

          // Remove [[POST:...]] and [[SHORT:...]] markers from preview
          preview = preview.replace(/\[\[(POST|SHORT):[^\]]+\]\]/g, 'Post').trim();

          // Dispatch custom event — PushNotification.tsx will handle the banner
          window.dispatchEvent(new CustomEvent('avlodona:incoming-message', {
            detail: {
              id: msg.id,
              conversationId: msg.conversation_id,
              sender,
              preview: preview.slice(0, 120),
              mediaThumb,
              mediaType: msg.media_type,
            },
          }));

          // Refresh conversation list
          window.dispatchEvent(new CustomEvent('avlodona:new-message', {
            detail: { conversationId: msg.conversation_id, senderId: msg.sender_id },
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);
};
