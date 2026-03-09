import { useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useUnfollowHistory } from '@/hooks/useUnfollowHistory';

interface UnfollowHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const formatTs = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
};

export function UnfollowHistorySheet({ open, onOpenChange }: UnfollowHistorySheetProps) {
  const { history, refetch } = useUnfollowHistory();

  useEffect(() => {
    if (!open) return;
    refetch();
  }, [open, refetch]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'p-0 rounded-t-2xl border-t border-white/10 bg-background/95 backdrop-blur-xl',
          'max-h-[82vh]'
        )}
      >
        <SheetHeader className="px-5 pt-4 pb-3 text-left">
          <SheetTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Unfollow history
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-5">
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
          ) : (
            <ScrollArea className="h-[66vh] pr-2">
              <div className="space-y-2">
                {history.map((r) => {
                  const displayName = r.profile?.name || r.profile?.username || 'User';
                  const username = r.profile?.username ? `@${r.profile.username}` : '';
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl px-3 py-2',
                        'border border-white/10 bg-white/5 backdrop-blur-md'
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={r.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-white/10 text-sm font-bold">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-foreground">{displayName}</div>
                        <div className="truncate text-xs text-muted-foreground">{username}</div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] text-muted-foreground">{formatTs(r.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
