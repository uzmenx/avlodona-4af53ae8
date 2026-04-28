import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactionSummaryItem } from '@/hooks/useReactions';

interface ReactionSummaryProps {
  reactions: ReactionSummaryItem[];
  onReactionClick: (emoji: string) => void;
  className?: string;
}

export const ReactionSummary = ({
  reactions,
  onReactionClick,
  className,
}: ReactionSummaryProps) => {
  if (!reactions || reactions.length === 0) return null;

  // Sort by count descending
  const sorted = [...reactions].sort((a, b) => b.count - a.count);

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {sorted.map((r) => (
        <motion.button
          key={r.emoji}
          type="button"
          layout
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          whileTap={{ scale: 0.88 }}
          onClick={(e) => {
            e.stopPropagation();
            onReactionClick(r.emoji);
          }}
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold border transition-all duration-200 select-none',
            r.reactedByMe
              ? 'bg-primary/20 border-primary/50 text-primary shadow-sm shadow-primary/20'
              : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/15'
          )}
        >
          <span className="text-[15px] leading-none">{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </motion.button>
      ))}
    </div>
  );
};
