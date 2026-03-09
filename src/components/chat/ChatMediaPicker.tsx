import { useRef } from 'react';
import { Paperclip, Image, Video, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ChatMediaPickerProps {
  selectedMedia: MediaFile | null;
  onMediaSelect: (media: MediaFile | null) => void;
}

export const ChatMediaPicker = ({ selectedMedia, onMediaSelect }: ChatMediaPickerProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    onMediaSelect({ file, preview, type });
    
    // Reset input
    e.target.value = '';
  };

  const handleRemove = () => {
    if (selectedMedia?.preview) {
      URL.revokeObjectURL(selectedMedia.preview);
    }
    onMediaSelect(null);
  };

  if (selectedMedia) {
    return (
      <div className="relative inline-block">
        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted">
          {selectedMedia.type === 'image' ? (
            <img 
              src={selectedMedia.preview} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <video 
              src={selectedMedia.preview} 
              className="w-full h-full object-cover"
            />
          )}
          <button
            onClick={handleRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs py-0.5 text-center">
            {selectedMedia.type === 'image' ? 'Rasm' : 'Video'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'image')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFileSelect(e, 'video')}
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
            <Image className="h-4 w-4 mr-2" />
            Rasm
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
            <Video className="h-4 w-4 mr-2" />
            Video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
