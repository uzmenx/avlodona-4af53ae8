import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart } from 'lucide-react';
import { StarUsername } from '@/components/user/StarUsername';

interface ViewUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ViewersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: ViewUser[];
  viewsCount: number;
  likedUserIds?: string[];
}

export const ViewersDialog = ({ open, onOpenChange, users, viewsCount, likedUserIds = [] }: ViewersDialogProps) => {
  const likedSet = new Set(likedUserIds);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm screen-likes overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ko'rganlar
            <span className="likes-bg-soft likes-accent text-xs font-semibold px-2 py-0.5 rounded-full">
              {viewsCount}
            </span>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[440px]">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Hozircha ko'rishlar yo'q</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pr-2 pb-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="group flex items-center gap-3 p-3 rounded-2xl border border-border/60 bg-gradient-to-br from-background/70 to-background/40 backdrop-blur-md shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative p-[2px] rounded-2xl bg-gradient-to-br from-primary/35 via-transparent to-primary/20">
                    <Avatar className="h-10 w-10 shrink-0 rounded-2xl">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="likes-bg-soft likes-accent">
                        {user.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    {likedSet.has(user.id) && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background/90 border border-border/60 flex items-center justify-center shadow-sm">
                        <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{user.name || 'Foydalanuvchi'}</p>
                    <div className="truncate">
                      <StarUsername username={user.username || 'user'} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
