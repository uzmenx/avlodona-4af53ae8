import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Megaphone, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type GroupInfo = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  invite_link: string | null;
  owner_id: string;
};

const JoinGroup = () => {
  const { inviteLink } = useParams<{ inviteLink: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const icon = useMemo(() => {
    if (!group) return null;
    return group.type === 'group' ? <Users className="h-8 w-8 text-primary" /> : <Megaphone className="h-8 w-8 text-primary" />;
  }, [group]);

  const load = useCallback(async () => {
    if (!inviteLink) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('group_chats')
        .select('id,name,description,avatar_url,type,visibility,invite_link,owner_id')
        .eq('invite_link', inviteLink)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setGroup(null);
        return;
      }

      const g = data as any as GroupInfo;
      setGroup(g);

      if (g.owner_id === user?.id) {
        setIsMember(true);
      } else if (user?.id) {
        const { data: membership } = await supabase
          .from('group_members')
          .select('id')
          .eq('group_id', g.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsMember(!!membership);
      } else {
        setIsMember(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
      setGroup(null);
    } finally {
      setIsLoading(false);
    }
  }, [inviteLink, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = useCallback(async () => {
    if (!group || !user?.id) return;
    if (isJoining) return;
    if (group.visibility !== 'public') {
      toast.error('Bu yopiq guruh/kanal');
      return;
    }

    setIsJoining(true);
    try {
      const { error } = await supabase.from('group_members').upsert(
        {
          group_id: group.id,
          user_id: user.id,
          role: 'member',
        } as any,
        { onConflict: 'group_id,user_id' }
      );
      if (error) throw error;
      toast.success("Qo'shildingiz");
      navigate(`/group-chat/${group.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
    } finally {
      setIsJoining(false);
    }
  }, [group, isJoining, navigate, user?.id]);

  const openChat = useCallback(() => {
    if (!group) return;
    navigate(`/group-chat/${group.id}`);
  }, [group, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/50 backdrop-blur-xl border-b border-border/50">
          <div className="px-3 py-2.5 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-[15px]">Taklif topilmadi</h1>
          </div>
        </div>

        <div className="max-w-md mx-auto p-6">
          <div className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-md p-6 text-center">
            <p className="text-sm text-muted-foreground">Havola noto‘g‘ri yoki eskirgan bo‘lishi mumkin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/50 backdrop-blur-xl border-b border-border/50">
        <div className="px-3 py-2.5 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/messages')} className="h-9 w-9 rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-[15px] truncate">Taklif</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6">
        <div className="rounded-3xl border border-border/50 bg-card/50 backdrop-blur-md p-6">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 ring-2 ring-primary/20">
              <AvatarImage src={group.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10">{icon}</AvatarFallback>
            </Avatar>

            <h2 className="mt-4 text-xl font-semibold">{group.name}</h2>
            {group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}

            <p className="mt-4 text-xs text-muted-foreground">
              {group.type === 'group' ? 'Guruh' : 'Kanal'} · {group.visibility === 'public' ? 'Ommaviy' : 'Yopiq'}
            </p>
          </div>

          <div className="mt-6 space-y-2">
            {isMember ? (
              <Button
                onClick={openChat}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white"
              >
                Ochish
              </Button>
            ) : group.visibility !== 'public' ? (
              <Button disabled className="w-full h-11 rounded-2xl">
                Bu yopiq {group.type === 'group' ? 'guruh' : 'kanal'}
              </Button>
            ) : (
              <Button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full h-11 rounded-2xl bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(263,70%,50%)] text-white"
              >
                {isJoining ? "Qo'shilmoqda..." : 'JOIN'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinGroup;
