import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, Minimize2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FamilyTreeCanvas } from '@/components/family-v2/FamilyTreeCanvas';
import { TreeOverlayLayer } from '@/components/family-v2/TreeOverlayLayer';
import { TreePostStaticPreview } from './TreePostStaticPreview';
import { TreePostMenu } from './TreePostMenu';
import { TreePostEditor } from '@/components/family-v2/TreePostEditor';
import { useTreePosts, TreeOverlay } from '@/hooks/useTreePosts';
import { FamilyMember } from '@/types/family';
import { formatCount } from '@/lib/formatCount';
import { motion, AnimatePresence } from 'framer-motion';
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

const NOOP_FN = () => {};

export const TreePostCard = ({ post, author, index = 0 }: TreePostCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { updateTreePost, deletePost } = useTreePosts();
  const [expanded, setExpanded] = useState(false);
  const [previewInteractive, setPreviewInteractive] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const memberCount = Object.keys(post.tree_data || {}).length;
  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  const initialViewport = useMemo(() => {
    if (post.positions_data['__viewport'] as any) {
      return post.positions_data['__viewport'] as any as { x: number; y: number; zoom: number };
    }
    return undefined;
  }, [post.positions_data]);

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.4) }}
      className="py-0 my-[5px]"
    >
      <Card className="overflow-hidden rounded-[20px] border border-border/20 bg-card/80 backdrop-blur-[10px] shadow-xl shadow-black/10">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => post.user_id && navigate(`/user/${post.user_id}`)}
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={author?.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/20">{(author?.name || 'U')[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold text-foreground">{author?.name || 'Foydalanuvchi'}</p>
                <StarUsername username={author?.username || 'user'} />
              </div>
            </div>
            <TreePostMenu
              postId={post.id}
              authorId={post.user_id}
              onDelete={() => setDeleted(true)}
              onEdit={() => setIsEditing(true)}
            />
          </div>

          {/* Tree content — static or interactive */}
          <div
            className="relative cursor-pointer"
            onClick={() => {
              if (!expanded && !previewInteractive) {
                setPreviewInteractive(true);
                return;
              }
              if (!expanded) {
                setExpanded(true);
              }
            }}
          >
            <AnimatePresence mode="wait">
              {expanded ? (
                <motion.div
                  key="expanded"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative w-full overflow-hidden bg-card/50"
                  style={{ height: '280px', maxHeight: '280px' }}
                >
                  {/* Interactive tree canvas with zoom/pan */}
                  <div className="absolute inset-0">
                    <FamilyTreeCanvas
                      members={post.tree_data || {}}
                      positions={post.positions_data || {}}
                      onOpenProfile={NOOP_FN}
                      onPositionChange={NOOP_FN}
                      readOnly={true}
                      initialViewport={initialViewport}
                    />
                  </div>

                  {/* Overlays */}
                  {post.overlays && post.overlays.length > 0 && (
                    <TreeOverlayLayer overlays={post.overlays} onChange={NOOP_FN} editable={false} />
                  )}

                  {/* Minimize button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 bg-black/40 backdrop-blur-sm rounded-full text-white hover:bg-black/60 z-30"
                    onClick={(e) => { e.stopPropagation(); setExpanded(false); setPreviewInteractive(false); }}
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <TreePostStaticPreview
                    members={post.tree_data || {}}
                    positions={post.positions_data || {}}
                    overlays={post.overlays}
                    className="rounded-none"
                    interactive={previewInteractive}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-4">
              <button onClick={handleLike} className="flex items-center gap-1.5">
                <Heart className={`h-5 w-5 transition-colors ${liked ? 'fill-destructive text-destructive' : 'text-foreground'}`} />
                <span className="text-sm font-medium">{formatCount(likesCount)}</span>
              </button>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-5 w-5" />
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

      {/* Tahrirlash oynasi */}
      <TreePostEditor
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        members={post.tree_data || {}}
        positions={post.positions_data || {}}
        initialOverlays={post.overlays || []}
        initialCaption={(post as any).caption || ''}
        isPublishing={isUpdating}
        onPublish={async (overlays, caption) => {
          setIsUpdating(true);
          await updateTreePost(post.id, overlays, caption);
          setIsUpdating(false);
          setIsEditing(false);
        }}
      />
    </motion.div>
  );
};

