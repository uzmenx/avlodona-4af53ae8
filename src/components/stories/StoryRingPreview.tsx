import { cn } from '@/lib/utils';
import { getStoryRingGradient, type StoryRingId } from './storyRings';

interface StoryRingPreviewProps {
  ringId: StoryRingId;
  avatarSrc: string;
  size?: 'sm' | 'md';
  selected?: boolean;
  onClick?: () => void;
  label?: string;
}

export function StoryRingPreview({
  ringId,
  avatarSrc,
  size = 'md',
  selected,
  onClick,
  label,
}: StoryRingPreviewProps) {
  const imgSize = size === 'sm' ? 'w-11 h-11' : 'w-13 h-13';
  const outerSize = size === 'sm' ? 'w-[52px] h-[52px]' : 'w-[60px] h-[60px]';
  const gap = size === 'sm' ? 'p-[2.5px]' : 'p-[3px]';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors tap-highlight-none',
        selected ? 'bg-secondary ring-2 ring-primary/30' : 'bg-background hover:bg-secondary/50',
      )}
    >
      {/* Outer ring – gradient border, glow animation only (no hue-rotate) */}
      <div
        className={cn('rounded-full flex items-center justify-center story-ring-animated', gap, outerSize)}
        style={{ background: getStoryRingGradient(ringId) }}
      >
        {/* White gap between ring and avatar */}
        <div className="rounded-full bg-background p-[2px] flex items-center justify-center w-full h-full">
          <img
            src={avatarSrc}
            alt=""
            className={cn('rounded-full object-cover block', imgSize)}
          />
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      )}
    </button>
  );
}
