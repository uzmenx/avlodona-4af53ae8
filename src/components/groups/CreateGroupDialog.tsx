import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ImageCropper } from '@/components/profile';
import { uploadToR2, compressImage } from '@/lib/r2Upload';
import { useLanguage } from '@/contexts/LanguageContext';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'group' | 'channel';
  onNext: (name: string, description: string, avatarUrl: string | null) => void;
}

export const CreateGroupDialog = ({ 
  open, 
  onOpenChange, 
  type,
  onNext 
}: CreateGroupDialogProps) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a GIF
    const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
    
    if (isGif) {
      setIsUploading(true);
      try {
        const url = await uploadToR2(file, `group-avatars/${Date.now()}`);
        setAvatarUrl(url);
      } catch (error) {
        console.error('Error uploading GIF avatar:', error);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageUrl(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedUrl: string) => {
    setIsUploading(true);
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const file = new File([blob], `avatar_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 1024, 1024, 0.98);
      const url = await uploadToR2(compressed, `group-avatars/${Date.now()}`);
      setAvatarUrl(url);
    } catch (error) {
      console.error('Error uploading cropped avatar:', error);
    } finally {
      setIsUploading(false);
      setCropperOpen(false);
    }
  };

  const handleNext = () => {
    if (!name.trim()) return;
    onNext(name.trim(), description.trim(), avatarUrl);
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setAvatarUrl(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md border-white/10 bg-background/60 backdrop-blur-2xl p-0 overflow-hidden rounded-[32px] shadow-2xl">
          <div className="relative">
            {/* Header glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent blur-sm" />
            
            <div className="px-6 pt-6 pb-2 text-center">
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  {type === 'group' ? t('newGroup') || 'Yangi guruh' : t('newChannel') || 'Yangi kanal'}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {type === 'group' ? 'Oila a\'zolari uchun muloqot maydoni' : 'Muhim yangiliklar va xabarlar uchun'}
                </p>
              </DialogHeader>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-6 flex flex-col items-center gap-8"
            >
              {/* Avatar picker */}
              <div 
                onClick={handleAvatarClick}
                className="relative cursor-pointer group"
              >
                <div className={cn(
                  "absolute -inset-1 rounded-full bg-gradient-to-tr from-primary/40 to-violet-500/40 opacity-0 group-hover:opacity-100 blur transition duration-500",
                  avatarUrl && "opacity-40"
                )} />
                
                <div className="relative h-24 w-24 rounded-full p-1 bg-background/50 backdrop-blur-md border border-white/10 ring-1 ring-white/5 shadow-xl">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={avatarUrl || undefined} className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-violet-500/10">
                      {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
                      ) : (
                        <Camera className="h-8 w-8 text-primary/60" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background scale-90 group-hover:scale-100 transition-transform">
                    <Camera className="h-4 w-4" />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="w-full space-y-5">
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">
                    {type === 'group' ? 'Guruh nomi' : t('channelName') || 'Kanal nomi'}
                  </div>
                  <Input
                    placeholder={type === 'group' ? 'Masalan: Oila a\'zolari' : t('namePlaceholder') || 'Kanal nomi'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isUploading}
                    className="h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-muted-foreground/30"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-1">
                    Tavsif
                  </div>
                  <Textarea
                    placeholder="Tavsif kiriting (ixtiyoriy)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    disabled={isUploading}
                    className="bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 focus:border-primary/40 transition-all resize-none placeholder:text-muted-foreground/30"
                  />
                </div>
              </div>
            </motion.div>

            <div className="px-6 pb-6 pt-2 flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={handleCancel}
                className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
              >
                {t('cancel') || 'Bekor qilish'}
              </Button>
              <Button 
                onClick={handleNext} 
                disabled={!name.trim() || isUploading}
                className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
              >
                <span>{t('next') || 'Keyingisi'}</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageCropper
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageUrl={tempImageUrl || ''}
        aspectRatio={1}
        shape="circle"
        onCropComplete={handleCropComplete}
        title="Rasm kesish"
      />
    </>
  );
};
