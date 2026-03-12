import { useEffect, useRef } from 'react';
import { 
  addSwipeGestures 
} from '@/utils/scrollBehavior';

export const useSmoothScroll = (enableSnap = false, enableSwipe = false) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Add swipe gestures if enabled (for tab switching)
    let cleanupSwipe: (() => void) | undefined;
    if (enableSwipe) {
      cleanupSwipe = addSwipeGestures(container);
    }

    return () => {
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
