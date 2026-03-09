import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, User } from 'lucide-react';
import { Relative } from '@/types';

interface AddRelativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (relative: Omit<Relative, 'id' | 'user_id' | 'created_at'>) => void;
  relatives: Relative[];
}

type Step = 'name' | 'relation';

// Male relations
const maleRelationTypes = [
  { value: 'father', label: 'Ota' },
  { value: 'grandfather', label: 'Bobo (Otamning otasi)' },
  { value: 'brother', label: 'Aka' },
  { value: 'younger_brother', label: 'Ukasi' },
  { value: 'son', label: "O'g'il" },
  { value: 'uncle', label: "Tog'a/Amaki" },
  { value: 'nephew', label: 'Jiyan (erkak)' },
  { value: 'grandson', label: 'Nevara (erkak)' },
  { value: 'husband', label: 'Er' },
];

// Female relations
const femaleRelationTypes = [
  { value: 'mother', label: 'Ona' },
  { value: 'grandmother', label: 'Momo (Onamning onasi)' },
  { value: 'sister', label: 'Opa' },
  { value: 'younger_sister', label: 'Singil' },
  { value: 'daughter', label: 'Qiz' },
  { value: 'aunt', label: 'Xola/Amma' },
  { value: 'niece', label: 'Jiyan (ayol)' },
  { value: 'granddaughter', label: 'Nevara (ayol)' },
  { value: 'wife', label: 'Xotin' },
];

export const AddRelativeDialog = ({ open, onOpenChange, onAdd, relatives }: AddRelativeDialogProps) => {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

  const handleNext = () => {
    if (name.trim()) {
      setStep('relation');
    }
  };

  const handleSelectRelation = (relationType: string, gender: 'male' | 'female') => {
    onAdd({
      relative_name: name,
      relation_type: relationType as Relative['relation_type'],
      avatar_url: avatarUrl,
      parent_relative_id: null,
      gender: gender,
    });
    handleClose();
  };

  const handleClose = () => {
    setStep('name');
    setName('');
    setAvatarUrl('');
    setSelectedGender(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (step === 'relation') {
      setStep('name');
      setSelectedGender(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center gap-2">
          {step === 'relation' && (
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle className="flex-1 text-center">
            {step === 'name' ? 'Shaxs qo\'shish' : 'Oila a\'zosi'}
          </DialogTitle>
        </DialogHeader>

        {step === 'name' && (
          <div className="space-y-6 py-4">
            {/* Avatar preview */}
            <div className="flex justify-center">
              <Avatar className="h-24 w-24 border-2 border-muted">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-2xl">
                  {name ? name.charAt(0).toUpperCase() : <User className="h-10 w-10" />}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Avatar URL input */}
            <div className="space-y-2">
              <Label htmlFor="avatar">Rasm URL (ixtiyoriy)</Label>
              <Input
                id="avatar"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="name">Ism-familiya, pasport seriyasi yoki username</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ismini kiriting..."
                className="border-primary/50 focus:border-primary"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Bekor qilish
              </Button>
              <Button 
                type="button" 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600" 
                onClick={handleNext}
                disabled={!name.trim()}
              >
                OK
              </Button>
            </div>
          </div>
        )}

        {step === 'relation' && (
          <div className="space-y-4 py-2">
            <p className="text-center text-muted-foreground">
              <span className="font-medium text-foreground">{name}</span> - Men uchun kim?
            </p>

            {/* Male relations */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ERKAK</p>
              <div className="space-y-2">
                {maleRelationTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleSelectRelation(type.value, 'male')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Female relations */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AYOL</p>
              <div className="space-y-2">
                {femaleRelationTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => handleSelectRelation(type.value, 'female')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-colors text-left"
                  >
                    <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                    <span className="font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
