import { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { useGroupMessageComments } from '@/hooks/useGroupMessageComments';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GroupMessageCommentsSheetProps {
  messageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GroupMessageCommentsSheet = ({
  messageId,
  open,
  onOpenChange,
}: GroupMessageCommentsSheetProps) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { comments, isLoading, addComment, deleteComment } = useGroupMessageComments(
    open ? messageId : null
  );

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const success = await addComment(newComment);
    if (success) {
      setNewComment('');
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0 rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/50">
        <SheetHeader className="px-6 py-4 border-b border-border/10">
          <SheetTitle className="text-center font-bold text-lg flex items-center justify-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Izohlar
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full px-4" ref={scrollRef}>
            <div className="py-6 space-y-5">
              {isLoading && comments.length === 0 ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-primary/60" />
                  </div>
                  <p className="text-muted-foreground font-medium">Hozircha izohlar yo'q</p>
                  <p className="text-xs text-muted-foreground mt-1">Birinchi bo'lib izoh yozing!</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex gap-3 group"
                    >
                      <Avatar className="h-9 w-9 border border-white/10 shrink-0">
                        <AvatarImage src={comment.user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {comment.user.name?.[0] || comment.user.username?.[0] || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2 mb-1">
                          <span className="font-semibold text-[13px] text-foreground/90 truncate">
                            {comment.user.name || comment.user.username || 'Foydalanuvchi'}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: uz })}
                          </span>
                        </div>
                        
                        <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-2.5 inline-block max-w-[95%]">
                          <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>

                      {user?.id === comment.user.id && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pl-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                            onClick={() => deleteComment(comment.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t border-border/10 bg-background/80 backdrop-blur-lg">
          <div className="flex items-end gap-2 relative">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Izoh yozing..."
              className="min-h-[44px] max-h-[120px] resize-none rounded-2xl bg-muted/50 border-white/10 focus-visible:ring-primary/30 text-sm pr-12 py-3"
              disabled={isSubmitting}
            />
            <Button
              size="icon"
              className={cn(
                "absolute right-2 bottom-2 h-8 w-8 rounded-full transition-all duration-300",
                newComment.trim() ? "bg-primary text-white scale-100" : "bg-muted text-muted-foreground scale-90"
              )}
              disabled={!newComment.trim() || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 ml-0.5" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
