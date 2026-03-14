import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Users, UserPlus, X } from 'lucide-react';
import { SearchSheet } from '@/components/search/SearchSheet';
import { RelativeConnectionSheet } from '@/components/family/RelativeConnectionSheet';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const WELCOME_BG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 2400'%3E%3Cdefs%3E%3CradialGradient id='g1' cx='30%25' cy='20%25' r='70%25'%3E%3Cstop offset='0' stop-color='%2310B981' stop-opacity='.35'/%3E%3Cstop offset='1' stop-color='%230B1220' stop-opacity='1'/%3E%3C/radialGradient%3E%3CradialGradient id='g2' cx='80%25' cy='45%25' r='60%25'%3E%3Cstop offset='0' stop-color='%230EA5E9' stop-opacity='.28'/%3E%3Cstop offset='1' stop-color='%230B1220' stop-opacity='0'/%3E%3C/radialGradient%3E%3ClinearGradient id='g3' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23171A2B'/%3E%3Cstop offset='1' stop-color='%23060A14'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1200' height='2400' fill='url(%23g3)'/%3E%3Crect width='1200' height='2400' fill='url(%23g1)'/%3E%3Crect width='1200' height='2400' fill='url(%23g2)'/%3E%3Ccircle cx='980' cy='260' r='210' fill='%23ffffff' opacity='.06'/%3E%3Ccircle cx='230' cy='780' r='260' fill='%23ffffff' opacity='.05'/%3E%3Ccircle cx='1020' cy='1250' r='320' fill='%23ffffff' opacity='.04'/%3E%3Cpath d='M90 1540 C 360 1420, 540 1700, 900 1540 S 1180 1660, 1200 1780' fill='none' stroke='%23ffffff' stroke-opacity='.06' stroke-width='20'/%3E%3C/svg%3E";

const WELCOME_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%2310B981'/%3E%3Cstop offset='1' stop-color='%230EA5E9'/%3E%3C/linearGradient%3E%3Cfilter id='s' x='-20%25' y='-20%25' width='140%25' height='140%25'%3E%3CfeDropShadow dx='0' dy='10' stdDeviation='14' flood-color='%23000000' flood-opacity='.25'/%3E%3C/filter%3E%3C/defs%3E%3Crect rx='56' ry='56' x='18' y='18' width='220' height='220' fill='url(%23a)' filter='url(%23s)'/%3E%3Cpath d='M128 76c18 0 32 14 32 32s-14 32-32 32-32-14-32-32 14-32 32-32zm0 88c34 0 62 18 62 40v10H66v-10c0-22 28-40 62-40z' fill='%23ffffff' opacity='.9'/%3E%3C/svg%3E";

interface SearchRelativesFlowProps {
  onCancel?: () => void;
}

