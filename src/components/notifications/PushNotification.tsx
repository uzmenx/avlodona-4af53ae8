import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, UserPlus, X,
  CalendarDays, AtSign, Users, TreeDeciduous, Check,
  Send, MessageSquare, ArrowRight,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActorProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface AlertData {
  id: string;
  kind: 'message' | 'notification';
  /** notification type (follow, like…) OR message media type (text, image…) */
  type: string;
  actor: ActorProfile;
  /** human-readable preview */
  text: string;
  mediaThumb?: string | null;
  conversationId?: string;
  created_at: string;
}

// ─── Notification config ───────────────────────────────────────────────────────

const NOTIF_CONFIG: Record<string, { gradient: string; icon: React.ReactNode; label: (n: string) => string }> = {
  follow:                      { gradient: 'from-violet-500 to-indigo-500',   icon: <UserPlus className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} sizni kuzata boshladi` },
  follow_request:              { gradient: 'from-amber-400 to-orange-500',    icon: <UserPlus className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} kuzatish so'radi` },
  like:                        { gradient: 'from-rose-500 to-pink-500',       icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />, label: (n) => `${n} postingizni yoqtirdi` },
  story_like:                  { gradient: 'from-rose-500 to-pink-500',       icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />, label: (n) => `${n} hikoyangizni yoqtirdi` },
  comment:                     { gradient: 'from-sky-500 to-blue-500',        icon: <MessageCircle className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} izoh qoldirdi` },
  story:                       { gradient: 'from-sky-500 to-blue-500',        icon: <MessageCircle className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} yangi hikoya joyladi` },
  message:                     { gradient: 'from-emerald-500 to-teal-500',    icon: <MessageSquare className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} xabar yubordi` },
  calendar_event:              { gradient: 'from-cyan-500 to-sky-500',        icon: <CalendarDays className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} — kalendar voqeasi` },
  mention:                     { gradient: 'from-purple-500 to-violet-500',   icon: <AtSign className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} sizni belgiladi` },
  collab_request:              { gradient: 'from-indigo-500 to-blue-500',     icon: <Users className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} hamkorlik so'radi` },
  collab_accepted:             { gradient: 'from-indigo-500 to-blue-500',     icon: <Check className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} hamkorlikni qabul qildi` },
  family_invitation:           { gradient: 'from-emerald-500 to-green-600',   icon: <TreeDeciduous className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} oila daraxtiga taklif qildi` },
  family_invitation_accepted:  { gradient: 'from-emerald-500 to-green-600',   icon: <Check className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} oila daraxtiga qo'shildi` },
  family_connection_request:   { gradient: 'from-emerald-500 to-teal-500',    icon: <TreeDeciduous className="h-3.5 w-3.5 text-white" />, label: (n) => `${n} daraxtingizga qo'shilmoqchi` },
};

const MSG_GRADIENT = 'from-emerald-500 to-teal-500';

// ─── Quick Reply ───────────────────────────────────────────────────────────────

const QuickReply = ({
  conversationId,
  onSent,
  onCancel,
}: {
  conversationId: string;
  onSent: () => void;
  onCancel: () => void;
}) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!text.trim() || !user?.id || sending) return;
    setSending(true);
    try {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: text.trim(),
        status: 'sent',
      });
      onSent();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3.5 pb-3 pt-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="Javob yozing..."
          className={cn(
            'flex-1 h-9 rounded-full px-3.5 text-sm',
            'bg-white/10 border border-white/15 text-white placeholder:text-white/40',
            'focus:outline-none focus:border-emerald-400/60 transition-colors'
          )}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center transition-all',
            text.trim()
              ? 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 shadow-md shadow-emerald-500/30'
              : 'bg-white/10 opacity-50'
          )}
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Banner Card ───────────────────────────────────────────────────────────────

