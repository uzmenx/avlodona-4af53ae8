import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { 
  Copy, 
  Reply, 
  Forward, 
  Trash2, 
  TrashIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useReactions } from '@/hooks/useReactions';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const DEFAULT_EMOJIS = ['❤️', '🔥', '👍', '😂', '😮', '😢', '🙏'];

interface MessageContextMenuProps {
  children: React.ReactNode;
  messageContent: string;
  messageId: string;
  isMine: boolean;
  isPrivateChat?: boolean;
  showReactions?: boolean;
  reactionType?: 'group_message' | 'message'; // which table to use
  onReply?: (messageId: string, content: string) => void;
  onForward?: (messageId: string, content: string) => void;
  onDeleteForMe?: (messageId: string) => void;
  onDeleteForAll?: (messageId: string) => void;
}

export const MessageContextMenu = ({
  children,
  messageContent,
  messageId,
  isMine,
  isPrivateChat = false,
  showReactions = false,
  reactionType = 'group_message',
  onReply,
  onForward,
  onDeleteForMe,
  onDeleteForAll,
}: MessageContextMenuProps) => {
  const { reactions, toggleReaction } = useReactions({
    type: reactionType,
    targetId: showReactions ? messageId : null,
  });

  const myReaction = reactions.find((r) => r.reactedByMe)?.emoji;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast.success('Xabar nusxalandi');
    } catch (error) {
      toast.error('Nusxalashda xatolik');
    }
  };

  const handleReply = () => {
    onReply?.(messageId, messageContent);
  };

  const handleForward = () => {
    onForward?.(messageId, messageContent);
  };

  const handleDeleteForMe = () => {
    onDeleteForMe?.(messageId);
  };

  const handleDeleteForAll = () => {
    if (confirm('Xabarni barcha uchun o\'chirishni xohlaysizmi?')) {
      onDeleteForAll?.(messageId);
    }
  };

  const handleReactionClick = (emoji: string) => {
    void toggleReaction(emoji);
    // Context menu closes automatically via Radix after item interaction
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[280px] p-0 overflow-hidden border-none shadow-2xl bg-black/60 backdrop-blur-xl rounded-2xl">
        {/* Reaction Row */}
        {showReactions && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
            {DEFAULT_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.35 }}
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => handleReactionClick(emoji)}
                className={cn(
                  'text-[22px] leading-none p-1 rounded-full transition-all duration-150',
                  myReaction === emoji
                    ? 'bg-white/20 ring-1 ring-white/30'
                    : 'hover:bg-white/10'
                )}
                aria-label={emoji}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        )}

        <div className="p-1">
          <ContextMenuItem onClick={handleCopy} className="gap-2 rounded-xl text-white hover:bg-white/15 focus:bg-white/15 focus:text-white cursor-pointer py-2.5">
            <Copy className="h-4 w-4" />
            <span>Nusxalash</span>
          </ContextMenuItem>
          
          {onReply && (
            <ContextMenuItem onClick={handleReply} className="gap-2 rounded-xl text-white hover:bg-white/15 focus:bg-white/15 focus:text-white cursor-pointer py-2.5">
              <Reply className="h-4 w-4" />
              <span>Javob yozish</span>
            </ContextMenuItem>
          )}

          {onForward && (
            <ContextMenuItem onClick={handleForward} className="gap-2 rounded-xl text-white hover:bg-white/15 focus:bg-white/15 focus:text-white cursor-pointer py-2.5">
              <Forward className="h-4 w-4" />
              <span>Yo'naltirish</span>
            </ContextMenuItem>
          )}

          <ContextMenuSeparator className="bg-white/10 my-1" />

          {onDeleteForMe && (
            <ContextMenuItem 
              onClick={handleDeleteForMe} 
              className="gap-2 rounded-xl text-red-400 hover:bg-red-400/10 focus:bg-red-400/10 focus:text-red-400 cursor-pointer py-2.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>Men uchun o'chirish</span>
            </ContextMenuItem>
          )}

          {isPrivateChat && isMine && onDeleteForAll && (
            <ContextMenuItem 
              onClick={handleDeleteForAll} 
              className="gap-2 rounded-xl text-red-400 hover:bg-red-400/10 focus:bg-red-400/10 focus:text-red-400 cursor-pointer py-2.5"
            >
              <TrashIcon className="h-4 w-4" />
              <span>Barcha uchun o'chirish</span>
            </ContextMenuItem>
          )}
        </div>
      </ContextMenuContent>
    </ContextMenu>
  );
};

