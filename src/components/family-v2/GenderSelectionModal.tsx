import { User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GenderSelectionModalProps {
  isOpen: boolean;
  onSelect: (gender: 'male' | 'female') => void;
  disabled?: boolean;
}

export const GenderSelectionModal = ({ isOpen, onSelect, disabled }: GenderSelectionModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center">Jinsingizni tanlang</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-4">
          <p className="text-center text-muted-foreground text-sm">
            Oila daraxtini to'g'ri ko'rsatish uchun jinsingizni tanlang
          </p>
          
          <div className="flex gap-4 justify-center">
            {/* Male option */}
            <button
              onClick={() => onSelect('male')}
              disabled={disabled}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-transparent hover:border-sky-500 bg-muted/50 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-all group disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-sky-500 flex items-center justify-center ring-4 ring-sky-200 dark:ring-sky-800">
                <User className="h-10 w-10 text-white" />
              </div>
              <span className="font-medium text-sky-700 dark:text-sky-300">Erkak</span>
            </button>

            {/* Female option */}
            <button
              onClick={() => onSelect('female')}
              disabled={disabled}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-transparent hover:border-pink-500 bg-muted/50 hover:bg-pink-50 dark:hover:bg-pink-950/20 transition-all group disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-pink-500 flex items-center justify-center ring-4 ring-pink-200 dark:ring-pink-800">
                <User className="h-10 w-10 text-white" />
              </div>
              <span className="font-medium text-pink-700 dark:text-pink-300">Ayol</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