export const SearchRelativesFlow = ({ onCancel }: SearchRelativesFlowProps) => {
  const { profile } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [isConnectionSheetOpen, setIsConnectionSheetOpen] = useState(false);

  // When a user is selected from the search sheet
  // We actually need a custom search handler, or we can use SearchSheet and intercept clicks.
  // Wait, SearchSheet navigates to `/user/:id` on click. We might need a slightly modified 
  // version or just let them go to the profile and click "Qarindosh" there.
  // BUT the requirement says: "qidiruv oynasi ochilsin, foydalanuvchi uz qarindoshini qidiradi, ustiga bosadi uning oila daraxti paydo buladi".
  // So we need a custom search list here, or a modified SearchSheet that accepts an `onSelectUser` prop.

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-[calc(100dvh-110px)] px-4 py-10 animate-in fade-in duration-500">
      <div className="absolute inset-0 -z-10">
        <img
          src={WELCOME_BG}
          alt=""
          className="h-full w-full object-cover opacity-70"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/60 to-background" />
      </div>

      <div className="w-full max-w-sm">
        <div className="relative rounded-3xl border border-white/10 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl shadow-xl shadow-black/10 dark:shadow-black/40 overflow-hidden">
          <div className="p-5 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-sky-500/15">
            <div className="flex items-center justify-center">
              <div className="h-20 w-20 rounded-3xl bg-white/70 dark:bg-white/5 border border-white/10 shadow-md shadow-black/5 overflow-hidden">
                <img
                  src={WELCOME_THUMB}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
            </div>

            <h2 className="mt-4 text-2xl font-extrabold text-center tracking-tight">
              Xush kelibsiz, {profile?.name || 'Foydalanuvchi'}!
            </h2>

            <p className="mt-2 text-sm text-muted-foreground text-center">
              Hozircha sizning oila daraxtingiz bo'sh. O'z yaqinlaringizni toping va ularning daraxtiga qo'shiling yoki yangi daraxt yarating.
            </p>
          </div>

          <div className="relative p-5 space-y-3">
            <Button
              size="lg"
              className="w-full rounded-2xl gap-2 font-bold shadow-lg shadow-emerald-500/15 h-12"
              onClick={() => setIsSearchOpen(true)}
            >
              <Search className="w-5 h-5" />
              Qarindoshlarni qidirish
            </Button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-border/60"></div>
              <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs font-medium">yoki</span>
              <div className="flex-grow border-t border-border/60"></div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full rounded-2xl gap-2 h-12"
              onClick={onCancel}
            >
              <UserPlus className="w-5 h-5" />
              Yangi daraxt yaratish
            </Button>
          </div>
        </div>
      </div>

      {/* 
        We use the existing SearchSheet. However, SearchSheet currently navigates on click.
        To avoid modifying SearchSheet heavily right now and breaking other things,
        we can pass a prop `onSelectUser` to SearchSheet if we modify it slightly.
      */}
      <RelativeSearchSheet 
        open={isSearchOpen} 
        onOpenChange={setIsSearchOpen}
        onSelect={(userId, userName) => {
          setIsSearchOpen(false);
          setSelectedUserId(userId);
          setSelectedUserName(userName);
          setTimeout(() => setIsConnectionSheetOpen(true), 300);
        }}
      />

      <RelativeConnectionSheet
        open={isConnectionSheetOpen}
        onOpenChange={setIsConnectionSheetOpen}
        targetUserId={selectedUserId}
        targetUserName={selectedUserName}
      />
    </div>
  );
};


// ----------------------------------------------------------------------
// Custom Search Sheet for Relatives to avoid modifying the global SearchSheet too much
// ----------------------------------------------------------------------
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StarUsername } from '@/components/user/StarUsername';

interface SearchRelativeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (userId: string, userName: string) => void;
}

interface SearchUser {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export const RelativeSearchSheet = ({ open, onOpenChange, onSelect }: SearchRelativeSheetProps) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .or(`username.ilike.%${q.trim()}%,name.ilike.%${q.trim()}%`)
        .limit(20);
      setUsers(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl p-0 flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-extrabold">Qarindoshni qidirish</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Ism yoki username orqali toping</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 w-10 rounded-2xl bg-white/60 dark:bg-white/5 border border-white/10 flex items-center justify-center transition-colors hover:bg-white/80 dark:hover:bg-white/10"
              aria-label="Yopish"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  search(e.target.value);
                }}
                placeholder="Ism yoki username..."
                className="pl-9 pr-10 h-11 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/10 focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setUsers([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-2xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Tozalash"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && <p className="text-sm text-center text-muted-foreground mt-8">Qidirilmoqda...</p>}
          {!isLoading && query && users.length === 0 && (
            <div className="mt-10 flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Search className="h-7 w-7 text-emerald-600 dark:text-emerald-300" />
              </div>
              <p className="mt-3 text-sm font-semibold">Foydalanuvchi topilmadi</p>
              <p className="mt-1 text-xs text-muted-foreground">Boshqa so'z bilan urinib ko'ring</p>
            </div>
          )}

          <div className="space-y-3 mt-1">
            {users.map((u) => (
              <div
                key={u.id}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-2xl border border-white/10 bg-white/70 dark:bg-white/5 shadow-md shadow-black/5 dark:shadow-black/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {(u.name || u.username || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{u.name || u.username}</p>
                    {u.username && <StarUsername username={u.username} />}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onSelect(u.id, u.name || u.username || 'Foydalanuvchi')}
                  className="rounded-2xl px-4 h-10 font-bold shadow-md shadow-emerald-500/15"
                >
                  Qarindoshim
                </Button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
