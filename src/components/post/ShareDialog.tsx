import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState, useRef, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  shortId?: string;
}

type Profile = { id: string; name: string | null; username: string | null; avatar_url: string | null };

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

// ─── Memoized profile tile ─────────────────────────────────────────────────
const ProfileTile = memo(({ profile, selected, onToggle }: {
  profile: Profile;
  selected: boolean;
  onToggle: (id: string) => void;
}) => (
  <button
    type="button"
    onClick={() => onToggle(profile.id)}
    className="flex flex-col items-center text-center gap-2 p-2 rounded-2xl hover:bg-muted/60 transition-colors"
  >
    <div className="relative">
      <Avatar className="h-16 w-16">
        <AvatarImage src={profile.avatar_url || undefined} />
        <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
      </Avatar>
      {selected && (
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="h-4 w-4" />
        </div>
      )}
    </div>
    <div className="w-full">
      <div className="text-sm font-semibold truncate">
        {profile.username ? `@${profile.username}` : (profile.name || 'User')}
      </div>
    </div>
  </button>
));
ProfileTile.displayName = 'ProfileTile';

// ─── Isolated search input ─────────────────────────────────────────────────
const SearchInput = memo(({ onSearch }: { onSearch: (q: string) => void }) => {
  const [value, setValue] = useState('');
  const timerRef = useRef<number>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onSearch(q), 250);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Qidirish..."
        value={value}
        onChange={handleChange}
        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
      />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

// ─── Isolated message input ────────────────────────────────────────────────
const MessageInput = memo(({ onValue }: { onValue: (v: string) => void }) => {
  const [value, setValue] = useState('');
  const timerRef = useRef<number>();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onValue(v), 50);
  };

  return (
    <textarea
      value={value}
      onChange={handleChange}
      placeholder="Xabar yozing..."
      className="w-full min-h-[70px] rounded-2xl border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
    />
  );
});
MessageInput.displayName = 'MessageInput';

// ─── Main ShareDialog ──────────────────────────────────────────────────────
export const ShareDialog = ({ open, onOpenChange, postId, shortId }: ShareDialogProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const shareMarker = postId
    ? `[[POST:${postId}]]`
    : shortId
    ? `[[SHORT:${shortId}]]`
    : '';

  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    setSearchQuery('');
    setMessageText('');
    setSelectedIds(new Set());

    const fetchProfiles = async () => {
      setIsLoading(true);
      try {
        const [followersRes, followingRes] = await Promise.all([
          supabase.from('follows').select('follower_id').eq('following_id', user.id),
          supabase.from('follows').select('following_id').eq('follower_id', user.id),
        ]);
        const followerIds = (followersRes.data || []).map((r: any) => r.follower_id).filter(Boolean);
        const followingIds = (followingRes.data || []).map((r: any) => r.following_id).filter(Boolean);
        const ids = Array.from(new Set([...followerIds, ...followingIds])).filter((id) => id !== user.id);
        if (ids.length === 0) { setProfiles([]); return; }
        const { data, error } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', ids);
        if (error) throw error;
        setProfiles((data || []) as Profile[]);
      } catch (e) {
        console.error('Failed to fetch share targets:', e);
        setProfiles([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfiles();
  }, [open, user?.id]);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const username = (p.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [profiles, searchQuery]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSend = async () => {
    if (!user?.id || !shareMarker) { toast.error('Xatolik yuz berdi'); return; }
    if (selectedIds.size === 0) { toast.error('Tanlang'); return; }
    if (isSending) return;
    setIsSending(true);
    try {
      const ids = Array.from(selectedIds);
      const trimmedMessage = messageText.trim();
      const contentToSend = trimmedMessage ? `${trimmedMessage}\n\n${shareMarker}` : `${shareMarker}`;
      for (const targetUserId of ids) {
        const { data: existingConv, error: convErr } = await supabase
          .from('conversations')
          .select('id')
          .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${targetUserId}),and(participant1_id.eq.${targetUserId},participant2_id.eq.${user.id})`)
          .maybeSingle();
        if (convErr) throw convErr;

        let conversationId = existingConv?.id as string | undefined;
        if (!conversationId) {
          const { data: newConv, error: newConvErr } = await supabase
            .from('conversations')
            .insert({ participant1_id: user.id, participant2_id: targetUserId })
            .select('id').single();
          if (newConvErr) throw newConvErr;
          conversationId = newConv?.id;
        }
        if (conversationId) {
          const { error: msgErr } = await supabase.from('messages').insert({
            conversation_id: conversationId, sender_id: user.id, content: contentToSend, status: 'sent',
          });
          if (msgErr) throw msgErr;
        }
      }
      toast.success('Yuborildi');
      onOpenChange(false);
      navigate('/messages');
    } catch (e) {
      console.error('Failed to send post:', e);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>Yuborish</DialogTitle>
        </DialogHeader>

        <SearchInput onSearch={setSearchQuery} />

        <ScrollArea className="h-[380px]">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Yuklanmoqda...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Topilmadi</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pr-3">
              {filteredProfiles.map((p) => (
                <ProfileTile
                  key={p.id}
                  profile={p}
                  selected={selectedIds.has(p.id)}
                  onToggle={toggleSelect}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-2">
          <MessageInput onValue={setMessageText} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bekor qilish</Button>
          <Button onClick={handleSend} disabled={selectedIds.size === 0 || isSending}>
            {isSending ? 'Yuborilmoqda...' : `Yuborish (${selectedIds.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
