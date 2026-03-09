import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface ChannelVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (visibility: 'public' | 'private', inviteLink: string) => void;
  onBack: () => void;
}

export const ChannelVisibilityDialog = ({ 
  open, 
  onOpenChange, 
  onComplete,
  onBack
}: ChannelVisibilityDialogProps) => {
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [inviteLink, setInviteLink] = useState('');

  const handleComplete = () => {
    onComplete(visibility, inviteLink);
    setVisibility('public');
    setInviteLink('');
  };

  const handleCancel = () => {
    setVisibility('public');
    setInviteLink('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kanal turi</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup 
            value={visibility} 
            onValueChange={(v) => setVisibility(v as 'public' | 'private')}
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="public" id="public" className="mt-1" />
              <Label htmlFor="public" className="cursor-pointer flex-1">
                <div className="font-medium">Ommaviy kanal</div>
                <div className="text-sm text-muted-foreground">
                  Har kim qidiruv orqali topib, a'zo bo'lishi mumkin
                </div>
              </Label>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="private" id="private" className="mt-1" />
              <Label htmlFor="private" className="cursor-pointer flex-1">
                <div className="font-medium">Yopiq kanal</div>
                <div className="text-sm text-muted-foreground">
                  Faqat taklif havolasi orqali a'zo bo'lish mumkin
                </div>
              </Label>
            </div>
          </RadioGroup>

          {visibility === 'public' && (
            <div className="space-y-2">
              <Label>Havola</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">app.me/</span>
                <Input
                  placeholder="kanal_nomi"
                  value={inviteLink}
                  onChange={(e) => setInviteLink(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={onBack}>
            O'tkazib yuborish
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleCancel}>
              Bekor qilish
            </Button>
            <Button onClick={handleComplete}>
              Saqlash
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
