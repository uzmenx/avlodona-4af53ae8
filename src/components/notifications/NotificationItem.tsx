import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Send, TreeDeciduous, Check, AtSign, Users, CalendarDays, X, Loader2, Trash2, MailOpen } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useFollow } from '@/hooks/useFollow';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete?: (id: string) => void;
}



type ActionState = 'idle' | 'accepting' | 'accepted' | 'declining' | 'declined';

const TYPE_CONFIG: Record<string, { gradient: string; icon: React.ReactNode; label: string }> = {
  follow: {
    gradient: 'from-violet-500 to-indigo-500',
    icon: <UserPlus className="h-3.5 w-3.5 text-white" />,
    label: 'sizni kuzata boshladi',
  },
  follow_request: {
    gradient: 'from-amber-400 to-orange-500',
    icon: <UserPlus className="h-3.5 w-3.5 text-white" />,
    label: "kuzatish so'rovini yubordi",
  },
  like: {
    gradient: 'from-rose-500 to-pink-500',
    icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />,
    label: 'postingizni yoqtirdi',
  },
  story_like: {
    gradient: 'from-rose-500 to-pink-500',
    icon: <Heart className="h-3.5 w-3.5 text-white fill-white" />,
    label: 'hikoyangizni yoqtirdi',
  },
  comment: {
    gradient: 'from-sky-500 to-blue-500',
    icon: <MessageCircle className="h-3.5 w-3.5 text-white" />,
    label: 'postingizga izoh qoldirdi',
  },
  story: {
    gradient: 'from-sky-500 to-blue-500',
    icon: <MessageCircle className="h-3.5 w-3.5 text-white" />,
    label: 'yangi hikoya joyladi',
  },
  message: {
    gradient: 'from-emerald-500 to-teal-500',
    icon: <Send className="h-3.5 w-3.5 text-white" />,
    label: 'sizga xabar yubordi',
  },
  calendar_event: {
    gradient: 'from-cyan-500 to-sky-500',
    icon: <CalendarDays className="h-3.5 w-3.5 text-white" />,
    label: 'kalendar voqeasi bugun',
  },
  family_invitation: {
    gradient: 'from-emerald-500 to-green-600',
    icon: <TreeDeciduous className="h-3.5 w-3.5 text-white" />,
    label: 'sizni oila daraxtiga taklif qildi',
  },
  family_invitation_accepted: {
    gradient: 'from-emerald-500 to-green-600',
    icon: <Check className="h-3.5 w-3.5 text-white" />,
    label: "oila daraxtiga qo'shildi",
  },
  mention: {
    gradient: 'from-purple-500 to-violet-500',
    icon: <AtSign className="h-3.5 w-3.5 text-white" />,
    label: 'sizni belgiladi',
  },
  collab_request: {
    gradient: 'from-indigo-500 to-blue-500',
    icon: <Users className="h-3.5 w-3.5 text-white" />,
    label: "hamkor sifatida qo'shmoqchi",
  },
  collab_accepted: {
    gradient: 'from-indigo-500 to-blue-500',
    icon: <Check className="h-3.5 w-3.5 text-white" />,
    label: 'hamkorlikni qabul qildi',
  },
  family_connection_request: {
    gradient: 'from-emerald-500 to-teal-500',
    icon: <TreeDeciduous className="h-3.5 w-3.5 text-white" />,
    label: "daraxtingizga qo'shilishni xohlayapti",
  },
};

