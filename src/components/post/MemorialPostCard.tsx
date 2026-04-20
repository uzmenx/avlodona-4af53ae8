import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Bookmark, Eye, MessageSquare, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCount } from '@/lib/formatCount';
import { cn } from '@/lib/utils';
import { useMemorialPostSocial } from '@/hooks/useMemorialPostSocial';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { MemorialCommentsSheet } from './MemorialCommentsSheet';
import type { MemorialPost } from '@/hooks/useMemorialPosts';

interface MemorialPostCardProps {
  post: MemorialPost;
  onMediaClick?: () => void;
}

export const MemorialPostCard = ({ post, onMediaClick }: MemorialPostCardProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const { isLiked, likesCount, commentsCount, isSaved, toggleLike, toggleSave, trackView, handleShare } = useMemorialPostSocial(post.id);
  const { stage, setRef, setPreviewReady, isVisible } = useProgressiveLoading();
  
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [shouldShowMore, setShouldShowMore] = useState(false);

  const isVideo =
    post.media_type === 'video' ||
    (post.media_url &&
      (post.media_url.includes('.mp4') ||
        post.media_url.includes('.mov') ||
        post.media_url.includes('.webm')));

  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';

  // Track view when card becomes visible
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void trackView();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [trackView]);

  // Check if caption needs "See more"
  useEffect(() => {
    if (captionRef.current) {
      const isOverflowing = captionRef.current.scrollHeight > captionRef.current.clientHeight || post.caption?.length > 100;
      setShouldShowMore(isOverflowing);
    }
  }, [post.caption]);

  return (
    <div
      ref={(el) => {
        cardRef.current = el;
        setRef(el);
      }}
      className="py-0 my-[4px] animate-fadeIn"
    >
      <Card className="overflow-hidden rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">
        <CardContent className="p-0">
          {/* Minimalist Header removed as requested */}

          {/* Media */}
          {post.media_url && (
            <div
              className={cn('relative mt-0', onMediaClick ? 'cursor-pointer' : '')}
              onClick={onMediaClick}
            >
              {stage === 'meta' && <div className="absolute inset-0 shimmer" />}

              {isVideo ? (
                <video
                  ref={videoRef}
                  src={post.media_url}
                  className={cn(
                    "w-full max-h-[480px] object-cover transition-[filter,opacity] duration-300",
                    stage === 'meta' || stage === 'preview' ? 'blur-8' : 'blur-0',
                    stage === 'full' ? 'fade-in' : ''
                  )}
                  muted
                  playsInline
                  loop
                  preload={stage === 'full' ? 'auto' : 'metadata'}
                  autoPlay={stage === 'full' && isVisible}
                  onLoadedData={() => {
                    setPreviewReady();
                  }}
                />
              ) : (
                <img
                  src={post.media_url}
                  alt=""
                  className={cn(
                    "w-full max-h-[480px] object-cover transition-[filter,opacity] duration-300",
                    stage === 'meta' || stage === 'preview' ? 'blur-8' : 'blur-0',
                    stage === 'full' ? 'fade-in' : ''
                  )}
                  loading="lazy"
                  onLoad={() => {
                    setPreviewReady();
                  }}
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-3 pt-2 pb-2 space-y-1.5">
            {/* Action Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Like */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(); }}
                  className="flex items-center gap-1.5 transition-transform active:scale-90"
                >
                  <Heart
                    className={cn(
                      'h-5 w-5 transition-colors duration-200',
                      isLiked
                        ? 'fill-rose-500 text-rose-500'
                        : 'text-foreground'
                    )}
                  />
                  <span className="text-sm font-medium">{formatCount(likesCount)}</span>
                </button>

                {/* Comments */}
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(true); }}
                  className="flex items-center gap-1.5 transition-transform active:scale-90"
                >
                  <MessageSquare className="h-5 w-5 text-foreground" />
                  <span className="text-sm font-medium">{formatCount(commentsCount)}</span>
                </button>

                {/* Share */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleShare(); }}
                  className="transition-transform active:scale-90"
                >
                  <Send className="h-5 w-5 text-foreground" />
                </button>

                {/* Views */}
                <div className="flex items-center gap-1.5 text-muted-foreground/60">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">{formatCount(post.views_count ?? 0)}</span>
                </div>
              </div>

              {/* Save */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSave(); }}
                className="transition-transform active:scale-90"
              >
                <Bookmark
                  className={cn(
                    'h-5 w-5 transition-colors duration-200',
                    isSaved
                      ? 'fill-primary text-primary'
                      : 'text-foreground'
                  )}
                />
              </button>
            </div>

            {/* Time & Caption */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-tighter">{timeAgo}</p>
              {post.caption && (
                <div className="relative">
                  <p 
                    ref={captionRef}
                    className={cn(
                      "text-sm text-foreground leading-snug transition-all duration-300",
                      !isCaptionExpanded && "line-clamp-2"
                    )}
                  >
                    <span 
                      className="font-semibold mr-1 cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (post.author?.id) navigate(`/user/${post.author.id}`);
                      }}
                    >
                      {post.author?.username || post.author?.name || 'user'}
                    </span>
                    {post.caption}
                  </p>
                  {shouldShowMore && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsCaptionExpanded(!isCaptionExpanded); }}
                      className="text-primary text-xs font-medium mt-0.5 flex items-center gap-0.5"
                    >
                      {isCaptionExpanded ? (
                        <>Kamroq <ChevronUp className="h-3 w-3" /></>
                      ) : (
                        <>Yana ko'proq <ChevronDown className="h-3 w-3" /></>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <MemorialCommentsSheet
        open={isCommentsOpen}
        onOpenChange={setIsCommentsOpen}
        memorialPostId={post.id}
      />
    </div>
  );
};
