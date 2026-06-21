import { useState, useRef, useEffect } from 'react';
import { useGallery } from '@/hooks/useGallery';
import { cn } from '@/lib/utils';
import { X, MoreHorizontal } from 'lucide-react';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ChatMediaPickerProps {
  onSend?: (media: MediaFile[], caption: string) => void;
  onSelect?: (media: MediaFile) => void;
  onClose: () => void;
  mode?: 'single' | 'multiple';
  showCaption?: boolean;
  allowedTypes?: 'all' | 'image' | 'video';
  title?: string;
  maxSelection?: number;
}

export const ChatMediaPicker = ({ 
  onSend, 
  onSelect,
  onClose,
  mode = 'multiple',
  showCaption = true,
  allowedTypes = 'all',
  title = 'Galereya',
  maxSelection = 10
}: ChatMediaPickerProps) => {
  const {
    assets,
    isLoading,
    loadMore,
    permission,
    requestPermission,
    isNative,
  } = useGallery();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'image' | 'video'>(allowedTypes === 'all' ? 'all' : allowedTypes);
  const [caption, setCaption] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sheetY, setSheetY] = useState(0);
  const startY = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedAssets = assets.filter(a => selectedIds.includes(a.identifier));
  
  const filteredAssets = assets.filter(asset => {
    if (allowedTypes !== 'all' && asset.mediaType !== allowedTypes) return false;
    if (activeTab === 'all') return true;
    return asset.mediaType === activeTab;
  });

  // Auto-request is now handled inside useGallery.ts initialize() to avoid race conditions.

  const toggleSelect = async (id: string) => {
    if (mode === 'single') {
      const asset = assets.find(a => a.identifier === id);
      if (asset && onSelect) {
        setIsSending(true);
        try {
          let blob;
          try {
            const res = await fetch(asset.webUrl);
            if (!res.ok) throw new Error("Fetch full image failed");
            blob = await res.blob();
          } catch (e) {
            console.warn("Failed to fetch full image in single mode, using thumbnail:", e);
            const res = await fetch(asset.thumbnail || asset.webUrl);
            blob = await res.blob();
          }
          const file = new File([blob], `media_${asset.identifier}.jpg`, { type: blob.type });
          
          onSelect({
            file,
            preview: asset.thumbnail || asset.webUrl,
            type: asset.mediaType === 'video' ? 'video' : 'image',
          });
          onClose();
        } catch (error) {
          console.error("Error converting asset to file:", error);
          setIsSending(false);
        }
      }
    } else {
      setSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        if (prev.length >= maxSelection) return prev;
        return [...prev, id];
      });
    }
  };

  const getOrder = (id: string) => {
    const idx = selectedIds.indexOf(id);
    return idx >= 0 ? idx + 1 : null;
  };

  // Convert native webUrl → File object via fetch (with fallback to base64 thumbnail if full-res is blocked by Android Scoped Storage)
  const assetToFile = async (url: string, thumbnail: string, name: string, mimeType: string): Promise<File> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Fetch full-res failed");
      const blob = await response.blob();
      return new File([blob], name, { type: mimeType });
    } catch (e) {
      console.warn(`[assetToFile] Failed to fetch full resolution path, using base64 thumbnail fallback:`, e);
      const response = await fetch(thumbnail || url);
      const blob = await response.blob();
      return new File([blob], name, { type: mimeType });
    }
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) return;
    setIsSending(true);
    try {
      const mediaFiles: MediaFile[] = await Promise.all(
        selectedAssets.map(async (asset, i) => {
          const ext = asset.mediaType === 'video' ? 'mp4' : 'jpg';
          const mime = asset.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const name = `media_${Date.now()}_${i}.${ext}`;
          const file = await assetToFile(asset.webUrl, asset.thumbnail, name, mime);
          return {
            file,
            preview: asset.thumbnail || asset.webUrl,
            type: asset.mediaType === 'video' ? 'video' : 'image',
          } as MediaFile;
        })
      );
      setTimeout(() => {
        onSend(mediaFiles, caption);
        setIsSending(false);
        onClose();
      }, 400);
    } catch (e) {
      console.error('[ChatMediaPicker] send error:', e);
      setIsSending(false);
    }
  };

  // Device file upload (Yuklash button)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const mediaFiles: MediaFile[] = files.map(f => ({
      file: f,
      preview: URL.createObjectURL(f),
      type: f.type.startsWith('video/') ? 'video' : 'image',
    }));
    onSend(mediaFiles, caption);
    onClose();
  };

  // Swipe to close
  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) setSheetY(diff);
  };
  const onTouchEnd = () => {
    if (sheetY > 120) onClose();
    setSheetY(0);
  };

  return (
    <div
      className="flex flex-col bg-[#17212b] text-white"
      style={{
        height: '88vh',
        maxHeight: '88vh',
        borderRadius: '24px 24px 0 0',
        transform: `translateY(${sheetY}px)`,
        transition: sheetY === 0 ? 'transform 0.35s cubic-bezier(.32,1.1,.55,1)' : 'none',
        overflow: 'hidden',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Premium Integrated Header & Drag Handle */}
      <div className="flex items-center justify-between px-4 pt-3 pb-3 flex-shrink-0 relative">
        {/* Left Close Circle Button */}
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition-all border border-white/5 shadow-inner"
        >
          <X className="w-5 h-5 text-white/90" />
        </button>

        {/* Drag Handle in the middle */}
        <div className="w-12 h-1.5 rounded-full opacity-35 bg-white" />

        {/* Right Circular More/Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.15] active:scale-95 flex items-center justify-center transition-all border border-white/5 shadow-inner"
        >
          <MoreHorizontal className="w-5 h-5 text-white/90" />
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Selected previews strip (Horizontal Scroll) */}
      {selectedIds.length > 0 && (
        <div className="flex gap-2.5 px-4 py-3 overflow-x-auto border-b flex-shrink-0 hide-scrollbar" style={{ borderColor: '#253347' }}>
          {selectedAssets.map((asset, i) => (
            <div key={asset.identifier} className="relative shrink-0 animate-in fade-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-xl overflow-hidden shadow-lg border border-white/10">
                <img src={asset.thumbnail || asset.webUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toggleSelect(asset.identifier); }}
                className="absolute -top-1 -left-1 w-5 h-5 bg-red-500/80 text-white rounded-full flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ minHeight: 0, background: '#0d1117' }}
        onScroll={e => {
          const t = e.currentTarget;
          if (t.scrollHeight - t.scrollTop <= t.clientHeight + 80) loadMore();
        }}
      >
        {/* Permission denied */}
        {isNative && permission === 'denied' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className="text-5xl">🔒</div>
            <p className="text-white font-semibold text-center">
              Galereya uchun ruxsat kerak
            </p>
            <p className="text-sm text-center" style={{ color: '#8899aa' }}>
              Sozlamalar → Ilovalar → Avlodona → Ruxsatlar bo'limida galereyaga ruxsat bering.
            </p>
          </div>
        )}

        {/* Permission prompt */}
        {isNative && (permission === 'prompt' || permission === 'unavailable') && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <div className="text-5xl">🖼️</div>
            <p className="text-white font-semibold text-center">
              Galereyaga kirish uchun ruxsat bering
            </p>
            <button
              onClick={requestPermission}
              className="px-8 py-3 rounded-full text-white font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #2dbcff, #1a8cff)',
                boxShadow: '0 4px 18px rgba(45,188,255,0.35)',
              }}
            >
              Ruxsat berish
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 rounded-full text-sm font-medium border"
              style={{ color: '#2dbcff', borderColor: '#253347' }}
            >
              Qurilmadan yuklash
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && assets.length === 0 && (
          <div className="flex items-center justify-center h-40">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#2dbcff', borderTopColor: 'transparent' }}
            />
          </div>
        )}

        {/* Limited Permission Banner */}
        {isNative && permission === 'limited' && (
          <div className="flex items-center justify-between px-4 py-3 mx-2 mt-2 mb-1 rounded-xl bg-[#253347]">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">Cheklangan ruxsat</span>
              <span className="text-xs text-[#8899aa]">Barcha rasmlar ko'rinmasligi mumkin</span>
            </div>
            <button
              onClick={requestPermission}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2dbcff] text-white"
            >
              Ko'proq
            </button>
          </div>
        )}

        {/* Empty (granted but no assets) */}
        {!isLoading && (permission === 'granted' || permission === 'limited') && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <div className="text-4xl">📂</div>
            <p className="text-sm" style={{ color: '#8899aa' }}>Galereyada rasmlar topilmadi</p>
          </div>
        )}

        {/* Grid */}
        {filteredAssets.length > 0 && (
          <div
            className="grid gap-0.5 p-0.5"
            style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
          >
            {filteredAssets.map(asset => {
              const order = getOrder(asset.identifier);
              const isSelected = !!order;

              return (
                <div
                  key={asset.identifier}
                  className="relative cursor-pointer overflow-hidden"
                  style={{ aspectRatio: '1', background: '#0d1117' }}
                  onClick={() => toggleSelect(asset.identifier)}
                >
                  <img
                    src={asset.thumbnail || asset.webUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{
                      opacity: isSelected ? 0.72 : 1,
                      transition: 'opacity 0.15s',
                    }}
                    loading="lazy"
                  />

                  <div
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background: isSelected ? '#2dbcff' : 'rgba(0,0,0,0.45)',
                      border: isSelected ? '2px solid #2dbcff' : '2px solid rgba(255,255,255,0.55)',
                      color: 'white',
                      transform: isSelected ? 'scale(1)' : 'scale(0.85)',
                      transition: 'all 0.18s cubic-bezier(.4,1.3,.6,1)',
                    }}
                  >
                    {isSelected ? '✓' : ''}
                  </div>

                  {/* Video badge */}
                  {asset.mediaType === 'video' && (
                    <div
                      className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                    >
                      ▶ {asset.duration ? `${Math.floor(asset.duration / 60)}:${(asset.duration % 60).toString().padStart(2, '0')}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Load more indicator */}
        {isLoading && assets.length > 0 && (
          <div className="flex justify-center py-4">
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#2dbcff', borderTopColor: 'transparent' }}
            />
          </div>
        )}
      </div>

      {/* Bottom bar (Caption & Send) */}
      {mode === 'multiple' && (
        <div 
          className="border-t px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] flex items-end gap-2 flex-shrink-0"
          style={{ borderColor: '#253347', background: '#17212b' }}
        >

          {/* Caption input */}
          {showCaption && (
            <div
              className="flex-1 rounded-2xl px-3 py-2 flex items-center"
              style={{ background: '#253347', minHeight: '40px' }}
            >
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Izoh qo'shish..."
                rows={1}
                className="w-full bg-transparent text-white text-sm outline-none resize-none"
                style={{
                  color: 'white',
                  lineHeight: '1.4',
                  maxHeight: '80px',
                  overflowY: 'auto',
                }}
              />
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={selectedIds.length === 0 || isSending}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90 disabled:opacity-40"
            style={{
              background: selectedIds.length > 0 ? 'linear-gradient(135deg, #2dbcff, #1a8cff)' : '#253347',
              boxShadow: selectedIds.length > 0 ? '0 4px 14px rgba(45,188,255,0.4)' : 'none',
              marginLeft: !showCaption ? 'auto' : undefined
            }}
          >
            {isSending ? (
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'white', borderTopColor: 'transparent' }}
              />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Sent overlay */}
      {isSending && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(23,33,43,0.92)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #2dbcff, #1a8cff)',
                boxShadow: '0 0 40px rgba(45,188,255,0.5)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-white font-semibold text-base">Yuborilmoqda...</p>
          </div>
        </div>
      )}
    </div>
  );
};
