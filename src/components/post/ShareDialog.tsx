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
import { useLanguage } from '@/contexts/LanguageContext';
import { useConversations } from '@/hooks/useConversations';
import { useGroupChats } from '@/hooks/useGroupChats';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId?: string;
  shortId?: string;
}

type Profile = { id: string; name: string | null; username: string | null; avatar_url: string | null; type: 'user' | 'group' | 'channel' };

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
  const { t } = useLanguage();
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
        placeholder={t("searchChats")}
        value={value}
        onChange={handleChange}
        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-border/40 bg-muted/40 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all relative z-10"
      />
    </div>
  );
});
SearchInput.displayName = 'SearchInput';

// ─── Isolated message input ────────────────────────────────────────────────
const MessageInput = memo(({ onValue }: { onValue: (v: string) => void }) => {
  const [value, setValue] = useState('');
  const { t } = useLanguage();
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
      placeholder={t("writeMessage")}
      className="w-full min-h-[70px] rounded-2xl border border-border/40 bg-muted/40 backdrop-blur-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition-all relative z-10"
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  const { conversations, isLoading: convLoading, refetch: refetchConv } = useConversations();
  const { groups, channels, isLoading: groupsLoading, refetch: refetchGroups } = useGroupChats();

  const isLoading = convLoading || groupsLoading;

  const profiles = useMemo(() => {
    const userProfiles = (conversations || []).map(c => ({
      id: c.otherUser.id,
      name: c.otherUser.name,
      username: c.otherUser.username,
      avatar_url: c.otherUser.avatar_url,
      type: 'user' as const
    }));

    const groupProfiles = [...(groups || []), ...(channels || [])].map(g => ({
      id: g.id,
      name: g.name,
      username: null,
      avatar_url: g.avatar_url,
      type: g.type
    }));

    // Remove duplicates if any
    const uniqueMap = new Map();
    [...userProfiles, ...groupProfiles].forEach(p => uniqueMap.set(p.id, p));
    return Array.from(uniqueMap.values()) as Profile[];
  }, [conversations, groups, channels]);

  useEffect(() => {
    if (!open) return;
    if (!user?.id) return;
    setSearchQuery('');
    setMessageText('');
    setSelectedIds(new Set());
    
    // Refresh chats when opening
    refetchConv();
    refetchGroups();
  }, [open, user?.id, refetchConv, refetchGroups]);

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
    if (!user?.id || !shareMarker) { toast.error(t('errorOccurred')); return; }
    if (selectedIds.size === 0) { toast.error(t('selectToShare') || 'Tanlang'); return; }
    if (isSending) return;
    setIsSending(true);
    try {
      const ids = Array.from(selectedIds);
      const trimmedMessage = messageText.trim();
      const contentToSend = trimmedMessage ? `${trimmedMessage}\n\n${shareMarker}` : `${shareMarker}`;
      for (const targetId of ids) {
        const targetProfile = profiles.find(p => p.id === targetId);
        if (!targetProfile) continue;

        if (targetProfile.type === 'user') {
          // Send direct message
          const { data: existingConv, error: convErr } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant1_id.eq.${user.id},participant2_id.eq.${targetId}),and(participant1_id.eq.${targetId},participant2_id.eq.${user.id})`)
            .maybeSingle();
          if (convErr) throw convErr;

          let conversationId = existingConv?.id as string | undefined;
          if (!conversationId) {
            const { data: newConv, error: newConvErr } = await supabase
               .from('conversations')
               .insert({ participant1_id: user.id, participant2_id: targetId })
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
        } else {
          // Send group message
          const { error: msgErr } = await supabase.from('group_messages').insert({
            group_id: targetId, sender_id: user.id, content: contentToSend
          });
          if (msgErr) throw msgErr;
        }
      }
      toast.success(t('success'));
      onOpenChange(false);
      navigate('/messages');
    } catch (e) {
      console.error('Failed to send post:', e);
      toast.error(t('errorOccurred'));
    } finally {
      setIsSending(false);
    }
  };

  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg rounded-3xl p-4 bg-background/80 dark:bg-slate-950/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 overflow-hidden">
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-violet-500/15 dark:bg-violet-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-sky-500/15 dark:bg-sky-500/10 blur-[80px] pointer-events-none" />

        <DialogHeader className="relative z-10">
          <DialogTitle>{t('send')}</DialogTitle>
        </DialogHeader>

        <SearchInput onSearch={setSearchQuery} />

        <ScrollArea className="h-[380px] relative z-10">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">{t('loading')}</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">{t('noResults')}</div>
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

        <div className="flex justify-end gap-2 relative z-10">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-background/50 backdrop-blur-sm border-white/10 dark:border-white/5">{t('cancel')}</Button>
          <Button onClick={handleSend} disabled={selectedIds.size === 0 || isSending} className="shadow-lg">
            {isSending ? t('sending') : `${t('send')} (${selectedIds.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
