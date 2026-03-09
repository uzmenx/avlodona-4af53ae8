import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getStoryRingGradient } from '@/components/stories/storyRings';

interface UserAvatarProps {
  userId: string;
  avatarUrl?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  clickable?: boolean;
  className?: string;
  hasStory?: boolean;
  storyRingId?: string;
  hasUnviewedStory?: boolean;
  onStoryClick?: () => void;
}

export const UserAvatar = ({ 
  userId, 
  avatarUrl, 
  name, 
  size = 'md',
  clickable = true,
  className,
  hasStory = false,
  storyRingId = 'default',
  hasUnviewedStory,
  onStoryClick,
}: UserAvatarProps) => {
  const navigate = useNavigate();
  // Default: if hasStory is true and hasUnviewedStory not specified, show colorful ring
  const showUnviewed = hasUnviewedStory ?? hasStory;

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
    lg: 'h-10 w-10'
  };

  const outerSizeClasses = {
    sm: 'w-[34px] h-[34px]',
    md: 'w-[39px] h-[39px]',
    lg: 'w-[44px] h-[44px]'
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable) return;
    e.stopPropagation();
    if (hasStory && onStoryClick) {
      onStoryClick();
    } else {
      navigate(`/user/${userId}`);
    }
  };

  if (hasStory) {
    const ringGradient = getStoryRingGradient(storyRingId);
    return (
      <div
        className={cn('relative inline-block rounded-full cursor-pointer', outerSizeClasses[size])}
        onClick={handleClick}
        style={{
          background: showUnviewed ? ringGradient : undefined,
          padding: '2px',
        }}
      >
        {!showUnviewed && (
          <div className="absolute inset-0 rounded-full bg-muted-foreground/30" style={{ padding: '2px' }} />
        )}
        <div className="w-full h-full rounded-full bg-background p-[1.5px]">
          <Avatar className={cn(sizeClasses[size], 'w-full h-full', className)}>
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-white/20 backdrop-blur-[10px] border border-white/30 text-white text-sm">
              {name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    );
  }

  return (
    <Avatar 
      className={cn(
        sizeClasses[size],
        "ring-2 ring-primary/20",
        clickable && "cursor-pointer hover:ring-primary/40 transition-all",
        className
      )}
      onClick={handleClick}
    >
      <AvatarImage src={avatarUrl} />
      <AvatarFallback className="bg-white/20 backdrop-blur-[10px] border border-white/30 text-white text-sm">
        {name?.charAt(0)?.toUpperCase() || 'U'}
      </AvatarFallback>
    </Avatar>
  );
};
