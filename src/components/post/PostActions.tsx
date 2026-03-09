import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, Film, Eye } from 'lucide-react';
import { usePostLikes } from '@/hooks/usePostLikes';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { usePostViews } from '@/hooks/usePostViews';
import { LikersDialog } from './LikersDialog';
import { ViewersDialog } from './ViewersDialog';
import { CommentsSheet } from './CommentsSheet';
import { ShareDialog } from './ShareDialog';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatCount';

interface PostActionsProps {
  postId: string;
  initialLikesCount?: number;
  initialCommentsCount?: number;
  initialViewsCount?: number;
  viewsCount?: number;
  videoUrl?: string;
  onOpenVideoPlayer?: (url: string) => void;
}

export const PostActions = ({
  postId,
  initialLikesCount = 0,
  initialCommentsCount = 0,
  initialViewsCount = 0,
  viewsCount: viewsCountProp,
  videoUrl,
  onOpenVideoPlayer
}: PostActionsProps) => {
  const { isLiked, likesCount, likedUsers, toggleLike, fetchLikedUsers, isLoading } = usePostLikes(postId);
  const { viewsCount: viewsFromHook, viewedUsers, fetchViewedUsers } = usePostViews(postId, initialViewsCount);
  const viewsCount = viewsCountProp ?? viewsFromHook;
  const { isPostSaved, toggleSavePost } = useSavedPosts();
  const [showLikers, setShowLikers] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsSaved(isPostSaved(postId));
  }, [isPostSaved, postId]);

  const handleSaveClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;

    setIsSaving(true);
    const result = await toggleSavePost(postId);
    setIsSaved(result);
    setIsSaving(false);
  };

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

  const handleCommentsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowComments(true);
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowShare(true);
  };

  const handleViewsCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // We need likers list too, to show a small heart badge in viewers dialog
    fetchLikedUsers();
    fetchViewedUsers();
    setShowViewers(true);
  };

  const displayLikesCount = likesCount || initialLikesCount;

  return (
    <>
      {/* Glass morphism action bar */}
      <div className="flex items-center justify-between px-4 rounded-2xl bg-white/10 backdrop-blur-[10px] border border-white/20 shadow-lg hover:bg-white/15 transition-all duration-300 py-[4px]">


        
        {/* Left side: Like, Comment, Share */}
        <div className="flex items-center gap-6">
          {/* Like with count */}
          <div className="flex items-center gap-2">
            <motion.button
              className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
              onClick={handleLikeClick}
              disabled={isLoading}
              whileTap={{ scale: 0.9 }}>

              <motion.div
                animate={{
                  scale: isAnimating ? [1, 1.35, 1.15] : 1
                }}
                transition={{ duration: 0.4, times: [0, 0.4, 1] }}>

                <Heart
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    isLiked && "fill-red-500 text-red-500"
                  )} />

              </motion.div>
            </motion.button>

            <button
              className="text-sm font-bold text-white/90 hover:text-white hover:underline transition-colors"
              onClick={handleLikesCountClick}
              type="button">

              {formatCount(displayLikesCount)}
            </button>
          </div>
          
          {/* Comment with count */}
          <button
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
            onClick={handleCommentsClick}>

            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-bold">{formatCount(initialCommentsCount)}</span>
          </button>
          
          {/* Share */}
          <button
            className="text-white/90 hover:text-white transition-colors"
            onClick={handleShareClick}>
            <Share2 className="h-5 w-5" />
          </button>

          {/* View count */}
          <button
            type="button"
            className="flex items-center gap-2 text-white/90 text-sm font-bold hover:text-white hover:underline transition-colors"
            onClick={handleViewsCountClick}>

            <Eye className="h-5 w-5" />
            {formatCount(viewsCount)}
          </button>
        </div>
        
        {/* Right side: Bookmark */}
        <div className="flex items-center gap-3">
          {videoUrl && onOpenVideoPlayer &&
          <button
            className="text-white/80 hover:text-white transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onOpenVideoPlayer(videoUrl);
            }}>
              <Film className="h-5 w-5" />
            </button>
          }
          
          <button
            className="text-white/80 hover:text-white transition-colors"
            onClick={handleSaveClick}
            disabled={isSaving}>
            <Bookmark className={cn(
              "h-5 w-5 transition-all",
              isSaved && "fill-primary text-primary"
            )} />
          </button>
        </div>
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
        postId={postId ?? undefined} />

    </>);
};