const BannerCard = ({
  alert,
  onDismiss,
}: {
  alert: AlertData;
  onDismiss: () => void;
}) => {
  const navigate = useNavigate();
  const [showReply, setShowReply] = useState(false);
  const [sent, setSent] = useState(false);

  const y = useMotionValue(0);
  const opacity = useTransform(y, [-60, 0], [0, 1]);

  const isMsg = alert.kind === 'message';
  const config = !isMsg ? (NOTIF_CONFIG[alert.type] ?? NOTIF_CONFIG['message']) : null;
  const gradient = isMsg ? MSG_GRADIENT : (config?.gradient ?? MSG_GRADIENT);

  const actorName = alert.actor.name || alert.actor.username || 'Foydalanuvchi';
  const displayText = isMsg ? alert.text : (config?.label(actorName) ?? alert.text);
  const initials = actorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const handleOpen = () => {
    onDismiss();
    if (isMsg && alert.actor.id) {
      navigate(`/chat/${alert.actor.id}`);
    } else {
      switch (alert.type) {
        case 'follow':
        case 'follow_request': navigate(`/user/${alert.actor.id}`); break;
        case 'message':        navigate(`/chat/${alert.actor.id}`); break;
        default:               navigate('/notifications');
      }
    }
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: -200, bottom: 0 }}
      dragElastic={{ top: 0.5, bottom: 0 }}
      style={{ y, opacity }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -40 || info.velocity.y < -300) onDismiss();
      }}
      className="w-full cursor-grab active:cursor-grabbing select-none"
    >
      <div
        className={cn(
          'rounded-[20px] overflow-hidden',
          'bg-[rgba(20,20,25,0.82)] backdrop-blur-3xl',
          'border border-white/[0.08]',
          'shadow-[0_16px_48px_rgba(0,0,0,0.55)]',
        )}
      >
        {/* Gradient accent line */}
        <div className={cn('h-[2.5px] w-full bg-gradient-to-r', gradient)} />

        {/* Main row */}
        <div className="flex items-center gap-3 px-3.5 pt-3 pb-2.5">
          {/* Avatar + badge */}
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 border-2 border-white/[0.07] shadow-md">
              <AvatarImage src={alert.actor.avatar_url || undefined} />
              <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-muted/70 to-muted/40 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className={cn(
              'absolute -bottom-1 -right-1 h-[20px] w-[20px] rounded-full flex items-center justify-center',
              'shadow-md ring-2 ring-[rgba(20,20,25,0.82)] bg-gradient-to-br', gradient
            )}>
              {isMsg
                ? <MessageSquare className="h-2.5 w-2.5 text-white" />
                : config?.icon
              }
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-[2px]">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Avlodona</span>
              <span className="text-[10px] text-white/25">•</span>
              <span className="text-[10px] text-white/35">hozir</span>
            </div>

            {isMsg ? (
              <>
                <p className="text-[13px] font-semibold text-white/95 leading-tight truncate">{actorName}</p>
                <p className="text-[12px] text-white/55 leading-snug line-clamp-2 mt-[1px]">{displayText}</p>
              </>
            ) : (
              <p className="text-[13px] font-medium text-white/90 leading-snug line-clamp-2">{displayText}</p>
            )}
          </div>

          {/* Right side: thumbnail or type icon */}
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {alert.mediaThumb ? (
              <div className="h-[44px] w-[44px] rounded-[10px] overflow-hidden border border-white/10">
                <img src={alert.mediaThumb} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className={cn(
                'h-[44px] w-[44px] rounded-[10px] flex items-center justify-center',
                'bg-gradient-to-br', gradient, 'opacity-80'
              )}>
                {isMsg
                  ? <MessageSquare className="h-5 w-5 text-white" />
                  : config?.icon && <span className="scale-[1.6]">{config.icon}</span>
                }
              </div>
            )}
          </div>

          {/* Dismiss */}
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="h-3 w-3 text-white/40" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0 border-t border-white/[0.06]">
          {isMsg && alert.conversationId && !sent && (
            <button
              onClick={() => setShowReply(r => !r)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold transition-colors',
                showReply ? 'text-emerald-400' : 'text-white/50 hover:text-white/80'
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Javob berish
            </button>
          )}
          {sent && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Yuborildi
            </div>
          )}
          <div className="w-px h-5 bg-white/[0.06]" />
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-semibold text-white/50 hover:text-white/80 transition-colors"
          >
            Ochish
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Quick Reply Input */}
        <AnimatePresence>
          {showReply && alert.conversationId && (
            <QuickReply
              conversationId={alert.conversationId}
              onSent={() => { setSent(true); setShowReply(false); setTimeout(onDismiss, 1200); }}
              onCancel={() => setShowReply(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNativeNotifications, showNativeNotification } from '@/hooks/useNativeNotifications';

export const PushNotification = () => {
  const navigate = useNavigate();
  usePushNotifications();
  // navigate ni hook ga beramiz — local notification bosilganda deep link ishlaydi
  const { isBackground } = useNativeNotifications(navigate);
  const { user } = useAuth();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  useEffect(() => { locationRef.current = location.pathname; }, [location.pathname]);

  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const addAlert = useCallback((alert: AlertData) => {
    setAlerts(prev => {
      // Replace same-id or same-sender message (de-dup)
      const filtered = prev.filter(a => a.id !== alert.id && !(a.kind === 'message' && a.actor.id === alert.actor.id));
      return [alert, ...filtered].slice(0, 3); // max 3 stacked
    });
    // Auto-dismiss after 6s
    const t = setTimeout(() => dismiss(alert.id), 6000);
    timers.current.set(alert.id, t);

    // ── Native OS notification (fonda bo'lganda tizim panelida ko'rinadi) ──
    if (isBackground.current) {
      const actorName = alert.actor.name || alert.actor.username || 'Foydalanuvchi';
      let title = 'Avlodona';
      let body = '';

      if (alert.kind === 'message') {
        title = actorName;  // Telegram kabi: title = sender ismi
        body = alert.text || 'Yangi xabar';
      } else {
        const cfg = NOTIF_CONFIG[alert.type];
        body = cfg ? cfg.label(actorName) : `${actorName} yangi bildirishnoma yubordi`;
      }

      showNativeNotification(title, body, {
        type: alert.type,
        actorId: alert.actor.id,
        conversationId: alert.conversationId,
        // Avatar — bildirishnoma katta ikonkasi uchun
        avatarUrl: alert.actor.avatar_url ?? undefined,
      });
    }
  }, [dismiss, isBackground]);

  // Listen to incoming-message custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{
        id: string;
        conversationId: string;
        sender: ActorProfile;
        preview: string;
        mediaThumb: string | null;
        mediaType: string | null;
      }>;
      const d = ce.detail;

      // Don't show if user is already in this chat
      if (locationRef.current === `/chat/${d.sender.id}`) return;

      addAlert({
        id: d.id,
        kind: 'message',
        type: d.mediaType || 'text',
        actor: d.sender,
        text: d.preview,
        mediaThumb: d.mediaThumb,
        conversationId: d.conversationId,
        created_at: new Date().toISOString(),
      });
    };
    window.addEventListener('avlodona:incoming-message', handler as EventListener);
    return () => window.removeEventListener('avlodona:incoming-message', handler as EventListener);
  }, [addAlert]);

  // Listen to Supabase notifications table
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('push-notifications-v2')
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

        if (!actor) return;

        let mediaThumb: string | null = null;
        if (raw.post_id) {
          const { data: post } = await supabase.from('posts').select('media_urls').eq('id', raw.post_id as string).single();
          if (post?.media_urls?.[0]) mediaThumb = post.media_urls[0];
        }

        addAlert({
          id: raw.id as string,
          kind: 'notification',
          type: raw.type as string,
          actor: actor as ActorProfile,
          text: '',
          mediaThumb,
          created_at: raw.created_at as string,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, addAlert]);

  useEffect(() => {
    return () => { timers.current.forEach(t => clearTimeout(t)); };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
      <div className="w-full max-w-[390px] flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              layout
              initial={{ y: -90, opacity: 0, scale: 0.88 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -90, opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', damping: 22, stiffness: 320, mass: 0.8 }}
            >
              <BannerCard alert={alert} onDismiss={() => dismiss(alert.id)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
