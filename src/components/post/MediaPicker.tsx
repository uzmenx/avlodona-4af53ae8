import { useRef } from 'react';
import { Image, Video, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface MediaPickerProps {
  selectedMedia: MediaFile[];
  onMediaChange: (media: MediaFile[]) => void;
  maxFiles?: number;
}

export const MediaPicker = ({ 
  selectedMedia, 
  onMediaChange, 
  maxFiles = 5 
}: MediaPickerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newMedia: MediaFile[] = [];
    const remainingSlots = maxFiles - selectedMedia.length;

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (isVideo || isImage) {
        newMedia.push({
          file,
          preview: URL.createObjectURL(file),
          type: isVideo ? 'video' : 'image',
        });
      }
    });

    onMediaChange([...selectedMedia, ...newMedia]);
    e.target.value = '';
  };

  const removeMedia = (index: number) => {
    const updated = [...selectedMedia];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    onMediaChange(updated);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {selectedMedia.length === 0 ? (
        <div 
          onClick={openFilePicker}
          className="flex flex-col items-center justify-center h-80 bg-muted/50 rounded-xl border-2 border-dashed border-border cursor-pointer hover:bg-muted/70 transition-colors"
        >
          <div className="flex gap-4 mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Image className="h-8 w-8 text-primary" />
            </div>
            <div className="p-4 rounded-full bg-primary/10">
              <Video className="h-8 w-8 text-primary" />
            </div>
          </div>
          <p className="text-lg font-medium">Rasm yoki video tanlang</p>
          <p className="text-sm text-muted-foreground mt-1">
            5 tagacha fayl tanlash mumkin
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {selectedMedia.map((media, index) => (
              <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                {media.type === 'image' ? (
                  <img 
                    src={media.preview} 
                    alt={`Selected ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video 
                    src={media.preview}
                    className="w-full h-full object-cover"
                  />
                )}
                <button
                  onClick={() => removeMedia(index)}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
                {media.type === 'video' && (
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-background/80 rounded text-xs">
                    Video
                  </div>
                )}
              </div>
            ))}
            
            {selectedMedia.length < maxFiles && (
              <button
                onClick={openFilePicker}
                className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
              >
                <div className="text-center">
                  <Image className="h-6 w-6 mx-auto text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    +{maxFiles - selectedMedia.length}
                  </span>
                </div>
              </button>
            )}
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{selectedMedia.length}/{maxFiles} fayl tanlandi</span>
            <div className="flex gap-2">
              {selectedMedia.map((media, index) => (
                <div 
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full",
                    "bg-primary"
                  )}
                />
              ))}
              {Array.from({ length: maxFiles - selectedMedia.length }).map((_, index) => (
                <div 
                  key={index}
                  className="w-2 h-2 rounded-full bg-muted"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
