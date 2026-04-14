import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, UserPlus, MessageSquare, X,
  CalendarDays, AtSign, Users, TreeDeciduous, Check, Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PushNotificationData {
  id: string;
  type: string;
  actor: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  post?: { id: string; media_urls: string[] | null };
  messageMedia?: { url: string; type: 'image' | 'video' | 'audio' } | null;
  created_at: string;
}

const getConfig = (type: string): { gradient: string; icon: React.ReactNode; text: (name: string) => string } => {
  switch (type) {
    case 'follow':
      return { gradient: 'from-violet-500 to-indigo-500', icon: <UserPlus className="h-3 w-3 text-white" />, text: (n) => `${n} sizni kuzata boshladi` };
    case 'follow_request':
      return { gradient: 'from-amber-400 to-orange-500', icon: <UserPlus className="h-3 w-3 text-white" />, text: (n) => `${n} kuzatish so'rovini yubordi` };
    case 'like':
    case 'story_like':
      return { gradient: 'from-rose-500 to-pink-500', icon: <Heart className="h-3 w-3 text-white fill-white" />, text: (n) => type === 'story_like' ? `${n} hikoyangizni yoqtirdi` : `${n} postingizni yoqtirdi` };
    case 'comment':
      return { gradient: 'from-sky-500 to-blue-500', icon: <MessageCircle className="h-3 w-3 text-white" />, text: (n) => `${n} izoh qoldirdi` };
    case 'story':
      return { gradient: 'from-sky-500 to-blue-500', icon: <MessageCircle className="h-3 w-3 text-white" />, text: (n) => `${n} yangi hikoya joyladi` };
    case 'message':
      return { gradient: 'from-emerald-500 to-teal-500', icon: <MessageSquare className="h-3 w-3 text-white" />, text: (n) => `${n} xabar yubordi` };
    case 'calendar_event':
      return { gradient: 'from-cyan-500 to-sky-500', icon: <CalendarDays className="h-3 w-3 text-white" />, text: (n) => `${n} kalendar voqeasi bugun` };
    case 'mention':
      return { gradient: 'from-purple-500 to-violet-500', icon: <AtSign className="h-3 w-3 text-white" />, text: (n) => `${n} sizni belgiladi` };
    case 'collab_request':
      return { gradient: 'from-indigo-500 to-blue-500', icon: <Users className="h-3 w-3 text-white" />, text: (n) => `${n} hamkorlik so'radi` };
    case 'collab_accepted':
      return { gradient: 'from-indigo-500 to-blue-500', icon: <Check className="h-3 w-3 text-white" />, text: (n) => `${n} hamkorlikni qabul qildi` };
    case 'family_invitation':
      return { gradient: 'from-emerald-500 to-green-600', icon: <TreeDeciduous className="h-3 w-3 text-white" />, text: (n) => `${n} oila daraxtiga taklif qildi` };
    case 'family_invitation_accepted':
      return { gradient: 'from-emerald-500 to-green-600', icon: <Check className="h-3 w-3 text-white" />, text: (n) => `${n} oila daraxtiga qo'shildi` };
    case 'family_connection_request':
      return { gradient: 'from-emerald-500 to-teal-500', icon: <TreeDeciduous className="h-3 w-3 text-white" />, text: (n) => `${n} daraxtingizga qo'shilmoqchi` };
    default:
      return { gradient: 'from-slate-500 to-gray-500', icon: <Send className="h-3 w-3 text-white" />, text: (n) => n };
  }
};

export const PushNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<PushNotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setIsVisible(false);
    timerRef.current && clearTimeout(timerRef.current);
    setTimeout(() => setNotification(null), 400);
  };

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('push-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        const raw = payload.new as Record<string, unknown>;

        const { data: actor } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .eq('id', raw.actor_id as string)
          .single();

        let post = null;
        if (raw.post_id) {
          const { data } = await supabase.from('posts').select('id, media_urls').eq('id', raw.post_id as string).single();
          post = data;
        }

        let messageMedia: PushNotificationData['messageMedia'] = null;
        if (raw.type === 'message') {
          const { data: msg } = await supabase
            .from('messages')
            .select('media_url, media_type')
            .eq('sender_id', raw.actor_id as string)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (msg?.media_url && ['image', 'video', 'audio'].includes(msg.media_type as string)) {
            messageMedia = { url: msg.media_url, type: msg.media_type as 'image' | 'video' | 'audio' };
          }
        }

        if (actor) {
          if (timerRef.current) clearTimeout(timerRef.current);
          setNotification({
            id: raw.id as string,
            type: raw.type as string,
            actor,
            post: post || undefined,
            messageMedia,
            created_at: raw.created_at as string,
          });
          setIsVisible(true);
          timerRef.current = setTimeout(dismiss, 5500);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const handleClick = () => {
    if (!notification) return;
    dismiss();
    switch (notification.type) {
      case 'follow':
      case 'follow_request':
        navigate(`/user/${notification.actor.id}`);
        break;
      case 'message':
        navigate(`/chat/${notification.actor.id}`);
        break;
      default:
        navigate('/notifications');
    }
  };

  const config = notification ? getConfig(notification.type) : null;
  const actorName = notification?.actor.name || notification?.actor.username || 'Foydalanuvchi';
  const mediaPreview = notification?.messageMedia?.type === 'image' || notification?.messageMedia?.type === 'video'
    ? notification.messageMedia.url
    : notification?.post?.media_urls?.[0] ?? null;

  return (
    <AnimatePresence>
      {isVisible && notification && config && (
        <motion.div
          key={notification.id}
          initial={{ y: -80, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.92 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed top-3 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none"
        >
          <div
            className={cn(
              'pointer-events-auto w-full max-w-[380px] rounded-2xl cursor-pointer',
              'bg-background/80 backdrop-blur-2xl border border-white/10',
              'shadow-[0_8px_32px_rgba(0,0,0,0.35)] shadow-black/30',
              'overflow-hidden'
            )}
            onClick={handleClick}
          >
            {/* Top accent bar */}
            <div className={cn('h-[2px] w-full bg-gradient-to-r', config.gradient)} />

            <div className="flex items-center gap-3 px-3.5 py-3">
              {/* Avatar with type badge */}
              <div className="relative shrink-0">
                <Avatar className="h-11 w-11 border-2 border-white/10 shadow-md">
                  <AvatarImage src={notification.actor.avatar_url || undefined} />
                  <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-muted to-muted/50">
                    {(notification.actor.name || notification.actor.username || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  'absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center',
                  'shadow-md ring-2 ring-background bg-gradient-to-br', config.gradient
                )}>
                  {config.icon}
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avlodona</span>
                  <span className="text-[10px] text-muted-foreground/60">•</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: false, locale: uz })}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                  {config.text(actorName)}
                </p>
              </div>

              {/* Media preview or type icon */}
              {mediaPreview ? (
                <div className="shrink-0 h-11 w-11 rounded-xl overflow-hidden border border-white/10">
                  <img src={mediaPreview} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className={cn(
                  'shrink-0 h-11 w-11 rounded-xl flex items-center justify-center',
                  'bg-gradient-to-br opacity-90', config.gradient
                )}>
                  <div className="scale-150">{config.icon}</div>
                </div>
              )}

              {/* Dismiss */}
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(); }}
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
