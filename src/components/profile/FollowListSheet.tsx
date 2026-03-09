import { useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { FollowButton } from '@/components/user/FollowButton';
import { MessageButton } from '@/components/chat/MessageButton';
import { useFollowLists, type FollowListMode } from '@/hooks/useFollowLists';

interface FollowListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  mode: FollowListMode;
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

export function FollowListSheet({ open, onOpenChange, userId, mode }: FollowListSheetProps) {
  const { users, isLoading, error, title, refetch } = useFollowLists(userId, mode, open);

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
          <SheetTitle className="text-base font-extrabold tracking-tight">{title}</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-5">
          {error && <div className="text-sm text-destructive">{error}</div>}

          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>
          ) : users.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
          ) : (
            <ScrollArea className="h-[66vh] pr-2">
              <div className="space-y-2">
                {users.map(u => (
                  <div
                    key={u.id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2',
                      'border border-white/10 bg-white/5 backdrop-blur-md'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="bg-white/10 text-sm font-bold">
                        {getInitials(u.name || u.username)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground">
                        {u.name || u.username || 'User'}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {u.username ? `@${u.username}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MessageButton userId={u.id} className="h-8 text-xs px-3" />
                      <FollowButton targetUserId={u.id} size="sm" className="h-8 text-xs px-3" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
