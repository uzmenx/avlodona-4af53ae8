import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, Send, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { uploadMedia } from '@/lib/r2Upload';
import { toast } from 'sonner';

import { formatDistanceToNow } from 'date-fns';
import { useMemorialComments, MemorialComment } from '@/hooks/useMemorialComments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MemorialCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memorialPostId: string;
}

export const MemorialCommentsSheet = ({ open, onOpenChange, memorialPostId }: MemorialCommentsSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { comments, commentsCount, isLoading, fetchComments, addComment, deleteComment, toggleCommentLike } = useMemorialComments(memorialPostId);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{id: string;name: string;} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File; preview: string } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage.preview);
      }
    };
  }, [selectedImage]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: open } }));
    return () => {
      window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: false } }));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchComments();
  }, [open, fetchComments]);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setIsInputFocused(false);
      setNewComment('');
      setReplyTo(null);
    }
  };

  const handleSubmit = async () => {
    if ((!newComment.trim() && !selectedImage) || isSubmitting) return;

    setIsSubmitting(true);
    let finalContent = newComment;
    if (selectedImage && user?.id) {
      try {
        const imageUrl = await uploadMedia(selectedImage.file, 'comments', user.id);
        if (imageUrl) {
          finalContent = `[IMAGE]:${imageUrl}${newComment.trim() ? `||${newComment.trim()}` : ''}`;
        } else {
          toast.error("Rasmni yuklash imkoni bo'lmadi");
          setIsSubmitting(false);
          return;
        }
      } catch (err: any) {
        console.error("Failed to upload image to R2:", err);
        toast.error(err?.message || "Rasmni yuklashda xatolik yuz berdi");
        setIsSubmitting(false);
        return;
      }
    }
    await addComment(finalContent, replyTo?.id);
    setNewComment('');
    setSelectedImage(null);
    setReplyTo(null);
    setIsSubmitting(false);
    setIsInputFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputButtonClick = () => {
    setIsInputFocused(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const CommentItem = ({ comment, isReply = false }: {comment: MemorialComment;isReply?: boolean;}) => {
    const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: false });

    return (
      <div id={`comment-${comment.id}`} className={cn("flex gap-3 p-2 transition-colors", isReply && "ml-10")}>
        <Avatar 
          className="h-8 w-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (comment.user_id) {
              onOpenChange(false);
              navigate(`/user/${comment.user_id}`);
            }
          }}
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
                  onClick={() => {
                    if (comment.user_id) {
                      onOpenChange(false);
                      navigate(`/user/${comment.user_id}`);
                    }
                  }}
                >
                  {comment.author?.name || 'Foydalanuvchi'}
                </span>
                {' • '}
                <span className="text-muted-foreground text-xs">{timeAgo}</span>
              </p>
              {comment.content.startsWith('[IMAGE]:') ? (
                <div className="space-y-1.5 mt-1.5">
                  <div className="rounded-xl overflow-hidden max-w-[240px] border relative bg-muted">
                    <img
                      src={comment.content.split('||')[0].substring(8)}
                      alt="Rasm izoh"
                      className="w-full h-auto object-cover max-h-[280px]"
                      loading="lazy"
                    />
                  </div>
                  {comment.content.includes('||') && (
                    <p className="text-sm select-text">{comment.content.split('||')[1]}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm mt-0.5 select-text">{comment.content}</p>
              )}
              
              <div className="flex items-center gap-4 mt-1.5">
                <button
                  onClick={() => setReplyTo({ id: comment.id, name: comment.author?.name || 'Foydalanuvchi' })}
                  className="text-xs text-muted-foreground hover:text-foreground">
                  Javob berish
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => toggleCommentLike(comment.id)}
                className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors">
                <Heart className={cn("h-4 w-4", comment.isLiked && "fill-destructive text-destructive")} />
                {comment.likes_count > 0 &&
                <span className="text-xs">{comment.likes_count}</span>
                }
              </button>
              
              {user?.id === comment.user_id &&
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              }
            </div>
          </div>
        </div>
      </div>);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-3 opacity-50" />
        
        <DrawerHeader className="flex-shrink-0 px-6 pb-3 pt-0">
          <DrawerTitle className="flex items-center gap-2 text-center justify-center">
            Xotira izohlari
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
              {commentsCount}
            </span>
          </DrawerTitle>
        </DrawerHeader>
        
        <ScrollArea className="flex-1 px-6">
          {isLoading ?
          <div className="text-center py-8 text-muted-foreground">
              Yuklanmoqda...
            </div> :
          comments.length === 0 ?
          <div className="text-center py-8 text-muted-foreground">
              Hozircha izohlar yo'q. Birinchi bo'lib izoh qoldiring!
            </div> :
          <div className="space-y-4 py-4">
              {comments.map((comment) =>
            <div key={comment.id}>
                  <CommentItem comment={comment} />
                  {comment.replies && comment.replies.length > 0 &&
              <div className="mt-3 space-y-3">
                      {comment.replies.map((reply) =>
                <CommentItem key={reply.id} comment={reply} isReply />
                )}
                    </div>
              }
                </div>
            )}
            </div>
          }
        </ScrollArea>
        
        <div className="flex-shrink-0 border-t pt-4 px-6 pb-6 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          {replyTo &&
          <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg mb-2 text-sm">
              <span>
                <span className="text-muted-foreground">Javob: </span>
                <span className="font-medium">{replyTo.name}</span>
              </span>
              <button
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          }
          
          {user ? (
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (selectedImage) {
                      URL.revokeObjectURL(selectedImage.preview);
                    }
                    setSelectedImage({
                      file,
                      preview: URL.createObjectURL(file)
                    });
                    setIsInputFocused(true);
                  }
                  e.target.value = '';
                }}
                disabled={isSubmitting}
              />

              {/* Selected Image Preview */}
              {selectedImage && (
                <div className="relative inline-block mb-1 ml-2 self-start">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-muted">
                    <img src={selectedImage.preview} alt="Yuklanayotgan rasm" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedImage) {
                          URL.revokeObjectURL(selectedImage.preview);
                          setSelectedImage(null);
                        }
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {!isInputFocused && !selectedImage ? (
                  <button
                    onClick={handleInputButtonClick}
                    className="flex-1 text-left px-4 py-3 bg-muted/50 rounded-full text-muted-foreground text-sm"
                  >
                    Izoh yozing...
                  </button>
                ) : (
                  <div className="flex-1 min-w-0 relative flex items-center bg-muted/50 rounded-2xl border border-white/10 px-3">
                    <textarea
                      ref={inputRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={handleKeyPress}
                      onBlur={() => {
                        if (!newComment.trim() && !selectedImage) {
                          setTimeout(() => setIsInputFocused(false), 100);
                        }
                      }}
                      placeholder="Izoh yozing..."
                      className="flex-1 resize-none bg-transparent py-3 text-sm focus:outline-none min-h-[44px] max-h-[120px] pr-8 min-w-0"
                      rows={1}
                      disabled={isSubmitting}
                    />
                    
                    {/* Attachment Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSubmitting}
                      className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      <ImageIcon className="h-4.5 w-4.5" />
                    </button>
                  </div>
                )}
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={(!newComment.trim() && !selectedImage) || isSubmitting}
                  className="rounded-full h-10 w-10 flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>) :
          <p className="text-center text-sm text-muted-foreground py-2">
              Izoh qoldirish uchun tizimga kiring
            </p>
          }
        </div>
      </DrawerContent>
    </Drawer>);
};
