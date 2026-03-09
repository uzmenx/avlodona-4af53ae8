import { TreeDeciduous, Trash2, Check, Clock } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TreePost } from '@/hooks/useTreePosts';

interface TreeHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  posts: TreePost[];
  currentPostId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TreeHistoryDrawer = ({
  isOpen,
  onClose,
  posts,
  currentPostId,
  onSelect,
  onDelete,
}: TreeHistoryDrawerProps) => {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uz', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <TreeDeciduous className="h-5 w-5 text-primary" />
            Daraxtlar tarixi
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {posts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <TreeDeciduous className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Hali daraxt yaratilmagan</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                    currentPostId === post.id && "bg-primary/10"
                  )}
                  onClick={() => { onSelect(post.id); onClose(); }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    post.is_published ? "bg-primary/20" : "bg-muted"
                  )}>
                    <TreeDeciduous className={cn(
                      "h-5 w-5",
                      post.is_published ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {post.is_published ? (
                        <span className="flex items-center gap-1 text-xs text-primary">
                          <Check className="h-3 w-3" /> Nashr qilingan
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> Qoralama
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(post.updated_at)}
                      </span>
                    </div>
                  </div>

                  {!post.is_personal && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
