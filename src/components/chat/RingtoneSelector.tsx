import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Check, Play, Square, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  RINGTONE_OPTIONS, 
  getSelectedRingtone, 
  setSelectedRingtone, 
  previewRingtone, 
  stopRingtone 
} from '@/lib/pushNotifications';

interface RingtoneSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CUSTOM_RINGTONE_KEY = 'custom_ringtone_data';
const CUSTOM_RINGTONE_NAME_KEY = 'custom_ringtone_name';

export const RingtoneSelector = ({ open, onOpenChange }: RingtoneSelectorProps) => {
  const [selected, setSelected] = useState(getSelectedRingtone());
  const [playing, setPlaying] = useState<string | null>(null);
  const [customName, setCustomName] = useState<string | null>(
    () => localStorage.getItem(CUSTOM_RINGTONE_NAME_KEY)
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (id: string) => {
    setSelected(id);
    setSelectedRingtone(id);
    stopPreview();
  };

  const stopPreview = () => {
    stopRingtone();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(null);
  };

  const handlePreview = (id: string) => {
    if (playing === id) {
      stopPreview();
      return;
    }
    stopPreview();

    if (id === 'custom') {
      const dataUrl = localStorage.getItem(CUSTOM_RINGTONE_KEY);
      if (dataUrl) {
        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        audio.play();
        setPlaying('custom');
        audio.onended = () => setPlaying(null);
      }
    } else {
      previewRingtone(id);
      setPlaying(id);
      setTimeout(() => setPlaying(null), 3000);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 2MB for localStorage
    if (file.size > 2 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      localStorage.setItem(CUSTOM_RINGTONE_KEY, dataUrl);
      localStorage.setItem(CUSTOM_RINGTONE_NAME_KEY, file.name);
      setCustomName(file.name);
      handleSelect('custom');
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const handleClose = (val: boolean) => {
    if (!val) stopPreview();
    onOpenChange(val);
  };

  const allOptions = [
    ...RINGTONE_OPTIONS,
    ...(customName ? [{ id: 'custom', name: `🎵 ${customName}` }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-[55vh]">
        <SheetHeader>
          <SheetTitle>🔔 Qo'ng'iroq ovozi</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(55vh-120px)]">
          {allOptions.map((ringtone) => (
            <div
              key={ringtone.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors",
                selected === ringtone.id
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted"
              )}
              onClick={() => handleSelect(ringtone.id)}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreview(ringtone.id);
                }}
              >
                {playing === ringtone.id ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <span className="flex-1 text-sm font-medium">{ringtone.name}</span>
              {selected === ringtone.id && (
                <Check className="h-5 w-5 text-primary flex-shrink-0" />
              )}
            </div>
          ))}

          {/* Local file picker */}
          <div
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-muted border border-dashed border-muted-foreground/30"
            onClick={handleFileSelect}
          >
            <div className="h-9 w-9 rounded-full flex-shrink-0 flex items-center justify-center bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium text-muted-foreground">
              Qurilmadan musiqa tanlash...
            </span>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </SheetContent>
    </Sheet>
  );
};
