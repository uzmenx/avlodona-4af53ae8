import { useRef, useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

export interface TextItem {
  id: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  fontSize: number;
  isEmoji: boolean;
}

interface TextOverlayProps {
  item: TextItem;
  containerRef: React.RefObject<HTMLDivElement>;
  onUpdate: (item: TextItem) => void;
  onDelete: (id: string) => void;
}

function parseText(text: string) {
  const parts: { text: string; type: 'text' | 'mention' | 'hashtag' | 'link' }[] = [];
  const regex = /(@\w+|#\w+|https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), type: 'text' });
    }
    const val = match[0];
    if (val.startsWith('@')) parts.push({ text: val, type: 'mention' });
    else if (val.startsWith('#')) parts.push({ text: val, type: 'hashtag' });
    else parts.push({ text: val, type: 'link' });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: 'text' });
  }
  return parts;
}

export default function TextOverlay({ item, containerRef, onUpdate, onDelete }: TextOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });
  const pinchRef = useRef<{ dist: number; angle: number; scale: number; rotation: number } | null>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [item.x, item.y]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    onUpdate({
      ...item,
      x: Math.max(0, Math.min(100, dragStart.current.itemX + (dx / rect.width) * 100)),
      y: Math.max(0, Math.min(100, dragStart.current.itemY + (dy / rect.height) * 100)),
    });
  }, [isDragging, item, containerRef, onUpdate]);

  const handlePointerUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const findTouch = (touches: TouchList, id: number) => {
      for (let i = 0; i < touches.length; i++) {
        if (touches[i]?.identifier === id) return touches[i];
      }
      return null;
    };

    const pickSecondTouch = (touches: TouchList, firstId: number) => {
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        if (t && t.identifier !== firstId) return t;
      }
      return null;
    };

    const onGlobalTouchMove = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;
      if (e.touches.length < 2) return;

      const t1 = findTouch(e.touches, firstId);
      const t2 = pickSecondTouch(e.touches, firstId);
      if (!t1 || !t2) return;

      e.stopPropagation();
      e.preventDefault();

      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const angle = Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI);

      if (!pinchRef.current) {
        pinchRef.current = { dist, angle, scale: item.scale, rotation: item.rotation };
        return;
      }

      onUpdate({
        ...item,
        scale: Math.max(0.3, Math.min(5, pinchRef.current.scale * (dist / pinchRef.current.dist))),
        rotation: pinchRef.current.rotation + (angle - pinchRef.current.angle),
      });
    };

    const onGlobalTouchEnd = (e: TouchEvent) => {
      const firstId = activeTouchIdRef.current;
      if (firstId === null) return;

      const stillPresent = findTouch(e.touches, firstId);
      if (!stillPresent) {
        activeTouchIdRef.current = null;
        pinchRef.current = null;
      }

      if (e.touches.length < 2) pinchRef.current = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (activeTouchIdRef.current === null && e.changedTouches?.[0]) {
        activeTouchIdRef.current = e.changedTouches[0].identifier;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', onGlobalTouchMove, { passive: false });
    window.addEventListener('touchend', onGlobalTouchEnd);
    window.addEventListener('touchcancel', onGlobalTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', onGlobalTouchMove);
      window.removeEventListener('touchend', onGlobalTouchEnd);
      window.removeEventListener('touchcancel', onGlobalTouchEnd);
    };
  }, [item, onUpdate]);

  const parts = item.isEmoji ? null : parseText(item.content);

  return (
    <div
      ref={elRef}
      className="absolute select-none touch-none cursor-move group"
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
        fontSize: `${item.fontSize}px`,
        zIndex: isDragging ? 50 : 40,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onTouchStart={(e) => { e.stopPropagation(); }}
      onTouchMove={(e) => { e.stopPropagation(); }}
      onTouchEnd={(e) => { e.stopPropagation(); }}
      onTouchCancel={(e) => { e.stopPropagation(); }}
    >
      <div className="relative">
        {item.isEmoji ? (
          <span className="leading-none">{item.content}</span>
        ) : (
          <span className="font-bold whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {parts!.map((p, i) => (
              <span
                key={i}
                style={{
                  color:
                    p.type === 'mention' ? 'hsl(210, 100%, 65%)' :
                    p.type === 'hashtag' ? 'hsl(185, 100%, 60%)' :
                    p.type === 'link' ? 'hsl(210, 100%, 65%)' : 'white',
                }}
              >
                {p.text}
              </span>
            ))}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          className="absolute -top-3 -right-3 w-5 h-5 bg-destructive rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3 text-destructive-foreground" />
        </button>
      </div>
    </div>
  );
}
