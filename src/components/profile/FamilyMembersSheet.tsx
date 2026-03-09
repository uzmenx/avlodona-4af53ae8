import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface FamilyMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string | undefined;
}

interface FamilyMemberRow {
  id: string;
  member_name: string;
  relation_type: string;
  avatar_url: string | null;
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

export function FamilyMembersSheet({ open, onOpenChange, ownerId }: FamilyMembersSheetProps) {
  const [members, setMembers] = useState<FamilyMemberRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!ownerId) {
      setMembers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: qError } = await supabase
        .from('family_tree_members')
        .select('id, member_name, relation_type, avatar_url')
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (qError) throw qError;
      setMembers((data || []) as any);
    } catch (e: any) {
      setMembers([]);
      setError(e?.message || 'Xatolik');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!open) return;
    fetchMembers();
  }, [open, fetchMembers]);

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
            <Users className="h-4 w-4" />
            Oila a'zolari
          </SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-5">
          {error && <div className="text-sm text-destructive">{error}</div>}

          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Yuklanmoqda...</div>
          ) : members.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Hozircha bo'sh</div>
          ) : (
            <ScrollArea className="h-[66vh] pr-2">
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl px-3 py-2',
                      'border border-white/10 bg-white/5 backdrop-blur-md'
                    )}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback className="bg-white/10 text-sm font-bold">
                        {getInitials(m.member_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-foreground">{m.member_name}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.relation_type}</div>
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
