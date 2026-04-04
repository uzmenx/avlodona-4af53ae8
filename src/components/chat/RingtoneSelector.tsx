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
      {/* Make sheet height adaptive but ensure safe bottom area */}
      <SheetContent side="bottom" className="h-auto max-h-[70vh] pb-8 rounded-t-3xl border-t-0 bg-background/95 backdrop-blur-3xl shadow-2xl">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold flex items-center justify-center gap-2">
            🔔 Qo'ng'iroq ovozi
          </SheetTitle>
        </SheetHeader>
        
        <div className="space-y-3 overflow-y-auto max-h-[calc(70vh-140px)] pb-safe scrollbar-hide px-1">
          {allOptions.map((ringtone) => (
            <div
              key={ringtone.id}
              className={cn(
                "group relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300",
                selected === ringtone.id
                  ? "bg-primary/10 border border-primary/30 shadow-inner"
                  : "bg-black/5 hover:bg-black/10 border border-transparent"
              )}
              onClick={() => handleSelect(ringtone.id)}
            >
              {/* Animated visualizer behind the button if playing */}
              <div className="relative">
                {playing === ringtone.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="absolute w-[180%] h-[180%] rounded-full border border-primary/40 animate-ping" style={{ animationDuration: '1.2s' }} />
                    <span className="absolute w-[250%] h-[250%] rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '1.2s', animationDelay: '0.2s' }} />
                  </div>
                )}
                
                <Button
                  variant={playing === ringtone.id ? 'default' : 'ghost'}
                  size="icon"
                  className={cn(
                    "relative z-10 h-10 w-10 rounded-full flex-shrink-0 transition-transform active:scale-95",
                    playing === ringtone.id ? "bg-primary shadow-lg shadow-primary/30" : "bg-black/10"
                  )}
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
              </div>

              <span className="flex-1 text-[15px] font-semibold">{ringtone.name}</span>
              
              {selected === ringtone.id ? (
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center animate-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-primary font-bold" />
                </div>
              ) : (
                <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20 group-hover:border-primary/40 transition-colors" />
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
