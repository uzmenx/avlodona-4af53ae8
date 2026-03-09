import { useEffect, useRef } from 'react';

export const useAutoPreviewVideo = (
  videoRef: React.RefObject<HTMLVideoElement>,
  {
    enabled = true,
    delayMs = 3000,
    threshold = 0.6,
    rootMargin = '0px',
  }: {
    enabled?: boolean;
    delayMs?: number;
    threshold?: number;
    rootMargin?: string;
  } = {}
) => {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const el = videoRef.current;
    if (!el) return;

    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const ensureMutedInline = () => {
      el.muted = true;
      el.playsInline = true;
      el.loop = true;
    };

    ensureMutedInline();

    const stop = () => {
      clearTimer();
      try {
        el.pause();
      } catch {
        // ignore
      }
    };

    const start = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        ensureMutedInline();
        const p = el.play();
        if (p && typeof (p as any).catch === 'function') (p as any).catch(() => {});
      }, delayMs);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) start();
        else stop();
      },
      { threshold: [threshold], rootMargin }
    );

    observer.observe(el);

    return () => {
      stop();
      observer.disconnect();
    };
  }, [delayMs, enabled, rootMargin, threshold, videoRef]);
};
