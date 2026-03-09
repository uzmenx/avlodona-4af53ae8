import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Send, TreeDeciduous, Check, AtSign, Users, CalendarDays } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export const NotificationItem = ({ notification, onRead }: NotificationItemProps) => {
  const navigate = useNavigate();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'follow':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'like':
      case 'story_like':
        return <Heart className="h-4 w-4 text-destructive fill-destructive" />;
      case 'story':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-primary" />;
      case 'message':
        return <Send className="h-4 w-4 text-primary" />;
      case 'calendar_event':
        return <CalendarDays className="h-4 w-4 text-primary" />;
      case 'family_invitation':
        return <TreeDeciduous className="h-4 w-4 text-emerald-600" />;
      case 'family_invitation_accepted':
        return <Check className="h-4 w-4 text-emerald-600" />;
      case 'mention':
        return <AtSign className="h-4 w-4 text-primary" />;
      case 'collab_request':
        return <Users className="h-4 w-4 text-primary" />;
      case 'collab_accepted':
        return <Check className="h-4 w-4 text-primary" />;
      case 'family_connection_request':
        return <TreeDeciduous className="h-4 w-4 text-primary" />;
      default:
        return <UserPlus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getMessage = () => {
    switch (notification.type) {
      case 'follow':
        return 'sizni kuzata boshladi';
      case 'like':
        return 'postingizni yoqtirdi';
      case 'story_like':
        return 'hikoyangizni yoqtirdi';
      case 'story':
        return 'yangi hikoya joyladi';
      case 'comment':
        return 'postingizga izoh qoldirdi';
      case 'message':
        return 'sizga xabar yubordi';
      case 'calendar_event':
        return 'kalendar voqeasi bugun';
      case 'family_invitation':
        return 'sizni oila daraxtiga taklif qildi';
      case 'family_invitation_accepted':
        return 'oila daraxtiga qo\'shildi';
      case 'mention':
        return notification.comment_id
          ? 'izohda sizni belgiladi'
          : 'postda sizni belgiladi';
      case 'collab_request':
        return 'sizni hamkor sifatida qo\'shmoqchi';
      case 'collab_accepted':
        return 'hamkorlikni qabul qildi';
      case 'family_connection_request':
        return 'sizning daraxtingizga qo\'shilishni xohlayapti';
      default:
        return '';
    }
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id);
    }

    switch (notification.type) {
      case 'follow':
        navigate(`/user/${notification.actor_id}`);
        break;
      case 'like':
      case 'comment':
      case 'story_like':
        if (notification.post_id) {
          navigate(`/user/${notification.actor_id}`);
        }
        break;
      case 'story':
        navigate(`/user/${notification.actor_id}`);
        break;
      case 'message':
        navigate(`/chat/${notification.actor_id}`);
        break;
      case 'calendar_event':
        navigate('/');
        break;
      case 'mention':
        navigate('/profile');
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
    }
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer transition-colors",
        notification.is_read 
          ? "bg-background hover:bg-muted/50" 
          : "bg-primary/5 hover:bg-primary/10"
      )}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={notification.actor?.avatar_url || undefined} />
          <AvatarFallback>{getInitials(notification.actor?.name)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background flex items-center justify-center">
          {getIcon()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", !notification.is_read && "font-medium")}>
          <span className="font-semibold">
            {notification.actor?.name || notification.actor?.username || 'Foydalanuvchi'}
          </span>{' '}
          {getMessage()}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTime(notification.created_at)}
        </p>
      </div>

      {notification.post?.media_urls && notification.post.media_urls.length > 0 && (
        <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
          <img
            src={notification.post.media_urls[0]}
            alt="Post"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
      )}
    </div>
  );
};
