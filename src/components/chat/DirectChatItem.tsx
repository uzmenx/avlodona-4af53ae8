import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@iconify/react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import { StarUsername } from '@/components/user/StarUsername';
import { cn } from '@/lib/utils';
import { getStoryRingGradient } from '@/components/stories/storyRings';

interface DirectChatItemProps {
  item: any;
  isEditMode: boolean;
  isSelected: boolean;
  storyInfo: any;
  currentUserId: string | undefined;
  onClick: () => void;
  onToggleSelect: () => void;
  onStoryClick: (userId: string) => void;
}

export const DirectChatItem = memo(({
  item,
  isEditMode,
  isSelected,
  storyInfo,
  currentUserId,
  onClick,
  onToggleSelect,
  onStoryClick
}: DirectChatItemProps) => {
  const { t } = useLanguage();

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div
      onClick={() => {
        if (isEditMode) {
          onToggleSelect();
        } else {
          onClick();
        }
      }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 relative overflow-hidden',
        isEditMode ? 'translate-x-0' : '',
        isSelected ? 'bg-primary/5' : 'hover:bg-white/5 active:bg-white/10'
      )}
    >
      {isEditMode && (
        <div className="flex-shrink-0 flex items-center justify-center w-6 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
          <div className={cn(
            "h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
            isSelected
              ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20"
              : "border-muted-foreground/30 bg-transparent"
          )}>
            {isSelected && <Icon icon="lucide:check" className="h-3 w-3 text-primary-foreground" />}
          </div>
        </div>
      )}

      <div className="relative">
        {storyInfo ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStoryClick(item.otherUser.id);
            }}
            className="h-12 w-12 rounded-full p-[2px] flex items-center justify-center"
            style={{
              background: storyInfo.has_unviewed ? getStoryRingGradient(storyInfo.ring_id) : undefined
            }}
            aria-label="View story"
          >
            {!storyInfo.has_unviewed && <div className="absolute inset-0 rounded-full bg-muted-foreground/30 p-[2px]" />}
            <div className="w-full h-full rounded-full bg-background p-[1.5px]">
              <Avatar className="h-full w-full">
                <AvatarImage src={item.otherUser.avatar_url || undefined} loading="lazy" decoding="async" />
                <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
              </Avatar>
            </div>
          </button>
        ) : (
          <Avatar className="h-12 w-12">
            <AvatarImage src={item.otherUser.avatar_url || undefined} loading="lazy" decoding="async" />
            <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <StarUsername username={item.otherUser.username || item.otherUser.name || 'Foydalanuvchi'} />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {item.last_message_at ? formatTime(item.last_message_at) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={cn(
            "text-sm truncate leading-snug",
            item.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {item.lastMessage?.sender_id === currentUserId ? `${t('you')}: ` : ""}
            {item.lastMessage?.content || t('noMessagesYet')}
          </p>
          {item.unreadCount > 0 && (
            <div className="bg-primary text-primary-foreground min-w-[20px] h-5 rounded-full px-1.5 flex items-center justify-center text-[10px] font-bold shadow-sm shadow-primary/20 shrink-0">
              {item.unreadCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.isSelected === next.isSelected &&
    prev.isEditMode === next.isEditMode &&
    prev.item.id === next.item.id &&
    prev.item.unreadCount === next.item.unreadCount &&
    prev.item.last_message_at === next.item.last_message_at &&
    prev.storyInfo?.has_unviewed === next.storyInfo?.has_unviewed
  );
});

DirectChatItem.displayName = 'DirectChatItem';
