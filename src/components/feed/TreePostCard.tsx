import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Maximize2, Users, MessageCircle, Share2, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TreeFullscreenView } from '@/components/family-v2/TreeFullscreenView';
import { TreePostStaticPreview } from './TreePostStaticPreview';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { formatCount } from '@/lib/formatCount';
import { motion } from 'framer-motion';
import { StarUsername } from '@/components/user/StarUsername';

interface TreePostCardProps {
  post: {
    id: string;
    user_id: string;
    title: string | null;
    tree_data: Record<string, FamilyMember>;
    positions_data: Record<string, { x: number; y: number }>;
    overlays: TreeOverlay[];
    caption: string | null;
    created_at: string;
    likes_count?: number;
  };
  author?: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  index?: number;
}

export const TreePostCard = ({ post, author, index = 0 }: TreePostCardProps) => {
  const { user } = useAuth();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);

  const memberCount = Object.keys(post.tree_data || {}).length;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('tree_post_likes').select('id').eq('tree_post_id', post.id).eq('user_id', user.id).maybeSingle()
      .then(({ data }: any) => { if (data) setLiked(true); });
  }, [user?.id, post.id]);

  const handleLike = useCallback(async () => {
    if (!user?.id) return;
    if (liked) {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      await supabase.from('tree_post_likes').delete().eq('tree_post_id', post.id).eq('user_id', user.id);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await supabase.from('tree_post_likes').insert({ tree_post_id: post.id, user_id: user.id });
    }
  }, [liked, post.id, user?.id]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4) }}
        className="py-0 my-[5px]"
      >
        <Card className="overflow-hidden border-0 rounded-[20px] border border-border/20 bg-card/80 backdrop-blur-[10px] shadow-xl shadow-black/10">
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={author?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-primary/20">{(author?.name || 'U')[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{author?.name || 'Foydalanuvchi'}</p>
                  <StarUsername username={author?.username || 'user'} />
                </div>
              </div>
            </div>

            {/* Static tree preview — 3:4 aspect ratio */}
            <div className="relative cursor-pointer" onClick={() => setShowFullscreen(true)}>
              <TreePostStaticPreview
                members={post.tree_data || {}}
                positions={post.positions_data || {}}
                overlays={post.overlays}
                className="rounded-none"
              />
              
              {/* Title overlay */}
              {post.title && (
                <div className="absolute top-3 left-3 right-12">
                  <p className="text-sm font-bold text-white drop-shadow-lg">{post.title}</p>
                </div>
              )}

              {/* Fullscreen button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60"
                onClick={(e) => { e.stopPropagation(); setShowFullscreen(true); }}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>

              {/* Member count badge */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                <Users className="h-3 w-3 text-white" />
                <span className="text-xs font-medium text-white">{memberCount}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-4">
                <button onClick={handleLike} className="flex items-center gap-1.5">
                  <Heart className={`h-5 w-5 transition-colors ${liked ? 'fill-destructive text-destructive' : 'text-foreground'}`} />
                  <span className="text-sm font-medium">{formatCount(likesCount)}</span>
                </button>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-sm">0</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Eye className="h-5 w-5" />
                  <span className="text-sm">{memberCount}</span>
                </div>
              </div>

              {post.caption && (
                <p className="text-sm text-foreground">
                  <span className="font-semibold mr-1">{author?.username || 'user'}</span>
                  {post.caption}
                </p>
              )}

              <p className="text-xs text-muted-foreground uppercase">{timeAgo}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <TreeFullscreenView
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        members={post.tree_data}
        positions={post.positions_data}
        overlays={post.overlays}
        caption={post.caption}
      />
    </>
  );
};