export const NotificationItem = ({ notification, onRead }: NotificationItemProps) => {
  const navigate = useNavigate();
  const { isFollowing, toggleFollow, isLoading: isFollowLoading } = useFollow(notification.actor_id);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [isRemoving, setIsRemoving] = useState(false);

  const config = TYPE_CONFIG[notification.type] ?? {
    gradient: 'from-slate-500 to-gray-500',
    icon: <UserPlus className="h-3.5 w-3.5 text-white" />,
    label: '',
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.stop-propagation')) return;
    if (!notification.is_read) onRead(notification.id);

    switch (notification.type) {
      case 'follow':
      case 'follow_request':
        navigate(`/user/${notification.actor_id}`);
        break;
      case 'message':
        navigate(`/chat/${notification.actor_id}`);
        break;
      case 'story_like':
        navigate(notification.post_id
          ? `/user/${notification.actor_id}?view=stories&storyId=${notification.post_id}`
          : `/user/${notification.actor_id}`);
        break;
      case 'like':
      case 'comment':
      case 'mention':
        navigate(notification.post_id
          ? `/user/${notification.actor_id}?postId=${notification.post_id}${notification.comment_id ? `&commentId=${notification.comment_id}` : ''}`
          : `/user/${notification.actor_id}`);
        break;
      case 'story':
        navigate(`/user/${notification.actor_id}?view=stories`);
        break;
      case 'calendar_event':
        navigate('/');
        break;
      case 'collab_request':
      case 'collab_accepted':
        navigate('/profile');
        break;
      case 'family_invitation':
      case 'family_invitation_accepted':
      case 'family_connection_request':
        navigate('/relatives');
        break;
      default:
        navigate(`/user/${notification.actor_id}`);
    }
  };

  const handleAcceptRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionState !== 'idle') return;
    setActionState('accepting');
    try {
      await supabase
        .from('follows')
        .update({ status: 'accepted' })
        .eq('following_id', notification.user_id)
        .eq('follower_id', notification.actor_id)
        .eq('status', 'pending');

      await supabase
        .from('notifications')
        .update({ type: 'follow' })
        .eq('id', notification.id);

      // Notify the requester their request was accepted
      await supabase.from('notifications').insert({
        user_id: notification.actor_id,
        actor_id: notification.user_id,
        type: 'follow',
      });

      setActionState('accepted');
    } catch (err) {
      console.error(err);
      setActionState('idle');
    }
  };

  const handleDeclineRequest = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actionState !== 'idle') return;
    setActionState('declining');
    try {
      // Delete the pending follow row
      await supabase
        .from('follows')
        .delete()
        .eq('following_id', notification.user_id)
        .eq('follower_id', notification.actor_id)
        .eq('status', 'pending');

      // Remove the notification
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id);

      setActionState('declined');

      // Animate the item out
      setTimeout(() => setIsRemoving(true), 400);
    } catch (err) {
      console.error(err);
      setActionState('idle');
    }
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${notification.actor_id}`);
  };

  const handleMediaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (notification.type === 'story_like' || notification.type === 'story') {
      navigate(`/user/${notification.actor_id}?view=stories${notification.post_id ? `&storyId=${notification.post_id}` : ''}`);
    } else if (notification.post_id) {
      navigate(`/user/${notification.actor_id}?postId=${notification.post_id}`);
    }
  };

  const formatTime = (dateStr: string) =>
    formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });

  const renderMediaPreview = () => {
    const hasStoryMedia = notification.story?.media_url;
    const hasPostMedia = notification.post?.media_urls && notification.post.media_urls.length > 0;
    if (!hasStoryMedia && !hasPostMedia) return null;

    const mediaUrl = hasStoryMedia ? notification.story?.media_url : notification.post?.media_urls?.[0];
    const mediaType = hasStoryMedia ? notification.story?.media_type : 'image';
    const isVideo = hasStoryMedia ? mediaType === 'video' : mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
    if (!mediaUrl) return null;

    return (
      <div
        onClick={handleMediaClick}
        className="h-12 w-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 stop-propagation hover:opacity-80 transition-opacity cursor-pointer"
      >
        {isVideo ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <img src={mediaUrl} alt="Preview" className="h-full w-full object-cover" />
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {!isRemoving && (
        <motion.div
          layout
          initial={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          onClick={handleClick}
          className={cn(
            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors relative overflow-hidden group',
            notification.is_read
              ? 'hover:bg-white/3'
              : 'bg-primary/[0.05] hover:bg-primary/[0.08]'
          )}
        >
          {/* Unread indicator */}
          {!notification.is_read && (
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-primary/40" />
          )}

          {/* Avatar + Icon badge */}
          <div className="relative stop-propagation shrink-0" onClick={handleProfileClick}>
            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
              <AvatarImage src={notification.actor?.avatar_url || undefined} />
              <AvatarFallback className="text-sm font-semibold bg-gradient-to-br from-muted to-muted/50">
                {getInitials(notification.actor?.name || notification.actor?.username)}
              </AvatarFallback>
            </Avatar>
            {/* Type badge */}
            <div className={cn(
              'absolute -bottom-1 -right-1 h-[22px] w-[22px] rounded-full flex items-center justify-center shadow-lg ring-2 ring-background',
              'bg-gradient-to-br', config.gradient
            )}>
              {config.icon}
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm leading-snug', !notification.is_read && 'font-medium')}>
              <span
                className="font-bold hover:underline stop-propagation cursor-pointer"
                onClick={handleProfileClick}
              >
                {notification.actor?.name || notification.actor?.username || 'Foydalanuvchi'}
              </span>{' '}
              <span className="text-muted-foreground">{config.label}</span>
            </p>

            {notification.comment?.content && (
              <p className="text-xs text-foreground/80 bg-muted/50 px-2 py-1 rounded-lg mt-1 line-clamp-1 border border-border/20">
                {notification.comment.content}
              </p>
            )}

            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatTime(notification.created_at)}</p>
          </div>

          {/* Right side actions / media */}
          <div className="shrink-0 flex items-center gap-2">
            {/* Follow-back button for 'follow' type */}
            {notification.type === 'follow' && (
              <div className="stop-propagation">
                <Button
                  size="sm"
                  variant={isFollowing ? 'outline' : 'default'}
                  onClick={(e) => { e.stopPropagation(); toggleFollow(); }}
                  disabled={isFollowLoading}
                  className={cn(
                    'h-8 px-3 text-xs rounded-full font-medium',
                    !isFollowing && 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90 border-0'
                  )}
                >
                  {isFollowLoading
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : isFollowing ? 'Kuzatilmoqda' : 'Javob qaytarish'}
                </Button>
              </div>
            )}

            {/* Follow request accept / decline */}
            {notification.type === 'follow_request' && actionState === 'idle' && (
              <div className="stop-propagation flex flex-col gap-1.5">
                <Button
                  size="sm"
                  onClick={handleAcceptRequest}
                  className="h-7 px-3 text-[11px] rounded-full font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 hover:opacity-90 shadow-sm"
                >
                  Qabul
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDeclineRequest}
                  className="h-7 px-3 text-[11px] rounded-full text-muted-foreground border-white/15 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 shadow-none"
                >
                  Rad
                </Button>
              </div>
            )}

            {/* Accepting spinner */}
            {notification.type === 'follow_request' && actionState === 'accepting' && (
              <div className="stop-propagation flex items-center gap-1.5 px-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
              </div>
            )}

            {/* Accepted badge */}
            {notification.type === 'follow_request' && actionState === 'accepted' && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="stop-propagation flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30"
              >
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] text-emerald-500 font-semibold">Qabul qilindi</span>
              </motion.div>
            )}

            {/* Declining spinner */}
            {notification.type === 'follow_request' && actionState === 'declining' && (
              <div className="stop-propagation flex items-center gap-1.5 px-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Declined badge */}
            {notification.type === 'follow_request' && actionState === 'declined' && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="stop-propagation flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50 border border-border/30"
              >
                <X className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-medium">Rad etildi</span>
              </motion.div>
            )}

            {renderMediaPreview()}

            {!notification.is_read && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 shadow-[0_0_6px_2px_rgba(var(--primary)/0.4)]" />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
