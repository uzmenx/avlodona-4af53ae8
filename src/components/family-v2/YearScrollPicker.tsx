import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;
const PADDING = ITEM_HEIGHT * 2;
const DEFAULT_MIN_YEAR = 1850;

type YearScrollPickerProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  minYear?: number;
  maxYear?: number;
  defaultYear?: number;
  commitDefaultOnOpen?: boolean;
  allowClear?: boolean;
  withTick?: boolean;
  className?: string;
  triggerClassName?: string;
};

export const YearScrollPicker = ({
  value,
  onChange,
  placeholder,
  minYear = DEFAULT_MIN_YEAR,
  maxYear,
  defaultYear = 1990,
  commitDefaultOnOpen = false,
  allowClear = true,
  withTick = true,
  className,
  triggerClassName,
}: YearScrollPickerProps) => {
  const [open, setOpen] = useState(false);
  const years = useMemo(() => {
    const max = maxYear ?? new Date().getFullYear();
    const min = Math.min(minYear, max);
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }, [maxYear, minYear]);

  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const initTimerRef = useRef<number | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const isProgrammaticRef = useRef(false);
  const lastIndexRef = useRef<number | null>(null);
  const openedOnceRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const tickBufferRef = useRef<AudioBuffer | null>(null);

  const defaultIndex = useMemo(() => {
    const i = years.indexOf(defaultYear);
    return i >= 0 ? i : 0;
  }, [defaultYear, years]);

  const valueIndex = useMemo(() => {
    if (!value) return defaultIndex;
    const n = Number(value);
    const i = years.indexOf(n);
    return i >= 0 ? i : defaultIndex;
  }, [defaultIndex, value, years]);

  const [activeIndex, setActiveIndex] = useState(valueIndex);

  useEffect(() => {
    if (!open) setActiveIndex(valueIndex);
  }, [open, valueIndex]);

  const ensureTickBuffer = () => {
    if (!withTick) return;
    if (typeof window === 'undefined') return;
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (tickBufferRef.current) return;

    const ctx = audioCtxRef.current;
    const sampleRate = ctx.sampleRate;
    const frames = Math.floor(sampleRate * 0.012);
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      const env = Math.pow(1 - t, 3);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    tickBufferRef.current = buffer;
  };

  const playTick = () => {
    if (!withTick) return;
    try {
      ensureTickBuffer();
      const ctx = audioCtxRef.current;
      const buffer = tickBufferRef.current;
      if (!ctx || !buffer) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buffer;
      gain.gain.value = 0.05;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      return;
    }
  };

  useEffect(() => {
    if (!open) return;
    if (openedOnceRef.current) return;
    openedOnceRef.current = true;

    if (commitDefaultOnOpen && !value) {
      onChange(defaultYear.toString());
    }

    const idx = valueIndex;
    let cancelled = false;

    const run = (attempt = 0) => {
      if (cancelled) return;
      const el = containerRef.current;
      if (!el) {
        if (attempt < 12) window.setTimeout(() => run(attempt + 1), 16);
        return;
      }

      isProgrammaticRef.current = true;
      lastIndexRef.current = idx;
      setActiveIndex(idx);

      const top = idx * ITEM_HEIGHT;
      if (initTimerRef.current != null) window.clearTimeout(initTimerRef.current);
      if (unlockTimerRef.current != null) window.clearTimeout(unlockTimerRef.current);
      initTimerRef.current = window.setTimeout(() => {
        el.scrollTop = top;
        lastIndexRef.current = idx;
        setActiveIndex(idx);
        unlockTimerRef.current = window.setTimeout(() => {
          isProgrammaticRef.current = false;
        }, 120);
      }, 50);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [commitDefaultOnOpen, defaultYear, open, value, valueIndex]);

  useEffect(() => {
    if (open) return;
    openedOnceRef.current = false;
  }, [open]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (initTimerRef.current != null) window.clearTimeout(initTimerRef.current);
      if (unlockTimerRef.current != null) window.clearTimeout(unlockTimerRef.current);
      const ctx = audioCtxRef.current;
      if (ctx) ctx.close().catch(() => null);
      audioCtxRef.current = null;
    };
  }, []);

  const syncFromScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    if (isProgrammaticRef.current) return;
    const idx = Math.max(0, Math.min(years.length - 1, Math.round(el.scrollTop / ITEM_HEIGHT)));
    if (lastIndexRef.current === idx) return;
    lastIndexRef.current = idx;
    setActiveIndex(idx);
    const next = years[idx]?.toString() || '';
    if (next && next !== value) {
      onChange(next);
      playTick();
    }
  };

  const handleSelect = (year: number, idx: number) => {
    isProgrammaticRef.current = true;
    const el = containerRef.current;
    if (el) el.scrollTop = idx * ITEM_HEIGHT;
    setActiveIndex(idx);
    onChange(year.toString());
    playTick();
    window.setTimeout(() => {
      isProgrammaticRef.current = false;
    }, 100);
    window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none !important;
        }
        .scrollbar-none {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-10 w-full rounded-xl border border-white/10 bg-background/30 backdrop-blur-xl px-3 flex items-center justify-between text-left text-xs hover:bg-white/5 transition-colors focus:outline-none text-muted-foreground",
              triggerClassName
            )}
          >
            <span className={cn(value && "text-foreground font-medium")}>
              {value ? `${value}-yil` : placeholder}
            </span>
            <Calendar className="h-3.5 w-3.5 opacity-55" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="center"
          sideOffset={6}
          className="z-[9999] w-[var(--radix-popover-trigger-width)] p-0 bg-background/85 border-white/10 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
        >
          <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}>
            {/* Highlight box behind the scroll container to avoid blocking interactions */}
            <div
              className="pointer-events-none absolute left-2 right-2 z-0 rounded-xl border border-white/10 bg-white/[0.07]"
              style={{ top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT }}
            />

            <div
              ref={containerRef}
              onScroll={() => {
                if (isProgrammaticRef.current) return;
                if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
                rafRef.current = requestAnimationFrame(() => {
                  rafRef.current = null;
                  syncFromScroll();
                });
              }}
              onWheel={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              className="absolute inset-0 overflow-y-auto scrollbar-none overscroll-none snap-y snap-mandatory z-10"
              style={{
                paddingTop: PADDING,
                paddingBottom: PADDING,
                touchAction: 'pan-y',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 40%, black 60%, transparent 100%)',
              }}
            >
              {years.map((year, idx) => {
                const dist = Math.abs(idx - activeIndex);
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => handleSelect(year, idx)}
                    className={cn(
                      "w-full flex items-center justify-center snap-center select-none focus:outline-none transition-[transform,opacity,color] duration-100",
                      isActive
                        ? "h-10 text-[32px] font-black text-foreground scale-[1.15] opacity-100"
                        : dist === 1
                          ? "h-10 text-lg font-bold text-foreground/70 opacity-80"
                          : dist === 2
                            ? "h-10 text-sm font-semibold text-foreground/45 opacity-55"
                            : "h-10 text-xs font-semibold text-foreground/25 opacity-40"
                    )}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>

          {allowClear && value && (
            <div className="border-t border-white/5 p-1 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="text-[9px] text-red-400 hover:text-red-300 font-semibold py-1 px-2 w-full text-center"
              >
                Tozalash
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};
