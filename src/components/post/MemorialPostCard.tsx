import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, Bookmark, Eye } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { FollowButton } from '@/components/user/FollowButton';
import { formatCount } from '@/lib/formatCount';
import { cn } from '@/lib/utils';
import { useMemorialPostSocial } from '@/hooks/useMemorialPostSocial';
import type { MemorialPost } from '@/hooks/useMemorialPosts';

interface MemorialPostCardProps {
  post: MemorialPost;
  onMediaClick?: () => void;
}

export const MemorialPostCard = ({ post, onMediaClick }: MemorialPostCardProps) => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { isLiked, likesCount, isSaved, toggleLike, toggleSave, trackView } = useMemorialPostSocial(post.id);

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

  const handleAuthorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.author?.id) {
      navigate(`/user/${post.author.id}`);
    }
  };

  return (
    <div ref={cardRef} className="py-0 my-[5px] animate-fadeIn">
      <Card className="overflow-hidden rounded-[20px] border border-white/20 bg-white/10 backdrop-blur-[10px] shadow-xl shadow-black/20">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3">
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleAuthorClick}
            >
              <Avatar className="h-9 w-9 ring-2 ring-white/20">
                <AvatarImage src={post.author?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/20 text-white font-bold">
                  {(post.author?.name || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {post.author?.name || 'Foydalanuvchi'}
                </p>
                {post.author?.username && (
                  <p className="text-xs text-muted-foreground">@{post.author.username}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {post.author?.id && (
                <FollowButton targetUserId={post.author.id} size="sm" />
              )}
            </div>
          </div>

          {/* Media */}
          {post.media_url && (
            <div
              className={cn('relative', onMediaClick ? 'cursor-pointer' : '')}
              onClick={onMediaClick}
            >
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={post.media_url}
                  className="w-full max-h-[480px] object-cover"
                  muted
                  playsInline
                  loop
                  preload="metadata"
                />
              ) : (
                <img
                  src={post.media_url}
                  alt=""
                  className="w-full max-h-[480px] object-cover"
                  loading="lazy"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-3 pt-2 pb-3 space-y-2">
            {/* Action Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Like */}
                <button
                  onClick={toggleLike}
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

                {/* Views */}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Eye className="h-5 w-5" />
                  <span className="text-sm">{formatCount(post.views_count ?? 0)}</span>
                </div>
              </div>

              {/* Save */}
              <button
                onClick={toggleSave}
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
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{timeAgo}</p>
            {post.caption && (
              <p className="text-sm text-foreground leading-relaxed">
                <span className="font-semibold mr-1">
                  {post.author?.username || post.author?.name || 'user'}
                </span>
                {post.caption}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
