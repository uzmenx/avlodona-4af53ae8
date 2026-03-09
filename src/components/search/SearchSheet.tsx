import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, Users, FileText, Megaphone, Eye, Heart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StarUsername } from '@/components/user/StarUsername';

interface SearchSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
  userIdFilter?: string;
  initialTab?: 'users' | 'posts' | 'groups';
}

interface UserResult {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface PostResult {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  created_at: string;
  user_id: string;
  likes_count?: number | null;
  views_count?: number | null;
  profile?: UserResult;
}

interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
}

export const SearchSheet = ({ open, onOpenChange, initialQuery, userIdFilter, initialTab }: SearchSheetProps) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'users' | 'posts' | 'groups'>(initialTab || 'users');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setUsers([]);
      setPosts([]);
      setGroups([]);
      return;
    }
    setIsLoading(true);
    try {
      const searchTerm = `%${q.trim()}%`;

      const usersQuery = supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .or(`username.ilike.${searchTerm},name.ilike.${searchTerm}`)
        .limit(20);

      let postsQuery = supabase
        .from('posts')
        .select('id, content, media_urls, created_at, user_id, likes_count, views_count')
        .ilike('content', searchTerm)
        .order('created_at', { ascending: false })
        .limit(20);

      if (userIdFilter) {
        postsQuery = postsQuery.eq('user_id', userIdFilter);
      }

      const groupsQuery = supabase
        .from('group_chats')
        .select('id, name, description, avatar_url, type, visibility')
        .eq('visibility', 'public')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(20);

      const [usersRes, postsRes, groupsRes] = await Promise.all([usersQuery, postsQuery, groupsQuery]);

      setUsers(usersRes.data || []);
      setGroups((groupsRes as any).data || []);
      
      const postData = postsRes.data || [];
      if (postData.length > 0) {
        const userIds = [...new Set(postData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .in('id', userIds);
        
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        setPosts(postData.map(p => ({ ...p, profile: profileMap.get(p.user_id) })));
      } else {
        setPosts([]);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userIdFilter]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setUsers([]);
      setPosts([]);
      setGroups([]);
      setTab(initialTab || 'users');
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (open && initialQuery) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const goToUser = (userId: string) => {
    onOpenChange(false);
    navigate(`/user/${userId}`);
  };

  const goToGroup = (groupId: string) => {
    onOpenChange(false);
    navigate(`/group-chat/${groupId}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="text-base">Qidirish</SheetTitle>
        </SheetHeader>

        {/* Search input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ism, username yoki post qidiring..."
              className="pl-9 pr-9 h-10 rounded-xl"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'users' | 'posts' | 'groups')} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mb-2 grid grid-cols-3 h-9">
            <TabsTrigger value="users" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" />
              Odamlar {users.length > 0 && `(${users.length})`}
            </TabsTrigger>
            <TabsTrigger value="posts" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" />
              Postlar {posts.length > 0 && `(${posts.length})`}
            </TabsTrigger>
            <TabsTrigger value="groups" className="text-xs gap-1">
              <Megaphone className="h-3.5 w-3.5" />
              Guruhlar {groups.length > 0 && `(${groups.length})`}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-4">
            <TabsContent value="users" className="mt-0 space-y-1">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Qidirilmoqda...</p>}
              {!isLoading && query && users.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Hech narsa topilmadi</p>
              )}
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => goToUser(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url || undefined} />
                    <AvatarFallback>{(u.name || u.username || 'U')[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-semibold">{u.name || u.username}</p>
                    {u.username && <StarUsername username={u.username} />}
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="posts" className="mt-0">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Qidirilmoqda...</p>}
              {!isLoading && query && posts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Hech narsa topilmadi</p>
              )}
              {posts.length > 0 && (
                <div className="flex p-1 gap-px">
                  <div className="flex-1 flex flex-col gap-1">
                    {posts.filter((_, i) => i % 2 === 0).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => { onOpenChange(false); }}
                        className="cursor-pointer"
                      >
                        <SearchMasonryItem post={p} />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {posts.filter((_, i) => i % 2 === 1).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => { onOpenChange(false); }}
                        className="cursor-pointer"
                      >
                        <SearchMasonryItem post={p} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="groups" className="mt-0 space-y-1">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Qidirilmoqda...</p>}
              {!isLoading && query && groups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Hech narsa topilmadi</p>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => goToGroup(g.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={g.avatar_url || undefined} />
                    <AvatarFallback>
                      {g.type === 'group' ? <Users className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold truncate">{g.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                        {g.type === 'group' ? 'Guruh' : 'Kanal'}
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

const SearchMasonryItem = ({ post }: { post: PostResult }) => {
  const mediaUrl = post.media_urls?.[0];
  const isVideo = !!mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm'));
  const likesCount = post.likes_count ?? 0;
  const viewsCount = post.views_count ?? 0;

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
      {mediaUrl ? (
        <>
          {isVideo ? (
            <video
              src={mediaUrl}
              className="w-full h-auto block"
              style={{ maxHeight: '80vh' }}
              muted
              playsInline
              loop
              preload="metadata"
            />
          ) : (
            <img src={mediaUrl} alt="Post" className="w-full h-auto block" style={{ maxHeight: '80vh' }} />
          )}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
            <div className="text-white text-[11px] leading-tight">
              <div className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                <span>{likesCount}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Eye className="h-3.5 w-3.5" />
                <span>{viewsCount}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
          {post.content?.substring(0, 50)}
        </div>
      )}
    </div>
  );
};
