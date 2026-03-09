import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User, Check, X } from 'lucide-react';
import { CollabRequest } from '@/hooks/useMentionsCollabs';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';

interface CollabRequestsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: CollabRequest[];
  onRespond: (collabId: string, accept: boolean) => void;
}

export const CollabRequestsSheet = ({ open, onOpenChange, requests, onRespond }: CollabRequestsSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Hamkorlik so'rovlari</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto max-h-[55vh]">
          {requests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Hozircha so'rovlar yo'q
            </p>
          ) : (
            requests.map(req => (
              <div key={req.id} className="flex items-start gap-3 p-3 rounded-xl border border-border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={req.author?.avatar_url || undefined} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{req.author?.name || req.author?.username || 'Foydalanuvchi'}</span>
                    {' '}sizni postga hamkor sifatida qo'shmoqchi
                  </p>
                  {req.post?.content && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{req.post.content}</p>
                  )}
                  {req.post?.media_urls && req.post.media_urls.length > 0 && (
                    <div className="mt-2 h-16 w-16 rounded-lg overflow-hidden">
                      <img src={req.post.media_urls[0]} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: uz })}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => onRespond(req.id, true)} className="gap-1">
                      <Check className="h-3.5 w-3.5" /> Qabul qilish
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onRespond(req.id, false)} className="gap-1">
                      <X className="h-3.5 w-3.5" /> Rad etish
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
