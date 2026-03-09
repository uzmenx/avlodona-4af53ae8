import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Heart, MessageCircle, UserPlus, MessageSquare, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PushNotificationData {
  id: string;
  type: 'follow' | 'like' | 'comment' | 'message' | 'story_like' | 'mention' | 'collab_request' | 'collab_accepted';
  actor: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  post?: {
    id: string;
    media_urls: string[] | null;
  };
  created_at: string;
}

export const PushNotification = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<PushNotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('push-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotification = payload.new as any;
          
          // Fetch actor info
          const { data: actor } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .eq('id', newNotification.actor_id)
            .single();

          // Fetch post if exists
          let post = null;
          if (newNotification.post_id) {
            const { data: postData } = await supabase
              .from('posts')
              .select('id, media_urls')
              .eq('id', newNotification.post_id)
              .single();
            post = postData;
          }

          if (actor) {
            setNotification({
              id: newNotification.id,
              type: newNotification.type as PushNotificationData['type'],
              actor,
              post: post || undefined,
              created_at: newNotification.created_at,
            });
            setIsVisible(true);
            setIsExiting(false);

            // Auto hide after 5 seconds
            setTimeout(() => {
              handleClose();
            }, 5000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      setNotification(null);
      setIsExiting(false);
    }, 300);
  };

  const handleClick = () => {
    if (!notification) return;

    handleClose();

    switch (notification.type) {
      case 'follow':
        navigate(`/user/${notification.actor.id}`);
        break;
      case 'like':
      case 'comment':
      case 'story_like':
        navigate('/notifications');
        break;
      case 'message':
        navigate(`/chat/${notification.actor.id}`);
        break;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'like':
      case 'story_like':
        return <Heart className="h-4 w-4 text-destructive fill-destructive" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-primary" />;
      default:
        return null;
    }
  };

  const getNotificationText = (type: string, actorName: string) => {
    switch (type) {
      case 'follow':
        return `${actorName} sizni kuzatmoqda`;
      case 'like':
        return `${actorName} postingizni yoqtirdi`;
      case 'story_like':
        return `${actorName} hikoyangizni yoqtirdi`;
      case 'comment':
        return `${actorName} izoh qoldirdi`;
      case 'message':
        return `${actorName} xabar yubordi`;
      case 'mention':
        return `${actorName} sizni postda belgiladi`;
      case 'collab_request':
        return `${actorName} hamkorlik so'radi`;
      case 'collab_accepted':
        return `${actorName} hamkorlikni qabul qildi`;
      default:
        return '';
    }
  };

  if (!isVisible || !notification) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] px-4 pt-2 pointer-events-none">
      <div
        className={cn(
          "mx-auto max-w-md bg-card border border-border rounded-xl shadow-xl p-3 pointer-events-auto cursor-pointer",
          "transform transition-all duration-300 ease-out",
          isExiting 
            ? "animate-out slide-out-to-top fade-out" 
            : "animate-in slide-in-from-top fade-in"
        )}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          {/* App Icon */}
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">F</span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-muted-foreground">Avlodona</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { 
                  addSuffix: false, 
                  locale: uz 
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={notification.actor.avatar_url || undefined} />
                <AvatarFallback>
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
              <p className="text-sm text-foreground truncate">
                {getNotificationText(
                  notification.type,
                  notification.actor.name || notification.actor.username || 'Foydalanuvchi'
                )}
              </p>
            </div>
          </div>

          {/* Icon/Preview */}
          <div className="shrink-0">
            {notification.post?.media_urls?.[0] ? (
              <img
                src={notification.post.media_urls[0]}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                {getNotificationIcon(notification.type)}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="shrink-0 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};
