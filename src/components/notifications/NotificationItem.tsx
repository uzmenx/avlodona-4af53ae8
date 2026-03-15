import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, UserPlus, Send, TreeDeciduous, Check, AtSign, Users, CalendarDays } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';
import { useFollow } from '@/hooks/useFollow';
import { Button } from '@/components/ui/button';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export const NotificationItem = ({ notification, onRead }: NotificationItemProps) => {
  const navigate = useNavigate();
  const { isFollowing, toggleFollow, isLoading: isFollowLoading } = useFollow(notification.actor_id);

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

  const handleClick = (e: React.MouseEvent) => {
    // Prevent container click if child with its own handler was clicked
    if ((e.target as HTMLElement).closest('.stop-propagation')) {
      return;
    }

    if (!notification.is_read) {
      onRead(notification.id);
    }

    switch (notification.type) {
      case 'follow':
        navigate(`/user/${notification.actor_id}`);
        break;
      case 'message':
        navigate(`/chat/${notification.actor_id}`);
        break;
      case 'story_like':
        if (notification.post_id) {
          navigate(`/user/${notification.actor_id}?view=stories&storyId=${notification.post_id}`);
        } else {
          navigate(`/user/${notification.actor_id}`);
        }
        break;
      case 'like':
      case 'comment':
      case 'mention':
        if (notification.post_id) {
          navigate(`/user/${notification.actor_id}?postId=${notification.post_id}${notification.comment_id ? `&commentId=${notification.comment_id}` : ''}`);
        } else {
          navigate(`/user/${notification.actor_id}`);
        }
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

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const renderMediaPreview = () => {
    const hasStoryMedia = notification.story?.media_url;
    const hasPostMedia = notification.post?.media_urls && notification.post.media_urls.length > 0;

    if (!hasStoryMedia && !hasPostMedia) return null;

    const mediaUrl = hasStoryMedia ? notification.story?.media_url : notification.post?.media_urls?.[0];
    const mediaType = hasStoryMedia ? notification.story?.media_type : 'image';
    const isVideo = hasStoryMedia 
      ? mediaType === 'video'
      : mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);

    if (!mediaUrl) return null;

    return (
      <div 
        onClick={handleMediaClick}
        className="h-12 w-12 rounded overflow-hidden flex-shrink-0 border border-border/50 stop-propagation hover:opacity-80 transition-opacity"
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
    <div
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 p-4 cursor-pointer transition-colors relative",
        notification.is_read 
          ? "bg-background hover:bg-muted/50" 
          : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary"
      )}
    >
      <div className="relative stop-propagation" onClick={handleProfileClick}>
        <Avatar className="h-12 w-12 border-2 border-border/50">
          <AvatarImage src={notification.actor?.avatar_url || undefined} />
          <AvatarFallback>{getInitials(notification.actor?.name || notification.actor?.username)}</AvatarFallback>
        </Avatar>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
          {getIcon()}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", !notification.is_read && "font-medium")}>
          <span 
            className="font-bold hover:underline stop-propagation" 
            onClick={handleProfileClick}
          >
            {notification.actor?.name || notification.actor?.username || 'Foydalanuvchi'}
          </span>{' '}
          <span className="text-muted-foreground">{getMessage()}</span>
        </p>
        
        {notification.comment?.content && (
          <p className="text-xs text-foreground bg-muted/40 p-2 rounded-lg mt-1 line-clamp-2 border border-border/30">
            "{notification.comment.content}"
          </p>
        )}
        
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatTime(notification.created_at)}
        </p>
      </div>

      {notification.type === 'follow' && (
        <div className="stop-propagation">
          <Button
            size="sm"
            variant={isFollowing ? "outline" : "default"}
            onClick={(e) => {
              e.stopPropagation();
              toggleFollow();
            }}
            disabled={isFollowLoading}
            className={cn(
              "h-8 px-3 text-xs rounded-full",
              !isFollowing && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isFollowing ? "Kuzatilmoqda" : "Javob qaytarish"}
          </Button>
        </div>
      )}

      {renderMediaPreview()}

      {!notification.is_read && (
        <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />
      )}
    </div>
  );
};
