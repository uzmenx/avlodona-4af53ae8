import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ChatMediaPickerProps {
  selectedMedia: MediaFile[];
  onMediaSelect: (media: MediaFile[]) => void;
}

export const ChatMediaPicker = ({ selectedMedia, onMediaSelect }: ChatMediaPickerProps) => {
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaItems: MediaFile[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image'
    }));

    onMediaSelect([...selectedMedia, ...newMediaItems]);
    
    // Reset input
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    const itemToRemove = selectedMedia[index];
    if (itemToRemove?.preview) {
      URL.revokeObjectURL(itemToRemove.preview);
    }
    const newMedia = [...selectedMedia];
    newMedia.splice(index, 1);
    onMediaSelect(newMedia);
  };

  if (selectedMedia.length > 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {selectedMedia.map((media, index) => (
          <div key={index} className="relative inline-block">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border/30">
              {media.type === 'image' ? (
                <img 
                  src={media.preview} 
                  alt="Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <video 
                  src={media.preview} 
                  className="w-full h-full object-cover"
                />
              )}
              <button
                onClick={() => handleRemove(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] py-0.5 text-center">
                {media.type === 'image' ? 'Rasm' : 'Video'}
              </div>
            </div>
          </div>
        ))}
        <Button 
          variant="outline" 
          size="icon" 
          className="w-20 h-20 rounded-lg border-dashed border-2 flex flex-col gap-1 items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all"
          onClick={() => mediaInputRef.current?.click()}
        >
          <Paperclip className="h-6 w-6" />
          <span className="text-[10px]">Yana</span>
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={mediaInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-10 w-10 text-muted-foreground"
        onClick={() => mediaInputRef.current?.click()}
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    </>
  );
};
