import { useState, useEffect } from 'react';
import { GalleryAsset, useGallery } from '@/hooks/useGallery';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GalleryPickerProps {
  maxSelection?: number;
  onConfirm: (assets: GalleryAsset[]) => void;
  onClose: () => void;
}

export default function GalleryPicker({ maxSelection = 10, onConfirm, onClose }: GalleryPickerProps) {
  const { assets, requestPermission, permission } = useGallery();
  const [selected, setSelected] = useState<GalleryAsset[]>([]);

  useEffect(() => {
    if (permission === 'prompt') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const toggleSelect = (asset: GalleryAsset) => {
    const isSelected = selected.some(a => a.identifier === asset.identifier);
    if (isSelected) {
      setSelected(selected.filter(a => a.identifier !== asset.identifier));
    } else {
      if (selected.length < maxSelection) {
        setSelected([...selected, asset]);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="font-semibold">Galereya</div>
        <Button 
          variant="ghost" 
          className="text-primary font-semibold"
          disabled={selected.length === 0}
          onClick={() => onConfirm(selected)}
        >
          Qo'shish ({selected.length})
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-1 p-1">
          {assets.map(asset => {
            const isSelected = selected.some(a => a.identifier === asset.identifier);
            const index = selected.findIndex(a => a.identifier === asset.identifier);
            return (
              <div 
                key={asset.identifier} 
                className="relative aspect-square cursor-pointer overflow-hidden bg-muted"
                onClick={() => toggleSelect(asset)}
              >
                {asset.mediaType === 'video' ? (
                  /* Use thumbnail for video — avoids ugly browser default play icon */
                  asset.thumbnail ? (
                    <img src={asset.thumbnail} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <video
                      src={asset.webUrl}
                      className="w-full h-full object-cover"
                      preload="none"
                      muted
                      playsInline
                    />
                  )
                ) : (
                  <img src={asset.webUrl} className="w-full h-full object-cover" alt="" />
                )}
                
                {/* Selection Indicator */}
                <div className="absolute top-1 right-1">
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    isSelected 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "border-white/70 bg-black/20"
                  )}>
                    {isSelected && <span className="text-xs font-medium">{index + 1}</span>}
                  </div>
                </div>

                {/* Video Duration */}
                {asset.mediaType === 'video' && asset.duration && (
                  <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/60 px-1 rounded">
                    {Math.floor(asset.duration / 60)}:{(asset.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}