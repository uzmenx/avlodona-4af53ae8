import { useState, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-sm font-medium">Oila daraxti</h3>
        <div className="w-9" /> {/* spacer */}
      </div>

      {/* Fullscreen canvas */}
      <div className="flex-1 relative">
        <FamilyTreeCanvas
          members={members}
          positions={positions}
          onOpenProfile={() => {}}
          onPositionChange={() => {}}
        />
        {overlays.length > 0 && (
          <TreeOverlayLayer overlays={overlays} onChange={() => {}} editable={false} />
        )}
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 py-3 border-t border-border bg-background/95 backdrop-blur-sm">
          <p className="text-sm text-foreground">{caption}</p>
        </div>
      )}
    </div>
  );
};
