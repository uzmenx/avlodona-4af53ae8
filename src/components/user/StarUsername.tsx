import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StarUsernameProps {
  username: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

export const StarUsername = ({ username, className, iconClassName, textClassName }: StarUsernameProps) => {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className={cn('relative inline-flex h-4 w-4', iconClassName)} aria-hidden="true">
        <motion.span
          className="absolute inset-0"
          animate={{
            rotate: [0, 10, -8, 0],
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: 2.8,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-full w-full drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 1.8l2.72 6.87 7.38.54-5.64 4.66 1.76 7.12L12 17.9 5.78 21l1.76-7.12L1.9 9.21l7.38-.54L12 1.8z"
              fill="url(#goldGradient)"
            />
            <defs>
              <linearGradient id="goldGradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FDE68A" />
                <stop offset="0.35" stopColor="#F59E0B" />
                <stop offset="0.7" stopColor="#FBBF24" />
                <stop offset="1" stopColor="#FDE68A" />
              </linearGradient>
            </defs>
          </svg>
        </motion.span>

        <motion.span
          className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)',
            filter: 'blur(0.2px)',
          }}
          animate={{
            x: [0, 10, 0],
            y: [0, 10, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1.9,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: 0.25,
          }}
        />
      </span>

      <span className={cn('text-xs text-muted-foreground', textClassName)}>{username}</span>
    </span>
  );
};
