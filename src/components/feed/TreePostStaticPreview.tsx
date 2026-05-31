import { useMemo } from 'react';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { cn } from '@/lib/utils';
import { FamilyTreeCanvas } from '@/components/family-v2/FamilyTreeCanvas';

interface TreePostStaticPreviewProps {
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  overlays?: TreeOverlay[];
  className?: string;
  interactive?: boolean;
}

const NOOP_FN = () => {};

/**
 * Renders a static snapshot of the family tree for feed display using the actual Canvas.
 */
export const TreePostStaticPreview = ({
  members,
  positions,
  overlays = [],
  className,
  interactive = false,
}: TreePostStaticPreviewProps) => {
  const initialViewport = useMemo(() => {
    // Check if we have a saved viewport in positions
    if (positions['__viewport'] as any) {
      return positions['__viewport'] as any as { x: number; y: number; zoom: number };
    }
    return undefined;
  }, [positions]);

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-card/50',
        interactive ? 'pointer-events-auto' : 'pointer-events-none',
        className
      )}
      style={{ height: '220px', maxHeight: '220px' }}
    >
      <div className="absolute inset-0">
        <FamilyTreeCanvas
          members={members}
          positions={positions}
          onOpenProfile={NOOP_FN}
          onPositionChange={NOOP_FN}
          readOnly={true}
          initialViewport={initialViewport}
          panEnabled={interactive}
          zoomEnabled={interactive}
        />
      </div>

      {/* Overlays on top */}
      {overlays.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute"
              style={{
                left: overlay.x,
                top: overlay.y,
                transform: `scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
              }}
            >
              {overlay.type === 'sticker' && <span className="text-4xl">{overlay.content}</span>}
              {overlay.type === 'text' && (
                <span className="px-2 py-1 rounded bg-background/80 backdrop-blur-sm text-foreground font-medium whitespace-nowrap" style={{ fontSize: overlay.fontSize || 16, color: overlay.color }}>
                  {overlay.content}
                </span>
              )}
              {overlay.type === 'image' && (
                <img src={overlay.content} alt="" className="w-24 h-24 object-cover rounded-lg shadow-lg" draggable={false} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
