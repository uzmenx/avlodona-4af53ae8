import React from 'react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  useWindowScroll?: boolean;
}

// Vaqtincha o'chirib qo'yilgan PullToRefresh komponenti
export const PullToRefresh = ({ onRefresh, children, useWindowScroll = false }: PullToRefreshProps) => {
  return (
    <div
      className={cn(
        "relative py-0",
        !useWindowScroll && "h-full overflow-y-auto smooth-scroll-momentum"
      )}
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'auto', overscrollBehaviorY: 'auto' }}
    >
      {children}
    </div>
  );
};
