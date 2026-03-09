import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Send, Bookmark, Film, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePostLikes } from '@/hooks/usePostLikes';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { usePostViews } from '@/hooks/usePostViews';
import { LikersDialog } from './LikersDialog';
import { ViewersDialog } from './ViewersDialog';
import { CommentsSheet } from './CommentsSheet';
import { ShareDialog } from './ShareDialog';
import { formatCount } from '@/lib/formatCount';

interface FullscreenActionsProps {
  postId: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
  initialViewsCount?: number;
  videoUrl?: string;
  onOpenVideoPlayer?: (url: string) => void;
}

export const FullscreenActions = ({
  postId,
  initialLikesCount = 0,
  initialCommentsCount = 0,
  initialViewsCount = 0,
  videoUrl,
  onOpenVideoPlayer
}: FullscreenActionsProps) => {
  const { isLiked, likesCount, likedUsers, toggleLike, fetchLikedUsers, isLoading } = usePostLikes(postId);
  const { viewsCount, trackView, viewedUsers, fetchViewedUsers } = usePostViews(postId, initialViewsCount);
  const { isPostSaved, toggleSavePost } = useSavedPosts();
  const [showLikers, setShowLikers] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    trackView();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- track view once when fullscreen opens for this post
  }, [postId]);

  useEffect(() => {
    setIsSaved(isPostSaved(postId));
  }, [isPostSaved, postId]);

  const displayLikesCount = likesCount || initialLikesCount;

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    setIsAnimating(true);
    await toggleLike();
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleLikesCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchLikedUsers();
    setShowLikers(true);
  };

  const handleViewsCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // We need likers list too, to show a small heart badge in viewers dialog
    fetchLikedUsers();
    fetchViewedUsers();
    setShowViewers(true);
  };

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShare(true);
  };

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const result = await toggleSavePost(postId);
    setIsSaved(result);
    setIsSaving(false);
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

      <div className={cn("p-2 rounded-full bg-black/20 backdrop-blur-sm my-0 px-[8.1px] mx-[0.1px]",

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
          onClick={handleShareClick} />

        {/* Like */}
        <button
          onClick={handleLikeClick}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110">

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
                  isLiked && "fill-destructive text-destructive"
                )}
              />
            </motion.div>
          </div>
          <button
            onClick={handleLikesCountClick}
            className="text-xs text-white font-medium hover:underline">

            {formatCount(displayLikesCount)}
          </button>
        </button>

        {/* Comments */}
        <ActionButton
          icon={MessageCircle}
          count={initialCommentsCount}
          onClick={handleCommentsClick} />

        {/* View count */}
        <button
          type="button"
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110"
          onClick={handleViewsCountClick}
        >
          <div className="p-2 rounded-full bg-black/20 backdrop-blur-sm">
            <Eye className="h-6 w-6 text-white" />
          </div>
          <span className="text-xs text-white font-medium hover:underline">{formatCount(viewsCount)}</span>
        </button>

        {/* Bookmark */}
        <ActionButton
          icon={Bookmark}
          onClick={handleSaveClick}
          isActive={isSaved}
          activeClass="fill-white" />

        {/* Video Player - only for videos */}
        {videoUrl && onOpenVideoPlayer &&
          <ActionButton
            icon={Film}
            onClick={(e) => {
              e.stopPropagation();
              onOpenVideoPlayer(videoUrl);
            }} />

        }
      </div>

      {/* Dialogs */}
      <LikersDialog
        open={showLikers}
        onOpenChange={setShowLikers}
        users={likedUsers}
        likesCount={displayLikesCount} />

      <ViewersDialog
        open={showViewers}
        onOpenChange={setShowViewers}
        users={viewedUsers}
        viewsCount={viewsCount}
        likedUserIds={likedUsers.map((u) => u.id)} />

      <CommentsSheet
        open={showComments}
        onOpenChange={setShowComments}
        postId={postId} />

      
      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        postId={postId} />

    </>);
};