import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Send, Trash2, X } from 'lucide-react';
import { Icon } from '@iconify/react';
import { formatDistanceToNow } from 'date-fns';
import { useComments, Comment } from '@/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import GiphyPicker, { type GiphyItem } from '@/components/create/GiphyPicker';

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

// ─── Memoized Comment Item ─────────────────────────────────────────────────
interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  currentUserId?: string;
  onReply: (id: string, name: string) => void;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (userId: string) => void;
}

const CommentItem = memo(({ comment, isReply = false, currentUserId, onReply, onLike, onDelete, onNavigate }: CommentItemProps) => {
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false });

  return (
    <div id={`comment-${comment.id}`} className={cn("flex gap-3 p-2 transition-colors", isReply && "ml-10")}>
      <Avatar
        className="h-8 w-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => comment.user_id && onNavigate(comment.user_id)}
      >
        <AvatarImage src={comment.author?.avatar_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {comment.author?.name?.charAt(0) || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm">
              <span
                className="font-semibold cursor-pointer hover:underline"
                onClick={() => comment.user_id && onNavigate(comment.user_id)}
              >
                {comment.author?.name || 'Foydalanuvchi'}
              </span>
              {' • '}
              <span className="text-muted-foreground text-xs">{timeAgo}</span>
            </p>

            {comment.content.startsWith('[GIF]:') ? (
              <div className="mt-1.5 rounded-xl overflow-hidden max-w-[200px] border relative bg-muted">
                <img
                  src={comment.content.substring(6)}
                  alt="GIF izoh"
                  className="w-full h-auto object-cover max-h-[250px]"
                  loading="lazy"
                />
              </div>
            ) : (
              <p className="text-sm mt-0.5">{comment.content}</p>
            )}

            <div className="flex items-center gap-4 mt-1.5">
              <button
                onClick={() => onReply(comment.id, comment.author?.name || 'Foydalanuvchi')}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Javob berish
              </button>
              {comment.isLiked && <span className="text-xs text-primary">Sizga yoqdi</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onLike(comment.id)}
              className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Heart className={cn("h-4 w-4", comment.isLiked && "fill-destructive text-destructive")} />
              {comment.likes_count > 0 && <span className="text-xs">{comment.likes_count}</span>}
            </button>

            {currentUserId === comment.user_id && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
CommentItem.displayName = 'CommentItem';

// ─── Memoized Comments List ────────────────────────────────────────────────
interface CommentsListProps {
  comments: Comment[];
  currentUserId?: string;
  onReply: (id: string, name: string) => void;
  onLike: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (userId: string) => void;
}

const CommentsList = memo(({ comments, currentUserId, onReply, onLike, onDelete, onNavigate }: CommentsListProps) => (
  <div className="space-y-4 py-4">
    {comments.map((comment) => (
      <div key={comment.id}>
        <CommentItem
          comment={comment}
          currentUserId={currentUserId}
          onReply={onReply}
          onLike={onLike}
          onDelete={onDelete}
          onNavigate={onNavigate}
        />
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isReply
                currentUserId={currentUserId}
                onReply={onReply}
                onLike={onLike}
                onDelete={onDelete}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
));
CommentsList.displayName = 'CommentsList';

// ─── Isolated Comment Input (local state — zero parent re-renders on typing) ─
interface CommentInputProps {
  replyTo: { id: string; name: string } | null;
  isSubmitting: boolean;
  onClearReply: () => void;
  onSubmit: (text: string) => void;
  onOpenGIF: () => void;
}

const CommentInput = memo(({ replyTo, isSubmitting, onClearReply, onSubmit, onOpenGIF }: CommentInputProps) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When reply target is set, focus input
  useEffect(() => {
    if (replyTo) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [replyTo]);

  const handleSubmit = () => {
    if (!text.trim() || isSubmitting) return;
    onSubmit(text.trim());
    setText('');
    inputRef.current?.blur();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-shrink-0 border-t bg-background/95 backdrop-blur-xl pt-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
      {replyTo && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/10 px-3 py-1.5 rounded-full mb-3 text-xs animate-in slide-in-from-bottom-2 duration-300">
          <span className="truncate">
            <span className="text-muted-foreground">Javob berilmoqda: </span>
            <span className="font-semibold text-primary">{replyTo.name}</span>
          </span>
          <button
            onClick={onClearReply}
            className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-primary/10 text-primary transition-colors"
            aria-label="Javobni bekor qilish"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2.5">
        <div className="flex-1 relative bg-muted/30 hover:bg-muted/50 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 rounded-[22px] border border-border/40 transition-all duration-200">
          <div className="flex items-center pr-1 min-h-[44px]">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Izoh yozing..."
              className="flex-1 px-4 py-2.5 text-[15px] bg-transparent outline-none resize-none min-h-[40px] max-h-[140px] leading-snug placeholder:text-muted-foreground/60"
              rows={1}
              disabled={isSubmitting}
              style={{ overflowY: (text.split('\n').length > 4) ? 'auto' : 'hidden' }}
            />
            <button
              type="button"
              onClick={onOpenGIF}
              disabled={isSubmitting}
              className="h-10 w-10 flex items-center justify-center rounded-xl text-violet-500 hover:bg-violet-500/10 transition-all active:scale-95 flex-shrink-0 group"
            >
              <Icon icon="mage:gif-fill" className="h-9 w-9 transition-transform group-hover:scale-110" />
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!text.trim() || isSubmitting}
          className={cn(
            "h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm active:scale-90 flex-shrink-0",
            text.trim() ? "bg-primary text-primary-foreground shadow-primary/25" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
          )}
        >
          <Send className={cn("h-5 w-5 transition-transform", text.trim() && "translate-x-0.5 -translate-y-0.5")} />
        </button>
      </div>
    </div>
  );
});
CommentInput.displayName = 'CommentInput';

// ─── Main CommentsSheet ────────────────────────────────────────────────────
export const CommentsSheet = ({ open, onOpenChange, postId }: CommentsSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { comments, commentsCount, isLoading, fetchComments, addComment, deleteComment, toggleCommentLike } = useComments(postId);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGIFPicker, setShowGIFPicker] = useState(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: open } }));
    return () => {
      window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: false } }));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    fetchComments();
  }, [open, user?.id, fetchComments]);

  useEffect(() => {
    if (open && comments.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const targetCommentId = searchParams.get('commentId');
      if (targetCommentId) {
        setTimeout(() => {
          const element = document.getElementById(`comment-${targetCommentId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-primary/10', 'rounded-lg');
            setTimeout(() => element.classList.remove('bg-primary/10'), 2500);
          }
        }, 300);
      }
    }
  }, [open, comments]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      fetchComments();
    } else {
      setReplyTo(null);
    }
  };

  // Stable callbacks to avoid CommentsList re-renders
  const handleReply = useCallback((id: string, name: string) => setReplyTo({ id, name }), []);
  const handleLike = useCallback((id: string) => toggleCommentLike(id), [toggleCommentLike]);
  const handleDelete = useCallback((id: string) => deleteComment(id), [deleteComment]);
  const handleNavigate = useCallback((userId: string) => {
    onOpenChange(false);
    navigate(`/user/${userId}`);
  }, [navigate, onOpenChange]);
  const handleClearReply = useCallback(() => setReplyTo(null), []);

  const handleSubmit = useCallback(async (text: string) => {
    setIsSubmitting(true);
    await addComment(text, replyTo?.id);
    setReplyTo(null);
    setIsSubmitting(false);
  }, [addComment, replyTo?.id]);

  const handleGIFSelect = useCallback(async (gif: GiphyItem) => {
    const url = gif.originalUrl || gif.previewUrl;
    if (!isSubmitting && url) {
      setIsSubmitting(true);
      await addComment(`[GIF]:${url}`, replyTo?.id);
      setIsSubmitting(false);
      setShowGIFPicker(false);
      setReplyTo(null);
    }
  }, [addComment, isSubmitting, replyTo?.id]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col screen-comments">
        {/* Drag handle */}
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-3 opacity-50 shadow-2xs" />

        <DrawerHeader className="flex-shrink-0 px-6 pb-3 pt-0">
          <DrawerTitle className="flex items-center gap-2 text-center justify-center">
            Izohlar
            <span className="comments-bg-soft comments-accent text-xs font-semibold px-2 py-0.5 rounded-full">
              {commentsCount}
            </span>
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Yuklanmoqda...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Hozircha izohlar yo'q. Birinchi bo'lib izoh qoldiring!
            </div>
          ) : (
            <CommentsList
              comments={comments}
              currentUserId={user?.id}
              onReply={handleReply}
              onLike={handleLike}
              onDelete={handleDelete}
              onNavigate={handleNavigate}
            />
          )}
        </ScrollArea>

        {user ? (
          <CommentInput
            replyTo={replyTo}
            isSubmitting={isSubmitting}
            onClearReply={handleClearReply}
            onSubmit={handleSubmit}
            onOpenGIF={() => setShowGIFPicker(true)}
          />
        ) : (
          <div className="flex-shrink-0 border-t px-4 py-3">
            <p className="text-center text-sm text-muted-foreground font-medium">
              Izoh qoldirish uchun tizimga kiring
            </p>
          </div>
        )}

        {/* GIF Picker Overlay */}
        {showGIFPicker && (
          <div className="absolute inset-0 z-[100] bg-background rounded-t-xl overflow-hidden flex flex-col">
            <GiphyPicker
              onSelect={handleGIFSelect}
              onClose={() => setShowGIFPicker(false)}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
};