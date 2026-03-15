import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  useWindowScroll?: boolean;
}

export const PullToRefresh = ({ onRefresh, children, useWindowScroll = false }: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const canPull = useRef(false);

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('video, iframe, [data-no-pull-to-refresh="true"]')) {
      canPull.current = false;
      isPulling.current = false;
      return;
    }

    const isAtTop = useWindowScroll 
      ? window.scrollY <= 0 && el.scrollTop <= 0
      : el.scrollTop <= 0;

    if (isAtTop) {
      startY.current = e.touches[0].clientY;
      canPull.current = true;
      isPulling.current = false;
    } else {
      canPull.current = false;
      isPulling.current = false;
    }
  }, [useWindowScroll]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;

    const el = containerRef.current;
    if (!el) return;

    if (!canPull.current && !isPulling.current) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff <= 0) {
      canPull.current = false;
      isPulling.current = false;
      if (pullDistance !== 0) setPullDistance(0);
      return;
    }

    if (el.scrollTop > 0) return;
    if (useWindowScroll && window.scrollY > 0) return;

    if (!isPulling.current) {
      if (diff <= 10) return;
      isPulling.current = true;
    }

    e.preventDefault();
    const resistance = 0.4;
    const distance = Math.min(diff * resistance, maxPull);
    setPullDistance(distance);
  }, [isRefreshing, pullDistance, useWindowScroll]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPull.current && !isPulling.current) return;
    canPull.current = false;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(50);

      await onRefresh();
      setIsRefreshing(false);
    }

    setPullDistance(0);
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto smooth-scroll-momentum py-0"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}>

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