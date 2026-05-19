import { useState, useEffect, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2, X, Image as ImageIcon, Search } from 'lucide-react';
import getCroppedImg from '@/lib/cropImage';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Icon } from '@iconify/react';
import { useGallery } from '@/hooks/useGallery';

interface InstagramPhotoPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageUrl: string) => Promise<void>;
  type: 'avatar' | 'cover';
  initialImage?: string;
}

export const InstagramPhotoPicker = ({ isOpen, onClose, onCropComplete, type, initialImage }: InstagramPhotoPickerProps) => {
  const { t } = useLanguage();
  
  // Use unified useGallery hook for reliable Android & iOS gallery media fetching
  const {
    assets,
    permission,
    requestPermission
  } = useGallery({ pageSize: 120 });

  const [localPhotos, setLocalPhotos] = useState<{ id: string; url: string; isVideo?: boolean }[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{ id: string; url: string; isVideo?: boolean } | null>(null);
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [mode, setMode] = useState<'gallery' | 'gif'>('gallery');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [isSearchingGif, setIsSearchingGif] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map hook assets to photopicker items
  const photos = assets.map(asset => ({
    id: asset.identifier,
    url: asset.thumbnail || asset.webUrl
  }));

  const displayPhotos = [...localPhotos, ...photos];

  // Auto clean up and manage state reset on close
  useEffect(() => {
    if (!isOpen) {
      setLocalPhotos([]);
      setSelectedPhoto(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setGifSearchQuery('');
      setMode('gallery');
    }
  }, [isOpen]);

  // Handle selected photo based on gallery fetch & initialImage
  useEffect(() => {
    if (isOpen) {
      if (initialImage) {
        setSelectedPhoto({ id: 'initial', url: initialImage });
      } else if (displayPhotos.length > 0 && !selectedPhoto) {
        setSelectedPhoto(displayPhotos[0]);
      }
    }
  }, [displayPhotos, initialImage, isOpen]);

  const fetchGifs = async (query = '') => {
    setIsSearchingGif(true);
    try {
      const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
      if (!apiKey) return;
      const endpoint = query 
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=30`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=30`;
      
      const res = await fetch(endpoint);
      const data = await res.json();
      
      if (data.data) {
        setGifs(data.data.map((gif: any) => ({
          id: gif.id,
          url: gif.images.original.url,
          preview: gif.images.fixed_width.url
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingGif(false);
    }
  };

  useEffect(() => {
    if (mode === 'gif' && gifs.length === 0) {
      fetchGifs();
    }
  }, [mode]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (mode === 'gif') {
        fetchGifs(gifSearchQuery);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [gifSearchQuery, mode]);

  const handleFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newPhotos = Array.from(e.target.files).map(file => ({
      id: Math.random().toString(),
      url: URL.createObjectURL(file),
      isVideo: file.type.startsWith('video/')
    }));
    setLocalPhotos(prev => [...newPhotos, ...prev]);
    if (newPhotos.length > 0) {
      setSelectedPhoto(newPhotos[0]);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPhoto) return;
    
    if (mode === 'gif' || selectedPhoto.isVideo) {
      try {
        setIsLoading(true);
        await onCropComplete(selectedPhoto.url);
        onClose();
      } catch (error) {
        console.error('Bypass error:', error);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!croppedAreaPixels) return;
    try {
      setIsLoading(true);
      const croppedUrl = await getCroppedImg(selectedPhoto.url, croppedAreaPixels, 0);
      await onCropComplete(croppedUrl);
      onClose();
    } catch (error) {
      console.error('Crop error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        aria-describedby={undefined}
        className="w-full h-[100dvh] max-w-none flex flex-col p-0 overflow-hidden bg-zinc-950 border-none rounded-none !m-0 !mt-0 !mb-0 !z-[200] sm:max-w-xl sm:h-[92vh] sm:rounded-3xl mx-auto sm:my-auto [&>button]:hidden"
      >
        {/* Modern Instagram-Style Header */}
        <div 
          className="flex items-center justify-between min-h-16 px-4 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.04] shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          {/* Cancel button */}
          <button 
            type="button"
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] active:scale-90 border border-white/[0.08] transition-all duration-300 shadow-inner"
            aria-label="Yopish"
          >
            <X className="h-4.5 w-4.5 text-white/80" />
          </button>
          
          {/* Custom Capsule Tab Switcher */}
          <div className="flex bg-black/60 p-0.5 rounded-full items-center border border-white/[0.06] shadow-inner relative">
            <button 
              type="button"
              onClick={() => { 
                setMode('gallery'); 
                if (displayPhotos.length > 0) {
                  setSelectedPhoto(displayPhotos[0]);
                } else if (initialImage) {
                  setSelectedPhoto({ id: 'initial', url: initialImage });
                }
              }}
              className={cn(
                "px-5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-300 relative z-10",
                mode === 'gallery' 
                  ? "bg-white text-zinc-950 shadow-[0_2px_8px_rgba(255,255,255,0.18)]" 
                  : "text-white/45 hover:text-white/80"
              )}
            >
              {t('gallery')}
            </button>
            <button 
              type="button"
              onClick={() => { setMode('gif'); setSelectedPhoto(null); }}
              className={cn(
                "px-5 py-1.5 rounded-full text-[11px] font-bold transition-all duration-300 relative z-10",
                mode === 'gif' 
                  ? "bg-white text-zinc-950 shadow-[0_2px_8px_rgba(255,255,255,0.18)]" 
                  : "text-white/45 hover:text-white/80"
              )}
            >
              {t('gifs')}
            </button>
          </div>
          
          {/* Save Button (Premium Emerald Glow) */}
          <button 
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || !selectedPhoto}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-[11px] active:scale-95 transition-all duration-300 flex items-center justify-center gap-1.5 border border-emerald-400/30 shadow-[0_0_15px_rgba(16,185,129,0.22)] hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-30 disabled:pointer-events-none"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
            ) : (
              t('save')
            )}
          </button>
        </div>
        
        {permission === 'denied' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-zinc-900">
            <p className="mb-4 text-white/70 text-sm">{t('givePermissionDesc')}</p>
            <button 
              type="button"
              onClick={requestPermission} 
              className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-black font-bold rounded-2xl h-11 px-8 transition-transform"
            >
              {t('allowPermission')}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
            {/* Top Half: Auto-Cropped Circle Preview (aspect-square for perfect 1:1, edge-to-edge) */}
            <div className="relative w-full aspect-square bg-zinc-900 shrink-0 border-b border-white/[0.04]">
              {selectedPhoto ? (
                mode === 'gif' || selectedPhoto.isVideo ? (
                   <div className="w-full h-full flex items-center justify-center p-6">
                     <div className={cn(
                       "relative overflow-hidden bg-black/40 border border-white/10 shadow-2xl flex items-center justify-center",
                       type === 'avatar' ? 'w-[75%] aspect-square rounded-full' : 'w-[90%] aspect-[3/1] rounded-2xl'
                     )}>
                       {selectedPhoto.isVideo ? (
                         <video 
                           src={selectedPhoto.url} 
                           className="w-full h-full object-cover" 
                           autoPlay loop muted playsInline
                         />
                       ) : (
                         <img 
                           src={selectedPhoto.url} 
                           alt="GIF Preview"
                           className="w-full h-full object-cover" 
                         />
                       )}
                     </div>
                   </div>
                ) : (
                  <Cropper
                    image={selectedPhoto.url}
                    crop={crop}
                    zoom={zoom}
                    aspect={type === 'avatar' ? 1 : 3}
                    cropShape={type === 'avatar' ? 'round' : 'rect'}
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropCompleteHandler}
                    onZoomChange={setZoom}
                    objectFit="cover"
                    classes={{
                      containerClassName: 'bg-zinc-900',
                      cropAreaClassName: type === 'avatar' 
                        ? 'border-2 border-white/60 shadow-[0_0_0_9999em_rgba(9,9,11,0.7)] rounded-full' 
                        : 'border-2 border-white/60 shadow-[0_0_0_9999em_rgba(9,9,11,0.75)]'
                    }}
                    zoomWithScroll={true}
                  />
                )
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 text-sm gap-2">
                  <ImageIcon className="w-8 h-8 opacity-40 animate-pulse" />
                  <span>{mode === 'gif' ? t('selectGif') : t('selectPhoto')}</span>
                </div>
              )}
              
              {/* Hint text overlay */}
              {mode === 'gallery' && selectedPhoto && (
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-10">
                  <span className="bg-black/65 backdrop-blur-md border border-white/5 text-white/95 text-[10px] px-3 py-1.5 rounded-full font-medium tracking-wide shadow-lg">
                    {t('cropHint')}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Half: 3-Column Gallery / GIF Grid (scrollable) */}
            <div className="flex-1 bg-zinc-950 flex flex-col relative overflow-hidden">
              {mode === 'gallery' ? (
                <div className="flex-1 flex flex-col relative overflow-hidden h-full">
                  {/* The Photo Grid Scrollable area */}
                  <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                    <div className="grid grid-cols-3 gap-[2px] p-0.5">
                      {/* Fetched & Uploaded Photos */}
                      {displayPhotos.length > 0 && displayPhotos.map((photo) => (
                        <button
                          key={photo.id} 
                          type="button"
                          onClick={() => {
                            setSelectedPhoto(photo);
                            setCrop({ x: 0, y: 0 });
                            setZoom(1);
                          }}
                          className="relative aspect-square cursor-pointer overflow-hidden bg-white/[0.03] active:scale-95 transition-all group"
                        >
                          <img 
                            src={photo.url} 
                            alt="" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            loading="lazy" 
                          />
                          {selectedPhoto?.id === photo.id && (
                            <div className="absolute inset-0 bg-white/15 border-[3px] border-emerald-500 transition-all shadow-inner" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Floating Action Button (FAB) at bottom-left corner with 'eva:file-add-fill' Icon */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-6 left-6 w-14 h-14 rounded-full bg-zinc-900/90 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-[0_6px_24px_rgba(0,0,0,0.65)] active:scale-95 transition-all z-20 group hover:bg-zinc-850"
                  >
                    <Icon icon="eva:file-add-fill" className="w-7 h-7 text-white" />
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*,video/*" 
                      onChange={handleFallbackUpload} 
                    />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col relative overflow-hidden h-full">
                  {/* Search Input bar (Sticky top in scroll view) */}
                  <div className="p-3 shrink-0 relative flex items-center bg-zinc-950 z-10">
                    <Search className="w-4 h-4 text-white/30 absolute left-6" />
                    <input 
                      type="text" 
                      placeholder={t('searchGifs')}
                      value={gifSearchQuery}
                      onChange={(e) => setGifSearchQuery(e.target.value)}
                      className="w-full bg-white/[0.06] text-white border border-white/[0.06] rounded-xl h-10 pl-10 pr-4 text-sm focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-white/30"
                    />
                  </div>

                  {/* Scrollable GIF Grid container */}
                  <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                    <div className="grid grid-cols-3 gap-[2px] p-0.5">
                      {isSearchingGif && gifs.length === 0 ? (
                        <div className="col-span-3 py-12 flex justify-center items-center">
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                        </div>
                      ) : (
                        gifs.map((gif) => (
                          <button 
                            key={gif.id} 
                            type="button"
                            onClick={() => {
                              setSelectedPhoto({ id: gif.id, url: gif.url });
                            }}
                            className="relative aspect-square cursor-pointer bg-white/[0.03] overflow-hidden active:scale-95 transition-all group w-full h-full"
                          >
                            <img 
                              src={gif.preview} 
                              alt="" 
                              className="w-full h-full object-cover group-hover:scale-102 transition-transform" 
                              loading="lazy" 
                            />
                            {selectedPhoto?.id === gif.id && (
                              <div className="absolute inset-0 bg-white/15 border-[3px] border-emerald-500 transition-all shadow-inner" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
