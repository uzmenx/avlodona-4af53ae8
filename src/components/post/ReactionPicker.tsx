import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const DEFAULT_EMOJIS = ['❤️', '🔥', '👍', '😂', '😮', '😢', '🙏'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  currentEmoji?: string; // emoji the current user already picked, if any
  trigger: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export const ReactionPicker = ({ onSelect, currentEmoji, trigger, align = 'left' }: ReactionPickerProps) => {
  const [open, setOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handlePointerDown = () => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setOpen(true);
    }, 400);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (didLongPress.current) return;
    setOpen((v) => !v);
  };

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  const alignClass =
    align === 'right'
      ? 'right-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-0';

  return (
    <div className="relative inline-flex items-center">
      {/* Trigger wrapper */}
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        className="cursor-pointer select-none"
      >
        {trigger}
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className={cn(
                'absolute bottom-full mb-2 z-50 flex items-center gap-1 px-2.5 py-2',
                'rounded-[20px] border border-white/20 shadow-2xl shadow-black/40',
                'bg-black/60 backdrop-blur-xl',
                alignClass
              )}
              style={{ minWidth: 'max-content' }}
            >
              {DEFAULT_EMOJIS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.35 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(emoji);
                  }}
                  className={cn(
                    'text-[22px] leading-none p-1 rounded-full transition-all duration-150',
                    currentEmoji === emoji
                      ? 'bg-white/20 ring-2 ring-white/40'
                      : 'hover:bg-white/10'
                  )}
                  aria-label={emoji}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
