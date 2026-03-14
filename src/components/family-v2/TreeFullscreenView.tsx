import { useMemo } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { TreeOverlayLayer } from './TreeOverlayLayer';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';

interface TreeFullscreenViewProps {
  isOpen: boolean;
  onClose: () => void;
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  overlays?: TreeOverlay[];
  caption?: string | null;
}

export const TreeFullscreenView = ({
  isOpen,
  onClose,
  members,
  positions,
  overlays = [],
  caption,
}: TreeFullscreenViewProps) => {
  const initialViewport = useMemo(() => {
    if (positions['__viewport'] as any) {
      return positions['__viewport'] as any as { x: number; y: number; zoom: number };
    }
    return undefined;
  }, [positions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-sm font-medium">Oila daraxti</h3>
        <div className="w-9" /> {/* spacer */}
      </div>

      {/* Tree container — same card-size, centered, with interactive zoom */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden p-4">
        <div
          className="relative w-full max-w-md rounded-2xl overflow-hidden border border-border bg-card/50 shadow-xl"
          style={{ aspectRatio: '3/4', maxHeight: 'calc(100vh - 180px)' }}
        >
          <div className="absolute inset-0">
            <FamilyTreeCanvas
              members={members}
              positions={positions}
              onOpenProfile={() => {}}
              onPositionChange={() => {}}
              readOnly={true}
              initialViewport={initialViewport}
            />
          </div>
          {overlays.length > 0 && (
            <TreeOverlayLayer overlays={overlays} onChange={() => {}} editable={false} />
          )}
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
          <p className="text-sm text-foreground">{caption}</p>
        </div>
      )}
    </div>
  );
};
