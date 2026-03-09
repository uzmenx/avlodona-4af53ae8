import { useState, useCallback, useRef, useEffect } from 'react';

interface ZoomPanState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface UseZoomPanOptions {
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
}

export const useZoomPan = (options: UseZoomPanOptions = {}) => {
  const { minScale = 0.3, maxScale = 3, initialScale = 1 } = options;
  
  const [state, setState] = useState<ZoomPanState>({
    scale: initialScale,
    translateX: 0,
    translateY: 0,
  });

  const isPanning = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const lastTranslate = useRef({ x: 0, y: 0 });

  // Reset to center
  const resetZoom = useCallback(() => {
    setState({
      scale: initialScale,
      translateX: 0,
      translateY: 0,
    });
  }, [initialScale]);

  // Zoom in
  const zoomIn = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.min(prev.scale * 1.2, maxScale),
    }));
  }, [maxScale]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setState(prev => ({
      ...prev,
      scale: Math.max(prev.scale / 1.2, minScale),
    }));
  }, [minScale]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setState(prev => ({
      ...prev,
      scale: Math.min(Math.max(prev.scale * delta, minScale), maxScale),
    }));
  }, [minScale, maxScale]);

  // Handle pointer down (start panning)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isPanning.current = true;
    startPoint.current = { x: e.clientX, y: e.clientY };
    lastTranslate.current = { x: state.translateX, y: state.translateY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [state.translateX, state.translateY]);

  // Handle pointer move (panning)
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    
    const dx = e.clientX - startPoint.current.x;
    const dy = e.clientY - startPoint.current.y;
    
    setState(prev => ({
      ...prev,
      translateX: lastTranslate.current.x + dx,
      translateY: lastTranslate.current.y + dy,
    }));
  }, []);

  // Handle pointer up (stop panning)
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isPanning.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  // Touch pinch-to-zoom
  const lastTouchDistance = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.hypot(dx, dy);
    } else if (e.touches.length === 1) {
      isPanning.current = true;
      startPoint.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lastTranslate.current = { x: state.translateX, y: state.translateY };
    }
  }, [state.translateX, state.translateY]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const scale = distance / lastTouchDistance.current;
      
      setState(prev => ({
        ...prev,
        scale: Math.min(Math.max(prev.scale * scale, minScale), maxScale),
      }));
      
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && isPanning.current) {
      const dx = e.touches[0].clientX - startPoint.current.x;
      const dy = e.touches[0].clientY - startPoint.current.y;
      
      setState(prev => ({
        ...prev,
        translateX: lastTranslate.current.x + dx,
        translateY: lastTranslate.current.y + dy,
      }));
    }
  }, [minScale, maxScale]);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
    isPanning.current = false;
  }, []);

  return {
    scale: state.scale,
    translateX: state.translateX,
    translateY: state.translateY,
    isPanning: isPanning.current,
    resetZoom,
    zoomIn,
    zoomOut,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerUp,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    handleWheel,
  };
};
