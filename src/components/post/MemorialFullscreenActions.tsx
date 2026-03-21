import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Send, Bookmark, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemorialPostSocial } from '@/hooks/useMemorialPostSocial';
import { MemorialCommentsSheet } from './MemorialCommentsSheet';
import { formatCount } from '@/lib/formatCount';

interface MemorialFullscreenActionsProps {
  memorialPostId: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
  initialViewsCount?: number;
}

export const MemorialFullscreenActions = ({
  memorialPostId,
  initialLikesCount = 0,
  initialCommentsCount = 0,
  initialViewsCount = 0,
}: MemorialFullscreenActionsProps) => {
  const { isLiked, likesCount, commentsCount, isSaved, toggleLike, toggleSave, trackView, handleShare } = useMemorialPostSocial(memorialPostId);
  const [showComments, setShowComments] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    trackView();
  }, [memorialPostId, trackView]);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsAnimating(true);
    await toggleLike();
    setTimeout(() => setIsAnimating(false), 300);
  };

  const ActionButton = ({
    icon: Icon,
    count,
    onClick,
    isActive = false,
    activeClass = "",
    animate = false
  }: { icon: React.ElementType; count?: number; onClick: (e: React.MouseEvent) => void; isActive?: boolean; activeClass?: string; animate?: boolean; }) =>
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-transform hover:scale-110">
      <div className={cn("p-2 rounded-full bg-black/20 backdrop-blur-sm",
        isActive && "bg-black/40"
      )}>
        <Icon
          className={cn(
            "h-6 w-6 text-white transition-all",
            isActive && activeClass,
            animate && "scale-125"
          )} />
      </div>
      {count !== undefined &&
        <span className="text-xs text-white font-medium">
          {formatCount(count)}
        </span>
      }
    </button>;

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        {/* Share */}
        <ActionButton
          icon={Send}
          onClick={(e) => { e.stopPropagation(); handleShare(); }} />

        {/* Like */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleLikeClick}
            className="flex flex-col items-center transition-transform hover:scale-110">
            <div className={cn(
              "p-2 rounded-full bg-black/20 backdrop-blur-sm",
              isLiked && "bg-black/40"
            )}>
              <motion.div
                animate={{ scale: isAnimating ? [1, 1.35, 1.15] : 1 }}
                transition={{ duration: 0.4, times: [0, 0.4, 1] }}
              >
                <Heart
                  className={cn(
                    "h-6 w-6 text-white transition-colors duration-200",
                    isLiked && "fill-rose-500 text-rose-500"
                  )}
                />
              </motion.div>
            </div>
          </button>
          <span className="text-xs text-white font-medium">{formatCount(likesCount || initialLikesCount)}</span>
        </div>

        {/* Comments */}
        <ActionButton
          icon={MessageCircle}
          count={commentsCount || initialCommentsCount}
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }} />

        {/* View count */}
        <div className="flex flex-col items-center gap-1">
          <div className="p-2 rounded-full bg-black/20 backdrop-blur-sm">
            <Eye className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{formatCount(initialViewsCount)}</span>
        </div>

        {/* Bookmark */}
        <ActionButton
          icon={Bookmark}
          onClick={(e) => { e.stopPropagation(); toggleSave(); }}
          isActive={isSaved}
          activeClass="fill-primary text-primary" />
      </div>

      <MemorialCommentsSheet
        open={showComments}
        onOpenChange={setShowComments}
        memorialPostId={memorialPostId}
      />
    </>);
};
