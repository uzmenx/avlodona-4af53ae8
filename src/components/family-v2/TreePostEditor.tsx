import { useState, useRef, useEffect } from 'react';
import { X, Send, Type, Smile, Image as ImageIcon, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FamilyTreeCanvas } from './FamilyTreeCanvas';
import { TreeOverlayLayer } from './TreeOverlayLayer';
import { FamilyMember } from '@/types/family';
import { TreeOverlay } from '@/hooks/useTreePosts';
import { uploadMedia } from '@/lib/r2Upload';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STICKERS = ['🌳', '❤️', '👨‍👩‍👧‍👦', '🏠', '⭐', '🎂', '👶', '💍', '🌹', '📷', '🎉', '💝', '🌸', '🦋', '🕊️', '✨'];

const NOOP_FN = () => {};

interface TreePostEditorProps {
  isOpen: boolean;
  onClose: () => void;
  members: Record<string, FamilyMember>;
  positions: Record<string, { x: number; y: number }>;
  initialOverlays?: TreeOverlay[];
  onPublish: (overlays: TreeOverlay[], caption: string, viewport: { x: number; y: number; zoom: number }) => Promise<void>;
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
  const { user } = useAuth();
  const [overlays, setOverlays] = useState<TreeOverlay[]>(initialOverlays);
  const [caption, setCaption] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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

  const handleAddImage = async (file: File) => {
    if (!user?.id) {
      toast.error("Avval tizimga kiring");
      return;
    }
    setIsUploadingImage(true);
    try {
      const publicUrl = await uploadMedia(file, 'tree-overlays', user.id);

      setOverlays(prev => [...prev, {
        id: crypto.randomUUID(),
        type: 'image',
        content: publicUrl,
        x: 60 + Math.random() * 80,
        y: 100 + Math.random() * 150,
        scale: 1,
        rotation: 0,
      }]);
      toast.success("Rasm qo'shildi");
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error("Rasm yuklab bo'lmadi");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handlePublish = async () => {
    await onPublish(overlays, caption, viewport);
    setOverlays([]);
    setCaption('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-sm font-bold">Daraxtni nashr qilish</h3>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={isPublishing}
          className="gap-1.5 rounded-full px-5 h-9"
        >
          <Send className="h-4 w-4" />
          {isPublishing ? 'Nashr...' : 'Nashr'}
        </Button>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Editor step — frame with tree + overlays (horizontal 4:3) */}
        <div className="p-3">
          <div
            className="relative w-full rounded-2xl overflow-hidden border border-border bg-card/50 shadow-sm"
            style={{ aspectRatio: '4/3', maxHeight: '55vh' }}
          >
            {/* Tree canvas fills the frame */}
            <div className="absolute inset-0">
              <FamilyTreeCanvas
                members={members}
                positions={positions}
                onOpenProfile={NOOP_FN}
                onPositionChange={NOOP_FN}
                onViewportChange={setViewport}
                readOnly={true}
              />
            </div>
            {/* Overlay layer on top — not affected by tree zoom */}
            <TreeOverlayLayer overlays={overlays} onChange={setOverlays} editable={true} />
          </div>
        </div>

        {/* Sticker picker */}
        {showStickers && (
          <div className="px-3 pb-2 flex-shrink-0 animate-in slide-in-from-bottom-2">
            <div className="flex flex-wrap gap-1 p-2 rounded-xl bg-card border border-border shadow-sm">
              {STICKERS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleAddSticker(emoji)}
                  className="h-10 w-10 text-2xl rounded-lg hover:bg-muted transition-colors flex items-center justify-center"
                  type="button"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Caption */}
        <div className="px-3 pb-4">
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Izoh yozing..."
            className="min-h-[80px] resize-none bg-muted/30 border-border rounded-xl focus-visible:ring-1 focus-visible:border-primary/50"
            maxLength={2200}
          />
          <p className="text-xs text-muted-foreground text-right mt-1 font-medium">{caption.length}/2200</p>
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-[env(safe-area-inset-bottom,12px)] pointer-events-none">
        <div className="mx-auto max-w-lg rounded-3xl border border-border/40 bg-background/80 backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.22)] pointer-events-auto">
          <div className="p-2">
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant={showStickers ? 'secondary' : 'outline'}
                size="sm"
                className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60 hover:bg-muted"
                onClick={() => setShowStickers(!showStickers)}
              >
                <Smile className="h-4 w-4" />
                <span className="text-[11px] font-medium leading-none">Stiker</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60 hover:bg-muted"
                onClick={handleAddText}
              >
                <Type className="h-4 w-4" />
                <span className="text-[11px] font-medium leading-none">Matn</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 bg-background/60 hover:bg-muted"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                <span className="text-[11px] font-medium leading-none">
                  {isUploadingImage ? 'Yuklanmoqda' : 'Rasm'}
                </span>
              </Button>

              <Button
                variant={overlays.length > 0 ? 'outline' : 'ghost'}
                size="sm"
                className="h-12 rounded-2xl flex flex-col items-center justify-center gap-1 text-destructive hover:bg-destructive/10"
                disabled={overlays.length === 0}
                onClick={() => setOverlays([])}
              >
                <RotateCcw className="h-4 w-4" />
                <span className="text-[11px] font-medium leading-none">Tozalash</span>
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
    </div>
  );
};
