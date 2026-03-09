import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplyPreviewProps {
  replyToContent: string;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyToContent, onCancel }: ReplyPreviewProps) => {
  const truncatedContent = replyToContent.length > 50 
    ? replyToContent.substring(0, 50) + '...' 
    : replyToContent;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-l-4 border-primary">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary font-medium">Javob</p>
        <p className="text-sm text-muted-foreground truncate">{truncatedContent}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
