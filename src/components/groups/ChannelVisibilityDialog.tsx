import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Lock, Check, ArrowLeft, Link as LinkIcon, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [inviteLink, setInviteLink] = useState('');

  const handleComplete = () => {
    onComplete(visibility, inviteLink);
    // Reset handled by flow
  };

  const handleCancel = () => {
    setVisibility('public');
    setInviteLink('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-white/10 bg-background/60 backdrop-blur-2xl p-0 overflow-hidden rounded-[32px] shadow-2xl flex flex-col">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent blur-sm" />
        
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onBack}
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-xl font-extrabold tracking-tight">Kanal turi</DialogTitle>
              <div className="h-8 w-8" />
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Visibility Option Cards */}
            <div className="grid gap-3">
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setVisibility('public')}
                className={cn(
                  "relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border",
                  visibility === 'public' 
                    ? "bg-primary/10 border-primary/20 ring-1 ring-primary/10" 
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                  visibility === 'public' ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"
                )}>
                  <Globe className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">Ommaviy kanal</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    Har kim qidiruv orqali topib, a'zo bo'lishi mumkin
                  </div>
                </div>
                {visibility === 'public' && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => setVisibility('private')}
                className={cn(
                  "relative flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border",
                  visibility === 'private' 
                    ? "bg-primary/10 border-primary/20 ring-1 ring-primary/10" 
                    : "bg-white/5 border-white/10 hover:bg-white/10"
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center transition-colors",
                  visibility === 'private' ? "bg-primary text-primary-foreground" : "bg-white/10 text-muted-foreground"
                )}>
                  <Lock className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-bold">Yopiq kanal</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    Faqat taklif havolasi orqali a'zo bo'lish mumkin
                  </div>
                </div>
                {visibility === 'private' && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Invite Link Group */}
            {visibility === 'public' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 pt-2"
              >
                <div className="flex items-center gap-2 px-1">
                  <LinkIcon className="h-3 w-3 text-primary" />
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">Kanal havolasi</Label>
                </div>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-muted-foreground/50 text-sm font-medium select-none">
                    avlodona.uz/
                  </div>
                  <Input
                    placeholder="kanal_nomi"
                    value={inviteLink}
                    onChange={(e) => setInviteLink(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    className="pl-[104px] h-12 bg-white/5 border-white/10 rounded-2xl focus:ring-primary/20 focus:border-primary/40 transition-all font-medium"
                  />
                  <div className="absolute right-4">
                    <Sparkles className="h-4 w-4 text-primary/40" />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="p-6 bg-black/10 backdrop-blur-md border-t border-white/5">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={handleCancel}
              className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              {t('cancel') || 'Bekor qilish'}
            </Button>
            <Button 
              onClick={handleComplete} 
              className="flex-[1.5] h-12 rounded-2xl bg-gradient-to-r from-primary to-violet-600 text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span>{t('save') || 'Saqlash'}</span>
              <Check className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
