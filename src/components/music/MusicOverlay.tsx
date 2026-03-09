import { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export type MusicOverlayProps = {
  audioTitle?: string | null;
  audioArtist?: string | null;
  isPlaying: boolean;
  isSaved?: boolean;
  onTogglePlay: () => void;
  onToggleSave?: () => void;
  className?: string;
  iconClassName?: string;
  popoverSide?: 'top' | 'right' | 'bottom' | 'left';
};

export function MusicOverlay({
  audioTitle,
  audioArtist,
  isPlaying,
  isSaved,
  onTogglePlay,
  onToggleSave,
  className,
  iconClassName,
  popoverSide = 'top',
}: MusicOverlayProps) {
  const title = useMemo(() => audioTitle || 'Musiqa', [audioTitle]);
  const artist = useMemo(() => audioArtist || '', [audioArtist]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-9 w-9 rounded-2xl bg-black/40 hover:bg-black/55 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-lg',
            'transition-colors',
            className
          )}
          aria-label="Musiqa"
        >
          <Icon
            icon="lineicons:apple-music"
            className={cn('h-5 w-5 text-white', iconClassName)}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={popoverSide}
        align="end"
        sideOffset={10}
        className={cn(
          'w-[260px] p-0 overflow-hidden rounded-2xl border border-white/10 bg-black/55 text-white backdrop-blur-xl shadow-2xl'
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-3 flex items-center gap-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              'h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 text-white'
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePlay();
            }}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <p className="text-xs text-white/70 truncate">{artist}</p>
          </div>

          {onToggleSave && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(
                'h-10 w-10 rounded-full bg-white/10 hover:bg-white/15 text-white',
                isSaved && 'bg-white/20'
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave();
              }}
              aria-label={isSaved ? 'Saqlangan' : 'Saqlash'}
            >
              <Icon icon={isSaved ? 'material-symbols:bookmark' : 'material-symbols:bookmark-outline'} className="h-5 w-5" />
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
