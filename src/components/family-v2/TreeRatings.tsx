import { useState, useEffect } from 'react';
import { Heart, Users, Trophy, Medal } from 'lucide-react';
import { Icon } from '@iconify/react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCount } from '@/lib/formatCount';
import { StarUsername } from '@/components/user/StarUsername';

interface RatingEntry {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  count: number;
}

export const TreeRatings = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'likes' | 'members'>('likes');
  const [likesRating, setLikesRating] = useState<RatingEntry[]>([]);
  const [membersRating, setMembersRating] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadRatings();
  }, [isOpen]);

  const loadRatings = async () => {
    setLoading(true);
    try {
      // Likes rating
      const { data: likes } = await (supabase as any)
        .from('tree_post_likes')
        .select('tree_post_id');

      const { data: publishedPosts } = await supabase
        .from('tree_posts')
        .select('id, user_id')
        .eq('is_published', true);

      if (publishedPosts && likes) {
        const postOwnerMap = new Map(publishedPosts.map(p => [p.id, p.user_id]));
        const userLikes = new Map<string, number>();
        ((likes as any[]) || []).forEach((l: any) => {
          const owner = postOwnerMap.get(l.tree_post_id);
          if (owner) userLikes.set(owner, (userLikes.get(owner) || 0) + 1);
        });

        const userIds = [...userLikes.keys()];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', userIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p]));
          const sorted = [...userLikes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([uid, count]) => ({
              user_id: uid,
              count,
              ...(profileMap.get(uid) || { name: null, username: null, avatar_url: null }),
            }));
          setLikesRating(sorted);
        }
      }

      // Members rating
      const { data: memberCounts } = await supabase
        .from('family_tree_members')
        .select('owner_id');

      if (memberCounts) {
        const ownerCounts = new Map<string, number>();
        memberCounts.forEach(m => {
          ownerCounts.set(m.owner_id, (ownerCounts.get(m.owner_id) || 0) + 1);
        });

        const userIds = [...ownerCounts.keys()];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, username, avatar_url')
          .in('id', userIds);

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const sorted = [...ownerCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([uid, count]) => ({
            user_id: uid,
            count,
            ...(profileMap.get(uid) || { name: null, username: null, avatar_url: null }),
          }));
        setMembersRating(sorted);
      }
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setLoading(false);
    }
  };

  const data = tab === 'likes' ? likesRating : membersRating;

  const getMedal = (i: number) => {
    if (i === 0) return <Trophy className="h-5 w-5 text-primary" />;
    if (i === 1) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (i === 2) return <Medal className="h-5 w-5 text-accent-foreground" />;
    return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{i + 1}</span>;
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-9 w-9 rounded-full bg-amber-50 dark:bg-amber-500/10 shadow-[0_0_0_4px_rgba(251,191,36,0.18)] dark:shadow-[0_0_0_4px_rgba(251,191,36,0.10)]"
      >
        <Icon icon="noto:trophy" className="h-[22px] w-[22px]" />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Daraxt reytingi</SheetTitle>
          </SheetHeader>

          <div className="flex gap-2 mt-3 mb-4">
            <Button
              variant={tab === 'likes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('likes')}
              className="flex-1 gap-1.5 rounded-xl"
            >
              <Heart className="h-4 w-4" /> Layklar
            </Button>
            <Button
              variant={tab === 'members' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('members')}
              className="flex-1 gap-1.5 rounded-xl"
            >
              <Users className="h-4 w-4" /> Profillar soni
            </Button>
          </div>

          <ScrollArea className="h-[calc(100%-100px)]">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Yuklanmoqda...</p>
            ) : data.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Hali ma'lumot yo'q</p>
            ) : (
              <div className="space-y-2">
                {data.map((entry, i) => (
                  <div key={entry.user_id} className="flex items-center gap-3 p-2 rounded-xl bg-muted/30">
                    {getMedal(i)}
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={entry.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{(entry.name || 'U')[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name || 'Foydalanuvchi'}</p>
                      <StarUsername username={entry.username || 'user'} />
                    </div>
                    <div className="flex items-center gap-1">
                      {tab === 'likes' ? <Heart className="h-3.5 w-3.5 text-destructive" /> : <Users className="h-3.5 w-3.5 text-primary" />}
                      <span className="text-sm font-bold">{formatCount(entry.count)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
};
