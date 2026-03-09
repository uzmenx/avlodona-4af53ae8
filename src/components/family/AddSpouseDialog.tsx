import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Heart } from 'lucide-react';
import { FamilyMember } from '@/hooks/useFamilyTree';
import { cn } from '@/lib/utils';

interface AddSpouseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMember: FamilyMember | null;
  isSecondSpouse: boolean;
  onAddSpouse: (spouseData: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => void;
}

export const AddSpouseDialog = ({
  open,
  onOpenChange,
  targetMember,
  isSecondSpouse,
  onAddSpouse,
}: AddSpouseDialogProps) => {
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  if (!targetMember) return null;

  // Spouse gender is opposite of target member's gender
  const targetGender = targetMember.linked_profile?.gender as 'male' | 'female' | null || targetMember.gender;
  const spouseGender: 'male' | 'female' = targetGender === 'male' ? 'female' : 'male';
  
  const getGenderColors = (gender: 'male' | 'female') => {
    if (gender === 'male') {
      return {
        ring: 'ring-sky-400',
        bg: 'bg-sky-500',
        border: 'border-sky-400',
        text: 'text-sky-500',
      };
    }
    return {
      ring: 'ring-pink-400',
      bg: 'bg-pink-500',
      border: 'border-pink-400',
      text: 'text-pink-500',
    };
  };

  const spouseColors = getGenderColors(spouseGender);
  const targetColors = getGenderColors(targetGender || 'male');

  const handleSubmit = () => {
    if (name.trim()) {
      onAddSpouse({
        name: name.trim(),
        gender: spouseGender,
        avatarUrl: avatarUrl || undefined,
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setName('');
    setAvatarUrl('');
    onOpenChange(false);
  };

  const targetName = targetMember.linked_profile?.name || targetMember.member_name;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {isSecondSpouse ? 'Ikkinchi juft qo\'shish' : 'Juft qo\'shish'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Visual representation of the couple */}
          <div className="flex items-center justify-center gap-3">
            {/* Target member */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn("rounded-full p-0.5", targetColors.ring, "ring-2")}>
                <Avatar className={cn("h-16 w-16 border-2", targetColors.border)}>
                  <AvatarImage src={targetMember.linked_profile?.avatar_url || targetMember.avatar_url || undefined} />
                  <AvatarFallback className={cn(targetColors.bg, "text-white text-lg")}>
                    {targetName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs font-medium">{targetName}</p>
            </div>

            {/* Heart connector */}
            <Heart className="h-6 w-6 text-red-500 fill-red-500" />

            {/* New spouse preview */}
            <div className="flex flex-col items-center gap-1">
              <div className={cn("rounded-full p-0.5", spouseColors.ring, "ring-2")}>
                <Avatar className={cn("h-16 w-16 border-2", spouseColors.border)}>
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className={cn(spouseColors.bg, "text-white text-lg")}>
                    {name ? name.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs font-medium">{name || '?'}</p>
            </div>
          </div>

          {/* Gender indicator */}
          <div className="flex justify-center">
            <span className={cn(
              "px-3 py-1 rounded-full text-sm font-medium",
              spouseGender === 'male' 
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' 
                : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
            )}>
              {spouseGender === 'male' ? 'Erkak' : 'Ayol'}
            </span>
          </div>

          {/* Avatar URL input */}
          <div className="space-y-2">
            <Label htmlFor="spouse-avatar">Rasm URL (ixtiyoriy)</Label>
            <Input
              id="spouse-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <Label htmlFor="spouse-name">Juftning ismi</Label>
            <Input
              id="spouse-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ismini kiriting..."
              className={cn("border-2", spouseColors.border, "focus:ring-2", spouseColors.ring)}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
              Bekor qilish
            </Button>
            <Button 
              type="button" 
              className={cn("flex-1", spouseColors.bg, "hover:opacity-90")}
              onClick={handleSubmit}
              disabled={!name.trim()}
            >
              <Heart className="h-4 w-4 mr-2" />
              Qo'shish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
