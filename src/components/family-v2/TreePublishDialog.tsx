import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, TreeDeciduous } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface TreePublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (caption: string) => void;
  isPublishing?: boolean;
  title?: string;
}

export const TreePublishDialog = ({
  isOpen,
  onClose,
  onPublish,
  isPublishing,
  title,
}: TreePublishDialogProps) => {
  const [caption, setCaption] = useState('');
  const { t } = useLanguage();

  const handlePublish = () => {
    onPublish(caption);
    setCaption('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TreeDeciduous className="h-5 w-5 text-primary" />
            {t('publishTree')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="w-14 h-14 rounded-lg bg-primary/20 flex items-center justify-center">
              <TreeDeciduous className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{title || t('familyTree')}</p>
              <p className="text-xs text-muted-foreground">{t('interactivePost')}</p>
            </div>
          </div>

          {/* Caption */}
          <div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t('writeCaption')}
              className="min-h-[100px] resize-none bg-muted/30"
              maxLength={2200}
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{caption.length}/2200</p>
          </div>

          {/* Publish */}
          <Button
            onClick={handlePublish}
            disabled={isPublishing}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {isPublishing ? t('publishing') : t('publish')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
