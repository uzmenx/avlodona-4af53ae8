// Instagram-like smooth scrolling utilities

export const enableSmoothScrolling = () => {
  // Enable smooth scrolling for the entire document
  if (typeof document !== 'undefined') {
    document.documentElement.style.scrollBehavior = 'smooth';
    document.body.style.scrollBehavior = 'smooth';
    
    // Enable momentum scrolling for touch devices
    (document.body.style as any).webkitOverflowScrolling = 'touch';
    
    // Prevent overscroll bounce on mobile
    document.body.style.overscrollBehavior = 'none';
  }
};

export const enableMomentumScrolling = (element: HTMLElement) => {
  if (!element) return;
  
  // Enable momentum scrolling for touch devices
  (element.style as any).webkitOverflowScrolling = 'touch';
  
  // Add smooth scroll behavior
  element.style.scrollBehavior = 'smooth';
  
  // Prevent rubber band effect
  element.style.overscrollBehavior = 'none';
};

export const createSmoothScrollContainer = () => {
  const styles = `
    .smooth-scroll-container {
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: none;
    }
    
    /* Custom scrollbar for webkit browsers */
    .smooth-scroll-container::-webkit-scrollbar {
      width: 0px;
      background: transparent;
    }
    
    /* Hide scrollbar for Firefox */
    .smooth-scroll-container {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
  `;
  
  if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }
};

export const addScrollMomentum = (element: HTMLElement) => {
  if (!element) return;
  
  // Use native smooth scrolling and moment scrolling on iOS instead of manual JS
  element.style.scrollBehavior = 'smooth';
  (element.style as any).webkitOverflowScrolling = 'touch';
  
  return () => {
    // cleanup not strictly needed for CSS styles
  };
};

export const addSwipeGestures = (element: HTMLElement, onSwipeLeft?: () => void, onSwipeRight?: () => void) => {
  if (!element) return;
  
  let startX = 0;
  let startY = 0;
  let distX = 0;
  let distY = 0;
  let startTime = 0;
  
  const handleTouchStart = (e: TouchEvent) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    distX = 0;
    distY = 0;
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    distX = e.touches[0].clientX - startX;
    distY = e.touches[0].clientY - startY;
  };
  
  const handleTouchEnd = () => {
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    // Check if it's a valid swipe (fast enough and far enough)
    if (elapsedTime < 550 && Math.abs(distX) > 45 && Math.abs(distY) < 260) {
      if (distX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (distX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }
    
    // Reset values
    distX = 0;
    distY = 0;
  };
  
  element.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: true, capture: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true, capture: true });
  
  return () => {
    element.removeEventListener('touchstart', handleTouchStart, true);
    element.removeEventListener('touchmove', handleTouchMove, true);
    element.removeEventListener('touchend', handleTouchEnd, true);
    element.removeEventListener('touchcancel', handleTouchEnd, true);
  };
};
