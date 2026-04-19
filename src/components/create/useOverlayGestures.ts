import { useState, useRef, useEffect, useCallback } from 'react';

interface OverlayItem {
  id: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface UseOverlayGesturesProps<T extends OverlayItem> {
  item: T;
  onUpdate: (item: T) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  snapAngles?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useOverlayGestures<T extends OverlayItem>({
  item,
  onUpdate,
  containerRef,
  snapAngles = true,
  onDragStart,
  onDragEnd,
}: UseOverlayGesturesProps<T>) {
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs to keep track of latest item without triggering effect recreation on every frame
  const itemRef = useRef(item);
  useEffect(() => {
    itemRef.current = item;
  }, [item]);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const onDragStartRef = useRef(onDragStart);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  
  const onDragEndRef = useRef(onDragEnd);
  useEffect(() => { onDragEndRef.current = onDragEnd; }, [onDragEnd]);

  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, itemX: 0, itemY: 0 });
  const pinchRef = useRef<{ 
    dist: number; 
    angle: number; 
    scale: number; 
    rotation: number;
    midX: number;
    midY: number;
    itemX: number;
    itemY: number;
  } | null>(null);
  
  const activeTouchIdRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  
  const isInteracting = isDragging || activeTouchIdRef.current !== null;

  useEffect(() => {
    if (isInteracting) {
      if (onDragStartRef.current) onDragStartRef.current();
    } else {
      if (onDragEndRef.current) onDragEndRef.current();
    }
  }, [isInteracting]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { pointerX: e.clientX, pointerY: e.clientY, itemX: itemRef.current.x, itemY: itemRef.current.y };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch (e) {
      // ignore
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Ignore updates if we are actively pinching
    if (pinchRef.current) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    
    onUpdateRef.current({
      ...itemRef.current,
      x: Math.max(-20, Math.min(120, dragStartRef.current.itemX + (dx / rect.width) * 100)),
      y: Math.max(-20, Math.min(120, dragStartRef.current.itemY + (dy / rect.height) * 100)),
    });
  }, [isDragging, containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (e) {
      // ignore
    }
  }, []);

  // Multitouch setup & Native Wheel for passive: false
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // --- Wheel Scaling ---
    const handleNativeWheel = (e: WheelEvent) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      
      const zoomSensitivity = 0.003;
      const it = itemRef.current;
      let newScale = it.scale - (e.deltaY * zoomSensitivity);
      newScale = Math.max(0.15, Math.min(8, newScale));
      
      if (newScale !== it.scale) {
        onUpdateRef.current({ ...it, scale: newScale });
      }
    };

    // --- Multitouch ---
    const findTouch = (touches: TouchList, id: number) => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === id) return touches[i];
      }
      return null;
    };

    const pickSecondTouch = (touches: TouchList, firstId: number) => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier !== firstId) return touches[i];
      }
      return null;
    };

    const snapAngle = (angle: number) => {
      if (!snapAngles) return angle;
      const snapPoints = [0, 90, -90, 180, -180, 270, -270, 360, -360];
      const threshold = 6; 
      
      let closest = angle;
      for (const target of snapPoints) {
        if (Math.abs(angle - target) <= threshold) {
          closest = target;
          break;
        }
      }
      return closest;
    };

    const onGlobalTouchMove = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;
      if (e.touches.length < 2) return;

      const t1 = findTouch(e.touches, firstId);
      const t2 = pickSecondTouch(e.touches, firstId);
      if (!t1 || !t2) return;

      e.stopPropagation();
      if (e.cancelable) e.preventDefault();

      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const it = itemRef.current;

      if (!pinchRef.current) {
        pinchRef.current = { 
          dist, 
          angle, 
          scale: it.scale, 
          rotation: it.rotation,
          midX,
          midY,
          itemX: it.x,
          itemY: it.y
        };
        return;
      }

      const p = pinchRef.current;
      const distRatio = dist / p.dist;
      const angleDiff = angle - p.angle;

      let newScale = p.scale * distRatio;
      newScale = Math.max(0.15, Math.min(8, newScale));

      let newRotation = p.rotation + angleDiff;
      newRotation = snapAngle(newRotation);

      let newX = it.x;
      let newY = it.y;
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const dx = midX - p.midX;
        const dy = midY - p.midY;
        newX = p.itemX + (dx / rect.width) * 100;
        newY = p.itemY + (dy / rect.height) * 100;
        newX = Math.max(-20, Math.min(120, newX));
        newY = Math.max(-20, Math.min(120, newY));
      }

      onUpdateRef.current({
        ...it,
        scale: newScale,
        rotation: newRotation,
        x: newX,
        y: newY,
      });
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;

      const stillPresent = findTouch(e.touches, firstId);
      if (!stillPresent) {
        activeTouchIdRef.current = null;
        pinchRef.current = null;
      } else if (e.touches.length < 2 && pinchRef.current) {
        // One finger lifted: gently transition back to single-finger drag
        dragStartRef.current = {
          pointerX: stillPresent.clientX,
          pointerY: stillPresent.clientY,
          itemX: itemRef.current.x,
          itemY: itemRef.current.y
        };
        pinchRef.current = null;
      } else if (e.touches.length < 2) {
        pinchRef.current = null;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();

      if (activeTouchIdRef.current === null && e.changedTouches?.[0]) {
        activeTouchIdRef.current = e.changedTouches[0].identifier;
      }
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('touchcancel', onGlobalTouchEnd);

    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);
    };
  }, [snapAngles, containerRef]);

  const bindGestures = {
    ref: elRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
    // Add touch dummy handlers to stop propagation if they slip through React's event system
    onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchEnd: (e: React.TouchEvent) => e.stopPropagation(),
    onTouchCancel: (e: React.TouchEvent) => e.stopPropagation(),
  };

  return { isDragging, bindGestures, elRef };
}
