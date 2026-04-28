import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReactionPicker } from '@/components/post/ReactionPicker';
import { ReactionSummary } from '@/components/post/ReactionSummary';
import { useReactions } from '@/hooks/useReactions';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageWithReactionsProps {
  messageId: string;
  isOwn: boolean;
  senderName?: string | null;
  senderAvatar?: string | null;
  showSender: boolean;
  time: string;
  isChannelAdminMessage?: boolean;
  commentsCount?: number;
  onCommentClick?: () => void;
  children: React.ReactNode; // the message bubble content
}

const MessageWithReactionsInner = ({
  messageId,
  isOwn,
  senderName,
  senderAvatar,
  showSender,
  time,
  isChannelAdminMessage,
  commentsCount = 0,
  onCommentClick,
  children,
}: MessageWithReactionsProps) => {
  const { reactions, toggleReaction } = useReactions({
    type: 'group_message',
    targetId: messageId,
  });

  const myReaction = reactions.find((r) => r.reactedByMe)?.emoji;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}>
      {/* Left avatar for incoming */}
      {!isOwn && showSender && (
        <Avatar className="h-6 w-6 mt-auto shrink-0">
          <AvatarImage src={senderAvatar ?? undefined} />
          <AvatarFallback className="text-[9px]">{getInitials(senderName)}</AvatarFallback>
        </Avatar>
      )}
      {!isOwn && !showSender && <div className="w-6 shrink-0" />}

      <div className={cn('flex flex-col max-w-[80%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Sender name */}
        {showSender && !isOwn && (
          <span className="text-[11px] font-semibold text-primary ml-1 mb-0.5">
            {senderName || 'Foydalanuvchi'}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 shadow-sm',
            isOwn
              ? 'bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white rounded-tr-md'
              : 'bg-muted/80 backdrop-blur-md rounded-tl-md'
          )}
        >
          {children}
          <p className={cn('text-[10px] mt-1', isOwn ? 'text-white/60' : 'text-muted-foreground')}>
            {time}
          </p>
        </div>

        {/* Reaction row: summary + picker */}
        <div
          className={cn(
            'flex items-center gap-1 mt-0.5',
            isOwn ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <AnimatePresence>
            {reactions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <ReactionSummary
                  reactions={reactions}
                  onReactionClick={(emoji) => void toggleReaction(emoji)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Emoji add button */}
          <ReactionPicker
            onSelect={(emoji) => void toggleReaction(emoji)}
            currentEmoji={myReaction}
            align={isOwn ? 'right' : 'left'}
            trigger={
              <motion.button
                type="button"
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'text-[14px] leading-none opacity-0 group-hover:opacity-100 transition-opacity',
                  'w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10',
                  reactions.length === 0 ? 'opacity-40 hover:opacity-100' : 'opacity-60 hover:opacity-100'
                )}
                aria-label="Reaksiya"
              >
                {myReaction ?? '☺'}
              </motion.button>
            }
          />
        </div>

        {/* Comment button for channel admin messages */}
        {isChannelAdminMessage && (
          <div className={cn('mt-1', isOwn ? 'self-end' : 'self-start')}>
            <button
              onClick={onCommentClick}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-all",
                isOwn
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted"
              )}
            >
              <MessageCircle className="h-3 w-3" />
              {commentsCount > 0 ? (
                <span>{commentsCount} izoh</span>
              ) : (
                <span>Izoh qoldirish</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const MessageWithReactions = memo(MessageWithReactionsInner);
