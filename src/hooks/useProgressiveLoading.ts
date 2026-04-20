import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

export type ProgressiveStage = 'skeleton' | 'meta' | 'preview' | 'full';

interface ProgressiveLoadingOptions {
  stageDelayMs?: number;
  rootMargin?: string;
}

export const useProgressiveLoading = (options?: ProgressiveLoadingOptions) => {
  const stageDelayMs = options?.stageDelayMs ?? 50;
  const rootMargin = options?.rootMargin ?? '200px';

  const [stage, setStage] = useState<ProgressiveStage>('skeleton');
  const [isVisible, setIsVisible] = useState(false);

  const ref = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    // Disconnect old observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    ref.current = el;

    if (el) {
      const obs = new IntersectionObserver(
        (entries) => {
          const e = entries[0];
          const nextVisible = !!e?.isIntersecting;
          setIsVisible(nextVisible);
          if (nextVisible) {
            setStage((prev) => (prev === 'preview' ? 'full' : prev));
          }
        },
        { root: null, rootMargin, threshold: 0.01 }
      );
      obs.observe(el);
      observerRef.current = obs;
    }
  }, [rootMargin]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setStage((prev) => (prev === 'skeleton' ? 'meta' : prev));
    }, stageDelayMs);
    return () => {
      window.clearTimeout(t);
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [stageDelayMs]);

  const setMetaReady = useCallback(() => {
    setStage((prev) => (prev === 'skeleton' ? 'meta' : prev));
  }, []);

  const setPreviewReady = useCallback(() => {
    setStage((prev) => {
      if (prev === 'full') return prev;
      return 'preview';
    });
  }, []);

  useEffect(() => {
    if (isVisible && (stage === 'preview' || stage === 'meta')) {
      setStage('full');
    }
  }, [isVisible, stage]);

  return {
    stage,
    isVisible,
    setRef,
    setMetaReady,
    setPreviewReady,
  };
};
