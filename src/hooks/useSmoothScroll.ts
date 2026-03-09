import { useEffect, useRef } from 'react';
import { 
  enableSmoothScrolling, 
  enableMomentumScrolling, 
  createSmoothScrollContainer,
  addScrollMomentum,
  addSwipeGestures 
} from '@/utils/scrollBehavior';

export const useSmoothScroll = (enableSnap = false, enableSwipe = false) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Enable smooth scrolling globally
    enableSmoothScrolling();
    createSmoothScrollContainer();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Enable momentum scrolling
    enableMomentumScrolling(container);

    // Add scroll momentum for touch devices
    const cleanupMomentum = addScrollMomentum(container);

    // Add swipe gestures if enabled
    let cleanupSwipe: (() => void) | undefined;
    if (enableSwipe) {
      cleanupSwipe = addSwipeGestures(container);
    }

    return () => {
      cleanupMomentum?.();
      cleanupSwipe?.();
    };
  }, [enableSnap, enableSwipe]);

  return containerRef;
};

export const useScrollSnap = () => {
  useEffect(() => {
    // Add scroll snap styles
    const styles = `
      .scroll-snap-container {
        scroll-snap-type: y mandatory;
        overflow-y: auto;
        height: 100vh;
      }
      
      .scroll-snap-item {
        scroll-snap-align: start;
        scroll-snap-stop: always;
        min-height: 100vh;
      }
      
      /* Smooth transitions */
      .scroll-snap-item * {
        transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }
    `;

    if (typeof document !== 'undefined') {
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);

      return () => {
        document.head.removeChild(styleSheet);
      };
    }
  }, []);
};
