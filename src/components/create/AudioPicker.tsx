import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Music, X, Play, Pause, Upload } from 'lucide-react';

interface AudioPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (file: File) => void;
  selectedAudio: File | null;
  onRemove: () => void;
}

export const AudioPicker = ({ open, onOpenChange, onSelect, selectedAudio, onRemove }: AudioPickerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onSelect(file);
      onOpenChange(false);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !selectedAudio) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <>
      {/* Inline preview when audio selected */}
      {selectedAudio && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
          <button onClick={togglePlay} className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            {isPlaying ? <Pause className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5 text-primary" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedAudio.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(selectedAudio.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
          <button onClick={onRemove} className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <audio
            ref={audioRef}
            src={URL.createObjectURL(selectedAudio)}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-base">Musiqa tanlash</SheetTitle>
          </SheetHeader>

          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Telefoningizdan MP3 yoki boshqa audio faylni tanlang
            </p>

            <Button
              onClick={() => inputRef.current?.click()}
              className="w-full h-12 rounded-xl gap-2"
              variant="outline"
            >
              <Upload className="h-5 w-5" />
              Audio fayl tanlash
            </Button>

            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-[10px] text-muted-foreground text-center">
              MP3, AAC, WAV formatlarini qo'llab-quvvatlaydi
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
