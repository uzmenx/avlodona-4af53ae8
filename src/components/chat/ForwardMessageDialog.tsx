import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Search, Users, Megaphone, Check } from 'lucide-react';

interface ForwardTarget {
  id: string;
  name: string;
  avatar_url: string | null;
  type: 'user' | 'group' | 'channel';
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

export const ForwardMessageDialog = ({
  open,
  onOpenChange,
  messageContent,
  mediaUrl,
  mediaType,
}: ForwardMessageDialogProps) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [targets, setTargets] = useState<ForwardTarget[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTargets();
    }
  }, [open]);

  const fetchTargets = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      // Fetch conversations (users)
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant1_id.eq.${user.id},participant2_id.eq.${user.id}`);

      const userIds = new Set<string>();
      conversations?.forEach(conv => {
        if (conv.participant1_id !== user.id) userIds.add(conv.participant1_id);
        if (conv.participant2_id !== user.id) userIds.add(conv.participant2_id);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', Array.from(userIds));

      // Fetch groups/channels
      const { data: ownedChats } = await supabase
        .from('group_chats')
        .select('id, name, avatar_url, type')
        .eq('owner_id', user.id);

      const { data: memberOf } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const memberGroupIds = memberOf?.map(m => m.group_id) || [];
      let memberChats: any[] = [];
      if (memberGroupIds.length > 0) {
        const { data } = await supabase
          .from('group_chats')
          .select('id, name, avatar_url, type')
          .in('id', memberGroupIds);
        memberChats = data || [];
      }

      const allTargets: ForwardTarget[] = [];

      // Add users
      profiles?.forEach(profile => {
        allTargets.push({
          id: profile.id,
          name: profile.name || 'Foydalanuvchi',
          avatar_url: profile.avatar_url,
          type: 'user'
        });
      });

      // Add groups/channels
      [...(ownedChats || []), ...memberChats].forEach(chat => {
        if (!allTargets.find(t => t.id === chat.id)) {
          allTargets.push({
            id: chat.id,
            name: chat.name,
            avatar_url: chat.avatar_url,
            type: chat.type as 'group' | 'channel'
          });
        }
      });

      setTargets(allTargets);
    } catch (error) {
      console.error('Error fetching targets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTarget = (targetId: string) => {
    setSelectedTargets(prev => 
      prev.includes(targetId)
        ? prev.filter(id => id !== targetId)
        : [...prev, targetId]
    );
  };

  const handleForward = async () => {
    if (selectedTargets.length === 0) {
      toast.error('Kimgadir tanlang');
      return;
    }

    setIsSending(true);

    try {
      for (const targetId of selectedTargets) {
        const target = targets.find(t => t.id === targetId);
        if (!target) continue;

        if (target.type === 'user') {
          // Get or create conversation
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .or(`and(participant1_id.eq.${user?.id},participant2_id.eq.${targetId}),and(participant1_id.eq.${targetId},participant2_id.eq.${user?.id})`)
            .maybeSingle();

          let conversationId = existingConv?.id;

          if (!conversationId) {
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                participant1_id: user?.id,
                participant2_id: targetId
              })
              .select('id')
              .single();
            conversationId = newConv?.id;
          }

          if (conversationId) {
            await supabase
              .from('messages')
              .insert({
                conversation_id: conversationId,
                sender_id: user?.id,
                content: `↪️ Yo'naltirilgan: ${messageContent}`,
                media_url: mediaUrl,
                media_type: mediaType,
                status: 'sent'
              });
          }
        } else {
          // Forward to group/channel
          await supabase
            .from('group_messages')
            .insert({
              group_id: targetId,
              sender_id: user?.id,
              content: `↪️ Yo'naltirilgan: ${messageContent}`,
              media_url: mediaUrl,
              media_type: mediaType
            });
        }
      }

      toast.success('Xabar yo\'naltirildi');
      onOpenChange(false);
      setSelectedTargets([]);
    } catch (error) {
      console.error('Error forwarding message:', error);
      toast.error('Xatolik yuz berdi');
    } finally {
      setIsSending(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredTargets = targets.filter(target =>
    target.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xabarni yo'naltirish</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Yuklanmoqda...</p>
          ) : filteredTargets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Topilmadi</p>
          ) : (
            <div className="space-y-1">
              {filteredTargets.map((target) => (
                <div
                  key={target.id}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTargets.includes(target.id)
                      ? 'bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleTarget(target.id)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={target.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10">
                      {target.type === 'group' ? (
                        <Users className="h-5 w-5 text-primary" />
                      ) : target.type === 'channel' ? (
                        <Megaphone className="h-5 w-5 text-primary" />
                      ) : (
                        getInitials(target.name)
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{target.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {target.type === 'group' ? 'Guruh' : target.type === 'channel' ? 'Kanal' : 'Foydalanuvchi'}
                    </p>
                  </div>
                  {selectedTargets.includes(target.id) && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button 
            onClick={handleForward} 
            disabled={selectedTargets.length === 0 || isSending}
          >
            {isSending ? 'Yuborilmoqda...' : `Yuborish (${selectedTargets.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
