import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Users, ArrowRight, UserPlus, X } from 'lucide-react';
import { SearchSheet } from '@/components/search/SearchSheet';
import { RelativeConnectionSheet } from '@/components/family/RelativeConnectionSheet';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-500">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Users className="w-12 h-12 text-primary" />
      </div>
      
      <h2 className="text-2xl font-bold text-center mb-2">
        Xush kelibsiz, {profile?.name || 'Foydalanuvchi'}!
      </h2>
      
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Hozircha sizning oila daraxtingiz bo'sh. O'z yaqinlaringizni toping va ularning daraxtiga qo'shiling yoki yangi daraxt yarating.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button 
          size="lg" 
          className="w-full rounded-2xl gap-2 font-semibold shadow-lg shadow-primary/20"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search className="w-5 h-5" />
          Qarindoshlarni qidirish
        </Button>
        
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm">yoki</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <Button 
          variant="outline"
          size="lg" 
          className="w-full rounded-2xl gap-2"
          onClick={onCancel}
        >
          <UserPlus className="w-5 h-5" />
          Yangi daraxt yaratish
        </Button>
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Qarindoshni qidirish</SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                search(e.target.value);
              }}
              placeholder="Ism yoki username..."
              className="pl-9 pr-9 h-10 rounded-xl bg-muted/50 border-transparent focus-visible:ring-1"
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(''); setUsers([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading && <p className="text-sm text-center text-muted-foreground mt-8">Qidirilmoqda...</p>}
          {!isLoading && query && users.length === 0 && (
             <p className="text-sm text-center text-muted-foreground mt-8">Foydalanuvchi topilmadi</p>
          )}
          
          <div className="space-y-2 mt-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="w-full flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 cursor-pointer">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(u.name || u.username || 'U')[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{u.name || u.username}</p>
                    {u.username && <StarUsername username={u.username} />}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onSelect(u.id, u.name || u.username || 'Foydalanuvchi')}
                  className="rounded-xl px-4"
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
