import { useState, useRef, useCallback } from 'react';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface TreeOverlayLayerProps {
  overlays: TreeOverlay[];
  onChange: (overlays: TreeOverlay[]) => void;
  editable?: boolean;
}

export const TreeOverlayLayer = ({ overlays, onChange, editable = true }: TreeOverlayLayerProps) => {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent, overlay: TreeOverlay) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    dragOffset.current = {
      x: e.clientX - (rect.left + overlay.x),
      y: e.clientY - (rect.top + overlay.y),
    };
    hasMoved.current = false;
    setDraggingId(overlay.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [editable]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId || !containerRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    hasMoved.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - rect.left - dragOffset.current.x;
    const newY = e.clientY - rect.top - dragOffset.current.y;

    onChange(overlays.map(o => o.id === draggingId ? { ...o, x: newX, y: newY } : o));
  }, [draggingId, overlays, onChange]);

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  const removeOverlay = (id: string) => {
    onChange(overlays.filter(o => o.id !== id));
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{ touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {overlays.map((overlay) => (
        <div
          key={overlay.id}
          className={cn(
            "absolute select-none pointer-events-auto",
            editable && "cursor-move",
            draggingId === overlay.id && "z-50 scale-110 opacity-90"
          )}
          style={{
            left: overlay.x,
            top: overlay.y,
            transform: `scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
            touchAction: 'none',
          }}
          onPointerDown={(e) => handlePointerDown(e, overlay)}
        >
          {/* Invisible larger touch target for easier dragging */}
          {editable && (
            <div
              className="absolute -inset-3"
              style={{ touchAction: 'none' }}
            />
          )}
          {overlay.type === 'sticker' && (
            <span className="text-4xl pointer-events-none">{overlay.content}</span>
          )}
          {overlay.type === 'text' && (
            <span
              className="px-2 py-1 rounded bg-background/80 backdrop-blur-sm text-foreground font-medium whitespace-nowrap pointer-events-none"
              style={{ fontSize: overlay.fontSize || 16, color: overlay.color }}
            >
              {overlay.content}
            </span>
          )}
          {overlay.type === 'image' && (
            <img
              src={overlay.content}
              alt=""
              className="w-24 h-24 object-cover rounded-lg shadow-lg pointer-events-none"
              draggable={false}
            />
          )}
          {editable && (
            <button
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs shadow-md z-10"
              onClick={(e) => { e.stopPropagation(); removeOverlay(overlay.id); }}
              style={{ touchAction: 'manipulation' }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

// Toolbar for adding overlays
interface OverlayToolbarProps {
  onAddSticker: (emoji: string) => void;
  onAddText: () => void;
  onAddImage: () => void;
}

export const OverlayToolbar = ({ onAddSticker, onAddText, onAddImage }: OverlayToolbarProps) => {
  void onAddSticker;
  void onAddText;
  void onAddImage;
  return null;
};
