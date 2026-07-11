import { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { Reply } from 'lucide-react';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onReply: () => void;
  disabled?: boolean;
}

// Threshold where reply triggers
const REPLY_THRESHOLD = 65;
// Hard visual cap (rubber band slows down past REPLY_THRESHOLD, stops here)
const MAX_VISUAL_DRAG = 100;

// Rubber-band formula: past threshold, extra movement is divided by resistance
const RUBBER_RESISTANCE = 3.5;

function rubberBand(raw: number): number {
  if (raw >= 0) return 0;
  const abs = Math.abs(raw);
  if (abs <= REPLY_THRESHOLD) {
    // 1:1 movement before threshold
    return -abs;
  }
  // Diminishing returns past threshold: excess / RESISTANCE
  const excess = abs - REPLY_THRESHOLD;
  const damped = REPLY_THRESHOLD + excess / RUBBER_RESISTANCE;
  return -Math.min(damped, MAX_VISUAL_DRAG);
}

export function SwipeableMessage({ children, onReply, disabled }: SwipeableMessageProps) {
  const x = useMotionValue(0);
  const triggeredRef = useRef(false);
  const [isTriggered, setIsTriggered] = useState(false);

  // Icon animations derived from x motion value
  const iconOpacity = useTransform(x, [-REPLY_THRESHOLD, -REPLY_THRESHOLD * 0.4, 0], [1, 0.3, 0]);
  const iconScale  = useTransform(x, [-REPLY_THRESHOLD, -REPLY_THRESHOLD * 0.5, 0], [1, 0.6, 0.3]);
  const iconX      = useTransform(x, [-MAX_VISUAL_DRAG, 0], [8, 40]);

  const handleDrag = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const raw = info.offset.x;

    // Apply rubber-band visual position
    const visual = rubberBand(raw);
    x.set(visual);

    const crossedThreshold = raw <= -REPLY_THRESHOLD;

    if (crossedThreshold && !triggeredRef.current) {
      triggeredRef.current = true;
      setIsTriggered(true);
      // Haptic feedback
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } else if (!crossedThreshold && triggeredRef.current) {
      triggeredRef.current = false;
      setIsTriggered(false);
    }
  }, [x]);

  const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Use info.offset.x — reliable raw drag offset, not the visual x
    const raw = info.offset.x;

    if (raw <= -REPLY_THRESHOLD) {
      onReply();
    }

    // Spring snap back to origin
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 });
    setIsTriggered(false);
    triggeredRef.current = false;
  }, [x, onReply]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-visible select-none">
      {/* Reply icon — appears from the right as you swipe */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 backdrop-blur-sm pointer-events-none z-10"
        style={{
          opacity: iconOpacity,
          scale: iconScale,
          right: 0,
          x: iconX,
        }}
      >
        <motion.div
          animate={isTriggered ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.22, type: 'spring' }}
        >
          <Reply className="h-[15px] w-[15px] text-primary" />
        </motion.div>
      </motion.div>

      {/* Message content — draggable */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}   // visual constraint handled by rubberBand
        dragElastic={0}                              // we do our own elasticity
        dragMomentum={false}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="touch-pan-y cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}
