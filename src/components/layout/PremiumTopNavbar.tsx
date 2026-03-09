import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Calendar, Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PremiumTopNavbarProps = {
  badgeCount: number;
  onMenu?: () => void;
  onTrophy?: () => void;
  onCalendar?: () => void;
  onShare?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchFocus?: () => void;
  className?: string;
};

export function PremiumTopNavbar({
  badgeCount,
  onMenu,
  onTrophy,
  onCalendar,
  onShare,
  searchValue,
  onSearchChange,
  onSearchFocus,
  className,
}: PremiumTopNavbarProps) {
  const shouldPulse = badgeCount > 0;

  const badgeText = useMemo(() => {
    if (!badgeCount) return '';
    if (badgeCount > 99) return '99+';
    return String(badgeCount);
  }, [badgeCount]);

  return (
    <div className={cn('sticky top-2 z-50 px-3', className)}>
      <div
        className={cn(
          'mx-auto w-[390px] max-w-full',
          'h-14 px-4 py-2.5',
          'flex items-center gap-2.5',
          'rounded-2xl',
          'backdrop-blur-md',
          'bg-white/70 dark:bg-slate-900/80',
          'border border-white/60 dark:border-white/10',
          'shadow-lg shadow-black/10 dark:shadow-black/30'
        )}
      >
        {/* 1) Menu */}
        <button
          type="button"
          onClick={onMenu}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'text-slate-600 dark:text-slate-200',
            'transition-all duration-150 active:scale-95'
          )}
          aria-label="Menu"
        >
          <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </button>

        {/* 2) Trophy */}
        <button
          type="button"
          onClick={onTrophy}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'bg-amber-50 dark:bg-amber-500/10',
            'shadow-[0_0_0_4px_rgba(251,191,36,0.18)] dark:shadow-[0_0_0_4px_rgba(251,191,36,0.10)]',
            'transition-all duration-150 active:scale-95'
          )}
          aria-label="Reyting"
        >
          <Icon icon="noto:trophy" className="h-[22px] w-[22px]" />
        </button>

        {/* 3) Calendar */}
        <button
          type="button"
          onClick={onCalendar}
          className={cn(
            'h-9 w-9 rounded-full flex items-center justify-center',
            'bg-indigo-50 dark:bg-indigo-500/10',
            'text-indigo-500 dark:text-indigo-300',
            'transition-all duration-150 active:scale-95'
          )}
          aria-label="Kalendar"
        >
          <Calendar className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </button>

        {/* 4) Search */}
        <div
          className={cn(
            'flex-1 max-w-[140px]',
            'h-9 rounded-full',
            'bg-slate-100/80 dark:bg-slate-800/70',
            'border border-slate-200 dark:border-slate-700/70',
            'px-3',
            'flex items-center gap-2',
            'focus-within:ring-2 focus-within:ring-indigo-300 dark:focus-within:ring-indigo-500/60',
            'transition-all duration-150'
          )}
        >
          <Search className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onFocus={onSearchFocus}
            placeholder="Qidirish..."
            className={cn(
              'w-full bg-transparent outline-none',
              'text-sm text-slate-700 dark:text-slate-100',
              'placeholder:text-slate-400'
            )}
          />
        </div>

        {/* 5) Badge */}
        <div className="relative">
          <motion.div
            className={cn(
              'min-w-[20px] h-5 px-1.5 rounded-full',
              'bg-red-500 text-white',
              'text-xs font-semibold',
              'flex items-center justify-center'
            )}
            animate={
              shouldPulse
                ? {
                    boxShadow: [
                      '0 0 0 0 rgba(239, 68, 68, 0.35)',
                      '0 0 0 6px rgba(239, 68, 68, 0)',
                    ],
                  }
                : undefined
            }
            transition={
              shouldPulse
                ? {
                    duration: 1.35,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'easeOut',
                  }
                : undefined
            }
          >
            {badgeText || '0'}
          </motion.div>
        </div>

        {/* 6) Share */}
        <motion.button
          type="button"
          onClick={onShare}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          className={cn(
            'w-9 h-9 rounded-full',
            'bg-gradient-to-br from-blue-500 to-indigo-600',
            'shadow-md shadow-blue-300/60 dark:shadow-blue-500/25',
            'flex items-center justify-center',
            'transition-all duration-150'
          )}
          aria-label="Ulashish"
        >
          <Icon icon="ci:share-ios-export" className="h-[18px] w-[18px] text-white" />
        </motion.button>
      </div>
    </div>
  );
}

export function PremiumTopNavbarPreview() {
  const [q, setQ] = useState('');

  return (
    <div className="min-h-screen w-full bg-[#DBEAFE] dark:bg-slate-950 px-3 py-6">
      <PremiumTopNavbar badgeCount={3} searchValue={q} onSearchChange={setQ} />
      <div className="mx-auto w-[390px] max-w-full mt-6 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 p-4 backdrop-blur">
        <div className="h-40 rounded-xl bg-white/50 dark:bg-slate-900/40" />
      </div>
    </div>
  );
}
