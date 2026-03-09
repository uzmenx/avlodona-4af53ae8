import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string | null; username: string | null; avatar_url: string | null }>>([]);
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
        if (ids.length === 0) {
          setProfiles([]);
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', ids);

        if (error) throw error;
        setProfiles((data || []) as any);
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSend = async () => {
    if (!user?.id) return;
    if (!shareMarker) {
      toast.error('Xatolik yuz berdi');
      return;
    }
    if (selectedIds.size === 0) {
      toast.error('Tanlang');
      return;
    }
    if (isSending) return;
    setIsSending(true);
    try {
      const ids = Array.from(selectedIds);
      const trimmedMessage = messageText.trim();
      const contentToSend = trimmedMessage
        ? `${trimmedMessage}\n\n${shareMarker}`
        : `${shareMarker}`;
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
            .select('id')
            .single();
          if (newConvErr) throw newConvErr;
          conversationId = newConv?.id;
        }

        if (conversationId) {
          const { error: msgErr } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              sender_id: user.id,
              content: contentToSend,
              status: 'sent'
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
      <DialogContent className="sm:max-w-lg rounded-3xl p-4">
        <DialogHeader>
          <DialogTitle>Yuborish</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-2xl"
          />
        </div>

        <ScrollArea className="h-[380px]">
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Yuklanmoqda...</div>
          ) : filteredProfiles.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">Topilmadi</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pr-3">
              {filteredProfiles.map((p) => {
                const selected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleSelect(p.id)}
                    className="flex flex-col items-center text-center gap-2 p-2 rounded-2xl hover:bg-muted/60 transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(p.name)}</AvatarFallback>
                      </Avatar>
                      {selected && (
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="w-full">
                      <div className="text-sm font-semibold truncate">{p.username ? `@${p.username}` : (p.name || 'User')}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="space-y-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Xabar yozing..."
            className="min-h-[70px] rounded-2xl"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={handleSend} disabled={selectedIds.size === 0 || isSending}>
            {isSending ? 'Yuborilmoqda...' : `Yuborish (${selectedIds.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
