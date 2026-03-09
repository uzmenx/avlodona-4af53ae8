import { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type StoryHighlight } from '@/hooks/useStoryHighlights';
import { HighlightViewer } from './HighlightViewer';
import { HighlightEditor } from './HighlightEditor';

interface HighlightsRowProps {
  highlights: StoryHighlight[];
  isOwner: boolean;
  onCreateNew?: () => void;
  onRefresh?: () => void;
}

export function HighlightsRow({ highlights, isOwner, onCreateNew, onRefresh }: HighlightsRowProps) {
  const [viewingHighlight, setViewingHighlight] = useState<StoryHighlight | null>(null);
  const [editingHighlight, setEditingHighlight] = useState<StoryHighlight | null>(null);

  if (highlights.length === 0 && !isOwner) return null;

  return (
    <>
      <div className="mb-1 w-full">
        <div className="flex w-full gap-2 overflow-x-auto pb-0 px-4 touch-pan-x" style={{ scrollbarWidth: 'none' }}>
          {highlights.map((h) => {
            const coverSrc = h.cover_url || h.items[0]?.media_url;
            return (
              <button
                key={h.id}
                className="flex flex-col items-center gap-1 flex-shrink-0"
                onClick={() => setViewingHighlight(h)}
                onContextMenu={(e) => {
                  if (!isOwner) return;
                  e.preventDefault();
                  setEditingHighlight(h);
                }}
              >
                <div className="w-14 h-14 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center">
                  {coverSrc ? (
                    <img src={coverSrc} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg text-muted-foreground">{h.name[0]}</span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium max-w-14 truncate">{h.name}</span>
              </button>
            );
          })}

          {/* New highlight button + right arrow scroll indicator */}
          {isOwner && (
            <button
              className="flex flex-col items-center gap-1 flex-shrink-0"
              onClick={onCreateNew}
            >
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">Yangi</span>
            </button>
          )}

          {highlights.length > 4 && (
            <div className="flex items-center flex-shrink-0">
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Viewer */}
      {viewingHighlight && (
        <HighlightViewer
          highlight={viewingHighlight}
          onClose={() => setViewingHighlight(null)}
        />
      )}

      {/* Editor (long press) */}
      {editingHighlight && (
        <HighlightEditor
          highlight={editingHighlight}
          open={!!editingHighlight}
          onClose={() => { setEditingHighlight(null); onRefresh?.(); }}
        />
      )}
    </>
  );
}
