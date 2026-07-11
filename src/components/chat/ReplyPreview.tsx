import { X, Reply } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReplyPreviewProps {
  replyToContent: string;
  senderName?: string | null;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyToContent, senderName, onCancel }: ReplyPreviewProps) => {
  const truncated = replyToContent.length > 60
    ? replyToContent.substring(0, 60) + '…'
    : replyToContent;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3 bg-zinc-950/20 dark:bg-black/20">
          {/* Animated colored bar */}
          <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-[hsl(217,91%,65%)] to-[hsl(263,70%,55%)] shrink-0" />

          {/* Reply icon */}
          <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
            <Reply className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold bg-gradient-to-r from-[hsl(217,91%,65%)] to-[hsl(263,70%,55%)] bg-clip-text text-transparent leading-none">
              {senderName ? senderName + 'ga javob' : 'Javob'}
            </p>
            <p className="text-[12px] text-muted-foreground/80 truncate leading-none mt-1.5">
              {truncated}
            </p>
          </div>

          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.08)' }}
            whileTap={{ scale: 0.9 }}
            onClick={onCancel}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            aria-label="Javobni bekor qilish"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
