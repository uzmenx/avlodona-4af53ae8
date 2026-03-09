import { useState, useEffect, useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { AddMemberData, AddMemberType } from '@/types/family';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ImageCropper } from '@/components/profile/ImageCropper';
import { compressImage, uploadToR2 } from '@/lib/r2Upload';

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

export const AddMemberModal = ({
  isOpen,
  onClose,
  onSave,
  type,
  gender: initialGender = 'male',
  title,
  showNextPrompt,
  nextPromptText,
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
      const compressed = await compressImage(file);
      const url = await uploadToR2(compressed, 'family-members', `tmp_${Date.now()}`);
      setPhotoUrl(url);
    } finally {
      setIsUploadingPhoto(false);
      URL.revokeObjectURL(croppedUrl);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        overlayClassName="bg-black/0"
        hideCloseButton
        className="sm:max-w-md max-h-[85vh] overflow-hidden rounded-3xl border-white/10 bg-background/40 backdrop-blur-2xl shadow-[0_22px_70px_-44px_rgba(0,0,0,0.9)]"
      >
        <DialogHeader className="relative">
          <DialogTitle className="text-center text-base font-extrabold tracking-tight">{title}</DialogTitle>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-0 top-0 h-9 w-9 rounded-2xl inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Yopish"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </DialogHeader>

        <div className="space-y-5 py-4 overflow-y-auto pr-1">
          {/* Photo */}
          <div className="flex justify-center">
            <div 
              className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden',
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
                    "w-8 h-8 mx-auto",
                    gender === 'male' ? "text-sky-500" : "text-pink-500"
                  )} />
                  <span className="text-[11px] text-muted-foreground mt-1 block font-semibold">Rasm</span>
                  <span className="text-[10px] text-muted-foreground/70 block">Galereya</span>
                </div>
              )}
              {isUploadingPhoto && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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

          <div className="rounded-3xl border border-white/10 bg-background/30 backdrop-blur-xl p-4 space-y-4">

          {/* Gender Selection for Child */}
          {type === 'child' && (
            <div className="flex gap-2 justify-center">
              <Button
                type="button"
                variant={selectedGender === 'male' ? 'default' : 'outline'}
                onClick={() => setSelectedGender('male')}
                className={cn(
                  "flex-1 h-11 rounded-2xl",
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
                  "flex-1 h-11 rounded-2xl",
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
            placeholder="Ism kiriting"
            autoFocus
            className="h-11 rounded-2xl"
          />

          {/* Year Inputs */}
          <div className="flex gap-3">
            <Input
              type="number"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="Tug'ilgan yil"
              min="1800"
              max={new Date().getFullYear()}
              inputMode="numeric"
              className="h-11 rounded-2xl"
            />
            <Input
              type="number"
              value={deathYear}
              onChange={(e) => setDeathYear(e.target.value)}
              placeholder="Vafot yil"
              min="1800"
              max={new Date().getFullYear()}
              inputMode="numeric"
              className="h-11 rounded-2xl"
            />
          </div>

          {/* Next Prompt Info */}
          {showNextPrompt && nextPromptText && (
            <div className="bg-primary/10 rounded-xl p-3 text-sm text-primary">
              {nextPromptText}
            </div>
          )}

          {/* Action Buttons */}
          <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-transparent backdrop-blur-0 border-t border-transparent">
            <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleLater}
              className="flex-1 rounded-2xl h-11"
            >
              Keyinroq
            </Button>
            {hasChanges && (
              <Button
                onClick={handleSave}
                className="flex-1 rounded-2xl h-11"
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
