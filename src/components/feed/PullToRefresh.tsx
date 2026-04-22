import { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  useWindowScroll?: boolean;
}

export const PullToRefresh = ({ onRefresh, children, useWindowScroll = false }: PullToRefreshProps) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const canPull = useRef(false);

  const pullDistanceRef = useRef(0);
  const [pullDistance, _setPullDistance] = useState(0);

  const setPullDistance = (val: number) => {
    pullDistanceRef.current = val;
    _setPullDistance(val);
  };

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return;

    const el = containerRef.current;
    if (!el) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('video, iframe, [data-no-pull-to-refresh="true"], .no-pull')) {
      canPull.current = false;
      return;
    }

    const isAtTop = useWindowScroll 
      ? window.scrollY <= 1 // Allow small margin for mobile headers
      : el.scrollTop <= 0;

    if (isAtTop) {
      startY.current = e.touches[0].clientY;
      canPull.current = true;
      isPulling.current = false;
    } else {
      canPull.current = false;
    }
  }, [isRefreshing, useWindowScroll]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isRefreshing || !canPull.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    // If already pulling, we must handle it
    if (isPulling.current) {
      if (diff <= 0) {
        setPullDistance(0);
        isPulling.current = false;
        return;
      }
      e.preventDefault();
      const resistance = 0.4;
      const distance = Math.min(diff * resistance, maxPull);
      setPullDistance(distance);
      return;
    }

    // Start pulling only if diff > 0 and we haven't scrolled down
    if (diff > 10) {
      isPulling.current = true;
      e.preventDefault();
    } else if (diff < -10) {
      // User is scrolling down, definitely can't pull anymore in this gesture
      canPull.current = false;
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    const dist = pullDistanceRef.current;
    if (!canPull.current && !isPulling.current) {
      setPullDistance(0);
      return;
    }
    
    canPull.current = false;
    isPulling.current = false;

    if (dist >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => handleTouchStart(e);
    const onMove = (e: TouchEvent) => handleTouchMove(e);
    const onEnd = () => handleTouchEnd();

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative py-0",
        !useWindowScroll && "h-full overflow-y-auto smooth-scroll-momentum"
      )}
      style={{ WebkitOverflowScrolling: 'touch', touchAction: useWindowScroll ? 'auto' : 'pan-y' }}
    >

      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex justify-center items-center transition-all duration-200 z-50",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: 0,
          height: pullDistance > 0 ? pullDistance : isRefreshing ? 50 : 0,
          transform: `translateY(${pullDistance > 0 ? -10 : 0}px)`
        }}>

        <div className={cn(
          "flex items-center gap-2 text-muted-foreground",
          isRefreshing && "text-primary"
        )}>
          <RefreshCw
            className={cn(
              "h-5 w-5 transition-transform",
              isRefreshing && "animate-spin",
              pullDistance >= threshold && !isRefreshing && "text-primary"
            )}
            style={{
              transform: `rotate(${pullDistance / threshold * 180}deg)`
            }} />

          <span className="text-sm font-medium">
            {isRefreshing ?
            "Yangilanmoqda..." :
            pullDistance >= threshold ?
            "Qo'yib yuboring" :
            "Pastga torting"}
          </span>
        </div>
      </div>

      {/* Content with elastic transform */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
        }}>

        {children}
      </div>
    </div>);

};