import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AddFamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  gender?: 'male' | 'female' | null;
  showGenderSelect?: boolean;
  onAdd: (data: { name: string; gender: 'male' | 'female'; avatarUrl?: string }) => void;
}

export const AddFamilyMemberDialog = ({
  open,
  onOpenChange,
  title,
  gender: fixedGender,
  showGenderSelect = false,
  onAdd,
}: AddFamilyMemberDialogProps) => {
  const [name, setName] = useState('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>(fixedGender || 'male');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      gender: fixedGender || selectedGender,
    });
    setName('');
    setSelectedGender(fixedGender || 'male');
    onOpenChange(false);
  };

  const handleClose = () => {
    setName('');
    setSelectedGender(fixedGender || 'male');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Yangi odam ma'lumotlarini kiriting
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ism</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ism kiriting"
              autoFocus
            />
          </div>

          {showGenderSelect && !fixedGender && (
            <div className="space-y-2">
              <Label>Jinsi</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={selectedGender === 'male' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1",
                    selectedGender === 'male' && "bg-sky-500 hover:bg-sky-600"
                  )}
                  onClick={() => setSelectedGender('male')}
                >
                  Erkak
                </Button>
                <Button
                  type="button"
                  variant={selectedGender === 'female' ? 'default' : 'outline'}
                  className={cn(
                    "flex-1",
                    selectedGender === 'female' && "bg-pink-500 hover:bg-pink-600"
                  )}
                  onClick={() => setSelectedGender('female')}
                >
                  Ayol
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim()}
            >
              Qo'shish
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
