import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Send, Type, Smile, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { TreeOverlayLayer } from './TreeOverlayLayer';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';

const STICKERS = ['🌳', '❤️', '👨‍👩‍👧‍👦', '🏠', '⭐', '🎂', '👶', '💍', '🌹', '📷', '🎉', '💝', '🌸', '🦋', '🕊️', '✨'];

const NOOP_FN = () => {};

interface TreePostEditorProps {
  isOpen: boolean;
  onClose: () => void;
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  initialOverlays?: TreeOverlay[];
  onPublish: (overlays: TreeOverlay[], caption: string) => Promise<void>;
  isPublishing?: boolean;
}

export const TreePostEditor = ({
  isOpen,
  onClose,
  members,
  positions,
  initialOverlays = [],
  onPublish,
  isPublishing,
}: TreePostEditorProps) => {
  const [overlays, setOverlays] = useState<TreeOverlay[]>(initialOverlays);
  const [caption, setCaption] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: true } }));
    return () => {
      window.dispatchEvent(new CustomEvent('app:forceHideNav', { detail: { hide: false } }));
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddSticker = (emoji: string) => {
    setOverlays(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'sticker',
      content: emoji,
      x: 80 + Math.random() * 120,
      y: 100 + Math.random() * 200,
      scale: 1,
      rotation: 0,
    }]);
    setShowStickers(false);
  };

  const handleAddText = () => {
    const text = prompt('Matn kiriting:');
    if (!text) return;
    setOverlays(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'text',
      content: text,
      x: 60 + Math.random() * 100,
      y: 100 + Math.random() * 200,
      scale: 1,
      rotation: 0,
      fontSize: 18,
    }]);
  };

  const handleAddImage = (file: File) => {
    const url = URL.createObjectURL(file);
    setOverlays(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'image',
      content: url,
      x: 60 + Math.random() * 80,
      y: 100 + Math.random() * 150,
      scale: 1,
      rotation: 0,
    }]);
  };

  const handlePublish = async () => {
    await onPublish(overlays, caption);
    setOverlays([]);
    setCaption('');
    setShowCaption(false);
  };

  return (
    <div
      className={
        'fixed inset-0 z-[100] bg-background flex flex-col ' +
        (showCaption ? 'pb-6' : 'pb-28')
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-sm font-bold">Daraxtni nashr qilish</h3>
        <Button
          size="sm"
          onClick={showCaption ? handlePublish : () => setShowCaption(true)}
          disabled={isPublishing}
          className="gap-1.5 rounded-full px-5 h-9"
        >
          <Send className="h-4 w-4" />
          {showCaption ? (isPublishing ? 'Nashr...' : 'Nashr') : 'Davom'}
        </Button>
      </div>

      {showCaption ? (
        /* Caption step */
        <div className="flex-1 flex flex-col p-4 gap-4">
          {/* Mini preview */}
          <div className="w-full aspect-[9/16] max-h-[55vh] rounded-2xl overflow-hidden border border-border relative bg-card/50">
            <FamilyTreeCanvas
              members={members}
              positions={positions}
              onOpenProfile={NOOP_FN}
              onPositionChange={NOOP_FN}
            />
            {overlays.length > 0 && (
              <TreeOverlayLayer overlays={overlays} onChange={NOOP_FN} editable={false} />
            )}
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Izoh yozing..."
            className="min-h-[80px] resize-none bg-muted/30"
            maxLength={2200}
          />
          <p className="text-xs text-muted-foreground text-right">{caption.length}/2200</p>
        </div>
      ) : (
        /* Editor step — 3:4 frame with tree + overlays */
        <>
          <div className="flex-1 flex items-center justify-center p-3 min-h-0">
            <div
              className="relative w-full rounded-2xl overflow-hidden border border-border bg-card/50"
              style={{ aspectRatio: '9/16', maxHeight: 'calc(100vh - 260px)' }}
            >
              {/* Tree canvas fills the frame */}
              <div className="absolute inset-0">
                <FamilyTreeCanvas
                  members={members}
                  positions={positions}
                  onOpenProfile={NOOP_FN}
                  onPositionChange={NOOP_FN}
                />
              </div>
              {/* Overlay layer on top — not affected by tree zoom */}
              <TreeOverlayLayer overlays={overlays} onChange={setOverlays} editable={true} />
            </div>
          </div>

          {/* Sticker picker */}
          {showStickers && (
            <div className="px-3 pb-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-card border border-border">
                {STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleAddSticker(emoji)}
                    className="h-10 w-10 rounded-lg hover:bg-muted flex items-center justify-center text-2xl"
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bottom toolbar */}
          <div className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="mx-auto max-w-lg rounded-3xl border border-border/40 bg-background/70 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
              <div className="p-2">
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60"
                    onClick={() => setShowStickers(!showStickers)}
                  >
                    <Smile className="h-4 w-4" />
                    <span className="text-[11px] leading-none">Stiker</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60"
                    onClick={handleAddText}
                  >
                    <Type className="h-4 w-4" />
                    <span className="text-[11px] leading-none">Matn</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-[11px] leading-none">Rasm</span>
                  </Button>

                  <Button
                    variant={overlays.length > 0 ? 'outline' : 'ghost'}
                    size="sm"
                    className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 text-destructive"
                    disabled={overlays.length === 0}
                    onClick={() => setOverlays([])}
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span className="text-[11px] leading-none">Tozalash</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAddImage(file);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
};
