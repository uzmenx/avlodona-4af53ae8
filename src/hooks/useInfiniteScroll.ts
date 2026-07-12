import { useEffect, useRef } from 'react';

export const useInfiniteScroll = (
  loadMore: () => void,
  hasMore: boolean,
  isLoadingMore: boolean,
  threshold = 0.5
) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { threshold, rootMargin: '100px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoadingMore, threshold]);

  return sentinelRef;
};
