import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${type}s/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('group-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('group-avatars')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (!name.trim()) return;
    onNext(name.trim(), description.trim(), avatarUrl);
    setName('');
    setDescription('');
    setAvatarUrl(null);
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setAvatarUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === 'group' ? 'Yangi guruh' : 'Yangi kanal'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Avatar picker */}
          <div 
            onClick={handleAvatarClick}
            className="relative cursor-pointer group"
          >
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10">
                <Camera className="h-8 w-8 text-primary" />
              </AvatarFallback>
            </Avatar>
            {avatarUrl && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 text-white" />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Name input */}
          <div className="w-full space-y-2">
            <Input
              placeholder={type === 'group' ? 'Guruh nomi' : 'Kanal nomi'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUploading}
            />
          </div>

          {/* Description (only for channels) */}
          {type === 'channel' && (
            <div className="w-full space-y-2">
              <Textarea
                placeholder="Tavsif (ixtiyoriy)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={isUploading}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            Bekor qilish
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!name.trim() || isUploading}
          >
            Keyingisi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
