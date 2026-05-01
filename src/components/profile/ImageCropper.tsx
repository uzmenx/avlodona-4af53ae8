import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import getCroppedImg from '@/lib/cropImage';

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  aspectRatio: number;
  shape?: 'circle' | 'rect';
  onCropComplete: (croppedImageUrl: string) => Promise<void>;
  title?: string;
}

export const ImageCropper = ({
  isOpen,
  onClose,
  imageUrl,
  aspectRatio,
  shape = 'rect',
  onCropComplete,
  title = 'Rasmni kesish'
}: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onCropChange = useCallback((crop: { x: number, y: number }) => {
    setCrop(crop);
  }, []);

  const onCropCompleteHandler = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsLoading(true);
      const croppedUrl = await getCroppedImg(imageUrl, croppedAreaPixels, rotation);
      await onCropComplete(croppedUrl);
      onClose();
    } catch (error) {
      console.error('Crop error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        aria-describedby={undefined}
        className="sm:max-w-xl max-h-[95vh] w-[95vw] flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-2xl"
      >
        <DialogHeader className="p-4 border-b border-border/50 bg-background z-10 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 opacity-70" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative w-full h-[50vh] sm:h-[400px] bg-black/90 shrink-0">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspectRatio}
            cropShape={shape === 'circle' ? 'round' : 'rect'}
            showGrid={shape !== 'circle'}
            onCropChange={onCropChange}
            onCropComplete={onCropCompleteHandler}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            classes={{
              containerClassName: 'bg-black/90',
              cropAreaClassName: 'border-2 border-primary shadow-[0_0_0_9999em_rgba(0,0,0,0.6)]'
            }}
          />
        </div>

        <div className="p-4 bg-background z-10 shrink-0 flex flex-col gap-4">
          <div className="flex items-center gap-4 px-3">
            <button 
              type="button" 
              onClick={() => setZoom(z => Math.max(1, z - 0.2))}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <button 
              type="button" 
              onClick={() => setZoom(z => Math.min(3, z + 0.2))}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button variant="outline" className="rounded-full px-6" onClick={onClose} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Bekor qilish
            </Button>
            
            <Button 
              className="rounded-full px-8 shadow-md" 
              onClick={handleConfirm} 
              disabled={isLoading || !croppedAreaPixels}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Saqlash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};