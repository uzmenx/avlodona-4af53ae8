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
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden rounded-3xl border border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-2xl shadow-black/20"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-sky-500/15">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-extrabold tracking-tight">
              Jinsingizni tanlang
            </DialogTitle>
          </DialogHeader>

          <p className="mt-2 text-center text-sm text-muted-foreground">
            Oila daraxtini to'g'ri ko'rsatish uchun jinsingizni tanlang
          </p>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSelect('male')}
              disabled={disabled}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/70 dark:bg-white/5 shadow-md shadow-black/5 dark:shadow-black/30 p-4 transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-black/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-md shadow-sky-500/25 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-foreground">Erkak</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Male</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => onSelect('female')}
              disabled={disabled}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/70 dark:bg-white/5 shadow-md shadow-black/5 dark:shadow-black/30 p-4 transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-black/10 disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-pink-500/10 via-rose-500/5 to-transparent" />
              <div className="relative flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-md shadow-pink-500/25 flex items-center justify-center">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div className="text-center">
                  <div className="text-base font-bold text-foreground">Ayol</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Female</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
