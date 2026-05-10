import { useState, useEffect, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, CheckCircle2 } from 'lucide-react';
import getCroppedImg from '@/lib/cropImage';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';

interface InstagramPhotoPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageUrl: string) => Promise<void>;
  type: 'avatar' | 'cover';
}

export const InstagramPhotoPicker = ({ isOpen, onClose, onCropComplete, type }: InstagramPhotoPickerProps) => {
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<{ id: string; url: string } | null>(null);
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const [mode, setMode] = useState<'gallery' | 'gif'>('gallery');
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([]);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [isSearchingGif, setIsSearchingGif] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      checkPermissionsAndFetch();
    } else {
      // Reset state on close
      setPhotos([]);
      setSelectedPhoto(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [isOpen]);

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

  const checkPermissionsAndFetch = async () => {
    if (!Capacitor.isNativePlatform()) {
      setHasPermission(true);
      return;
    }
    try {
      let perm = await Media.checkPermissions();
      // On some plugins, it might be publicStorage or gallery
      if (perm.publicStorage !== 'granted' && perm.publicStorage !== 'limited') {
        perm = await Media.requestPermissions();
      }
      if (perm.publicStorage === 'granted' || perm.publicStorage === 'limited') {
        setHasPermission(true);
        fetchPhotos();
      } else {
        setHasPermission(false);
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setHasPermission(true);
    }
  };

  const fetchPhotos = async () => {
    try {
      const result = await Media.getMedias({
        quantity: 150,
        sort: [{ key: 'creationTime', ascending: false }]
      });
      const mapped = result.medias.map(m => ({
        // Note: Using the webPath instead of raw data to get file properly on web view
        id: m.identifier,
        url: m.data ? Capacitor.convertFileSrc(m.data) : ''
      })).filter(m => m.url !== '');
      setPhotos(mapped);
      if (mapped.length > 0) setSelectedPhoto(mapped[0]);
    } catch (e) {
      console.error("Error fetching medias", e);
    }
  };

  const handleFallbackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newPhotos = Array.from(e.target.files).map(file => ({
      id: Math.random().toString(),
      url: URL.createObjectURL(file)
    }));
    setPhotos(prev => [...newPhotos, ...prev]);
    if (!selectedPhoto && newPhotos.length > 0) {
      setSelectedPhoto(newPhotos[0]);
    }
  };

  const handleConfirm = async () => {
    if (!selectedPhoto) return;
    
    if (mode === 'gif') {
      try {
        setIsLoading(true);
        await onCropComplete(selectedPhoto.url);
        onClose();
      } catch (error) {
        console.error('GIF error:', error);
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
        className="w-full h-[100dvh] max-w-none flex flex-col p-0 overflow-hidden bg-black border-none rounded-none !m-0 !mt-0 !mb-0 !z-[200] sm:max-w-xl sm:h-[90vh] sm:rounded-2xl mx-auto sm:my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-[60px] px-2 bg-black shrink-0 border-b border-white/10">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10 h-12 w-12 rounded-full">
            <X className="h-7 w-7" />
          </Button>
          
          <div className="flex bg-white/10 p-1 rounded-full items-center">
            <button 
              onClick={() => { setMode('gallery'); setSelectedPhoto(photos[0] || null); }}
              className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all ${mode === 'gallery' ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              Galereya
            </button>
            <button 
              onClick={() => { setMode('gif'); setSelectedPhoto(null); }}
              className={`px-4 py-1.5 rounded-full text-[14px] font-bold transition-all flex items-center gap-1.5 ${mode === 'gif' ? 'bg-white text-black shadow-sm' : 'text-white/60 hover:text-white'}`}
            >
              {mode !== 'gif' && <div className="bg-[#8B5CF6] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] leading-none tracking-wider">GIF</div>}
              GIFlar
            </button>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={handleConfirm}
            disabled={isLoading || !selectedPhoto}
            className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 font-bold text-[17px] h-12 px-4"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Tayyor"}
          </Button>
        </div>
        
        {hasPermission === false ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white bg-[#111]">
            <p className="mb-4 text-white/70">Rasmlarni ko'rish uchun ruxsat bering</p>
            <Button onClick={checkPermissionsAndFetch} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl h-12 px-8">
              Ruxsat berish
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-[calc(100vh-60px)]">
            {/* Top Preview */}
            <div className="relative w-full aspect-square bg-[#111] shrink-0">
              {selectedPhoto ? (
                mode === 'gif' ? (
                   <div className="w-full h-full flex items-center justify-center p-4">
                     <img 
                       src={selectedPhoto.url} 
                       className={type === 'avatar' ? 'w-[80%] aspect-square object-cover rounded-full' : 'w-[90%] aspect-[3/1] object-cover'} 
                     />
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
                    classes={{
                      containerClassName: 'bg-[#111]',
                      cropAreaClassName: type === 'avatar' ? 'border-[1px] border-white/20 shadow-[0_0_0_9999em_rgba(0,0,0,0.5)]' : 'border border-white/30 shadow-[0_0_0_9999em_rgba(0,0,0,0.7)]'
                    }}
                    zoomWithScroll={true}
                  />
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                  {mode === 'gif' ? 'GIF tanlang' : 'Rasm tanlang'}
                </div>
              )}
              
              {/* Hint text at bottom of preview */}
              {mode === 'gallery' && (
                <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none z-10">
                  <span className="bg-black/60 backdrop-blur-md text-white/90 text-[11px] px-3 py-1.5 rounded-full font-medium">
                    Moslashtirish uchun suring yoki kichraytiring
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Grid */}
            <div className="flex-1 bg-black overflow-y-auto no-scrollbar flex flex-col">
              {mode === 'gallery' ? (
                <>
                  {!Capacitor.isNativePlatform() && (
                    <div className="p-4 flex flex-col items-center justify-center gap-3 bg-white/5 border-b border-white/10 shrink-0">
                      <p className="text-white/60 text-xs text-center">Tizim web formatida. Galereya o'rniga rasmlarni yuklang.</p>
                      <Button variant="outline" className="text-white border-white/20 hover:bg-white/10" onClick={() => fileInputRef.current?.click()}>
                        Rasm tanlash
                      </Button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFallbackUpload} />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-3 gap-[2px]">
                    {photos.map((photo) => (
                      <div 
                        key={photo.id} 
                        className="relative aspect-square cursor-pointer bg-white/5"
                        onClick={() => {
                          setSelectedPhoto(photo);
                          setCrop({ x: 0, y: 0 });
                          setZoom(1);
                        }}
                      >
                        <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        {selectedPhoto?.id === photo.id && (
                          <div className="absolute inset-0 bg-white/30 border-[3px] border-emerald-500 transition-all" />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-2 shrink-0">
                    <input 
                      type="text" 
                      placeholder="GIPHY'dan izlash..." 
                      value={gifSearchQuery}
                      onChange={(e) => setGifSearchQuery(e.target.value)}
                      className="w-full bg-[#222] text-white border-none rounded-xl h-10 px-4 focus:ring-1 focus:ring-[#8B5CF6] outline-none"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-[2px] p-0.5">
                    {isSearchingGif && gifs.length === 0 ? (
                      <div className="col-span-3 py-10 flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
                      </div>
                    ) : (
                      gifs.map((gif) => (
                        <div 
                          key={gif.id} 
                          className="relative aspect-square cursor-pointer bg-[#222]"
                          onClick={() => {
                            setSelectedPhoto({ id: gif.id, url: gif.url });
                          }}
                        >
                          <img src={gif.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {selectedPhoto?.id === gif.id && (
                            <div className="absolute inset-0 bg-white/20 border-[3px] border-[#8B5CF6] transition-all" />
                          )}
                        </div>
                      ))
                    )}
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
