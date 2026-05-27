import { useState, useEffect, useRef } from 'react';
import { ImagePlus, Calendar } from 'lucide-react';
import { AddMemberData, AddMemberType } from '@/types/family';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ImageCropper } from '@/components/profile/ImageCropper';
import { compressImage, uploadToR2 } from '@/lib/r2Upload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: AddMemberData) => void;
  type: AddMemberType;
  gender?: 'male' | 'female';
  title: string;
  showNextPrompt?: boolean;
  nextPromptText?: string;
}

const YearScrollPicker = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1850 + 1 }, (_, i) => currentYear - i);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && activeRef.current && containerRef.current) {
      setTimeout(() => {
        activeRef.current?.scrollIntoView({
          behavior: 'instant' as any,
          block: 'center',
        });
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (year: number) => {
    onChange(year.toString());
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-full rounded-xl border border-white/10 bg-background/30 backdrop-blur-xl px-3 flex items-center justify-between text-left text-xs hover:bg-white/5 transition-colors focus:outline-none text-muted-foreground"
      >
        <span className={cn(value && "text-foreground font-medium")}>
          {value ? `${value}-yil` : placeholder}
        </span>
        <Calendar className="h-3.5 w-3.5 opacity-55" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-full min-w-[110px] p-1 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[999]">
          <div 
            ref={containerRef}
            className="h-40 overflow-y-auto relative py-16 scrollbar-none flex flex-col items-center"
          >
            {/* Overlay fade effect */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#1a1a1a] via-[#1a1a1a]/65 to-transparent z-10 border-t rounded-t-2xl border-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/65 to-transparent z-10 border-b rounded-b-2xl border-transparent" />
            
            {/* Active selection center line */}
            <div className="absolute top-[64px] left-0 right-0 h-8 border-y border-white/10 pointer-events-none bg-white/5" />

            {years.map((year) => {
              const isSelected = value === year.toString();
              return (
                <button
                  key={year}
                  ref={isSelected ? activeRef : null}
                  type="button"
                  onClick={() => handleSelect(year)}
                  className={cn(
                    "w-full h-8 text-center text-xs transition-all focus:outline-none flex items-center justify-center font-medium",
                    isSelected 
                      ? "text-foreground text-sm font-bold scale-110 z-20" 
                      : "text-muted-foreground/50 hover:text-foreground/80 scale-95"
                  )}
                >
                  {year}
                </button>
              );
            })}
          </div>
          {value && (
            <div className="border-t border-white/5 p-1 flex justify-center">
              <button 
                type="button" 
                onClick={() => { onChange(''); setIsOpen(false); }}
                className="text-[9px] text-red-400 hover:text-red-300 font-semibold py-1 px-2 w-full text-center"
              >
                Tozalash
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AddMemberModal = ({
  isOpen,
  onClose,
  onSave,
  type,
  gender: initialGender = 'male',
  title,
}: AddMemberModalProps) => {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [deathYear, setDeathYear] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>(initialGender);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cropperState, setCropperState] = useState<{ isOpen: boolean; imageUrl: string }>({
    isOpen: false,
    imageUrl: '',
  });
  const photoInputRef = useRef<HTMLInputElement>(null);

  const gender = type === 'child' ? selectedGender : initialGender;

  useEffect(() => {
    if (isOpen) {
      setName('');
      setBirthYear('');
      setDeathYear('');
      setPhotoUrl('');
      setHasChanges(false);
      setSelectedGender(initialGender);
      setIsUploadingPhoto(false);
      setCropperState({ isOpen: false, imageUrl: '' });
    }
  }, [isOpen, initialGender]);

  useEffect(() => {
    const hasAnyValue = name || birthYear || deathYear || photoUrl;
    setHasChanges(!!hasAnyValue);
  }, [name, birthYear, deathYear, photoUrl]);

  const handleSave = () => {
    onSave({
      name: name || "Noma'lum",
      birthYear: birthYear ? parseInt(birthYear) : undefined,
      deathYear: deathYear ? parseInt(deathYear) : undefined,
      gender,
      photoUrl: photoUrl || undefined,
    });
  };

  const handleLater = () => {
    onSave({
      name: '',
      gender,
    });
  };

  const handlePhotoClick = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropperState({ isOpen: true, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const uploadCroppedAvatar = async (croppedUrl: string): Promise<void> => {
    try {
      setIsUploadingPhoto(true);
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], `family_member_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 1024, 1024, 0.98);
      const url = await uploadToR2(compressed, 'family-members', `tmp_${Date.now()}`);
      setPhotoUrl(url);
    } finally {
      setIsUploadingPhoto(false);
      URL.revokeObjectURL(croppedUrl);
    }
  };

  const getNamePlaceholder = () => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes("ota")) return "Otaning ismini kiriting";
    if (lowerTitle.includes("ona")) return "Onaning ismini kiriting";
    if (lowerTitle.includes("farzand")) return "Farzand ismini kiriting";
    if (lowerTitle.includes("juft")) return "Juftingiz ismini kiriting";
    return "Ism kiriting";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        overlayClassName="bg-black/0"
        hideCloseButton
        className="w-[86vw] max-w-[300px] max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden rounded-[26px] border border-white/10 bg-background/40 backdrop-blur-2xl p-3.5 shadow-[0_22px_70px_-44px_rgba(0,0,0,0.9)] focus-visible:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 h-7 w-7 rounded-xl inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors z-50"
          aria-label="Yopish"
        >
          <span className="text-lg leading-none">×</span>
        </button>

        <div className="flex-1 min-h-0 space-y-3.5 py-1.5 overflow-y-auto pr-1">
          {/* Photo */}
          <div className="flex justify-center mt-2">
            <div 
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden',
                'transition-all duration-200 hover:scale-105',
                'ring-4 bg-background',
                gender === 'male' ? 'ring-sky-400/60' : 'ring-pink-400/60'
              )}
              onClick={handlePhotoClick}
            >
              <div
                className={cn(
                  'absolute inset-0 opacity-30',
                  gender === 'male'
                    ? 'bg-gradient-to-br from-sky-500/40 via-cyan-500/20 to-indigo-500/30'
                    : 'bg-gradient-to-br from-pink-500/40 via-rose-500/20 to-fuchsia-500/30'
                )}
              />
              {photoUrl ? (
                <img 
                  src={photoUrl} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="text-center relative">
                  <ImagePlus className={cn(
                    "w-5.5 h-5.5 mx-auto",
                    gender === 'male' ? "text-sky-500" : "text-pink-500"
                  )} />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block font-semibold">Rasm</span>
                  <span className="text-[8px] text-muted-foreground/70 block">Galereya</span>
                </div>
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoFileSelect}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-background/30 backdrop-blur-xl p-3 space-y-3">

          {/* Gender Selection for Child */}
          {type === 'child' && (
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant={selectedGender === 'male' ? 'default' : 'outline'}
                onClick={() => setSelectedGender('male')}
                className={cn(
                  "flex-1 h-9 rounded-xl text-xs",
                  selectedGender === 'male' && "bg-sky-500 hover:bg-sky-600"
                )}
              >
                O'g'il
              </Button>
              <Button
                type="button"
                variant={selectedGender === 'female' ? 'default' : 'outline'}
                onClick={() => setSelectedGender('female')}
                className={cn(
                  "flex-1 h-9 rounded-xl text-xs",
                  selectedGender === 'female' && "bg-pink-500 hover:bg-pink-600"
                )}
              >
                Qiz
              </Button>
            </div>
          )}

          {/* Name Input */}
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={getNamePlaceholder()}
            autoFocus
            className="h-10 rounded-xl text-xs"
          />

          {/* Year Scroll Pickers */}
          <div className="flex gap-2">
            <YearScrollPicker
              value={birthYear}
              onChange={setBirthYear}
              placeholder="Tug'ilgan yil"
            />
            <YearScrollPicker
              value={deathYear}
              onChange={setDeathYear}
              placeholder="Vafot yil"
            />
          </div>

          {/* Action Buttons */}
          <div className="sticky bottom-0 -mx-4 px-4 pt-1.5 pb-0.5 bg-transparent backdrop-blur-0 border-t border-transparent">
            <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={handleLater}
              className="flex-1 rounded-xl h-10 text-xs"
            >
              Keyinroq
            </Button>
            {hasChanges && (
              <Button
                onClick={handleSave}
                className="flex-1 rounded-xl h-10 text-xs"
              >
                Saqlash
              </Button>
            )}
            </div>
          </div>

          </div>
        </div>

        <ImageCropper
          isOpen={cropperState.isOpen}
          onClose={() => setCropperState((p) => ({ ...p, isOpen: false }))}
          imageUrl={cropperState.imageUrl}
          aspectRatio={1}
          shape="circle"
          onCropComplete={uploadCroppedAvatar}
          title="Rasmni tanlash"
        />
      </DialogContent>
    </Dialog>
  );
};
