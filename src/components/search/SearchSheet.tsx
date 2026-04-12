import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, X, Users, FileText, Megaphone, ChevronRight, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { StarUsername } from '@/components/user/StarUsername';
import { FollowButton } from '@/components/user/FollowButton';
import { UnifiedFullScreenViewer } from '@/components/feed/UnifiedFullScreenViewer';
import { Post } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

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

interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
  invite_link?: string | null;
}

export const SearchSheet = ({ open, onOpenChange, initialQuery, userIdFilter, initialTab }: SearchSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'users' | 'posts' | 'groups'>(initialTab || 'users');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<GroupResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [memberGroups, setMemberGroups] = useState<Set<string>>(new Set());
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  // Fullscreen viewer for posts
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Load which groups current user is already a member of
  const loadMemberships = useCallback(async (groupIds: string[]) => {
    if (!user?.id || groupIds.length === 0) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)
      .in('group_id', groupIds);
    if (data) {
      setMemberGroups(new Set(data.map((r: { group_id: string }) => r.group_id)));
    }
  }, [user?.id]);

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

      const groupsQuery = supabase
        .from('group_chats')
        .select('id, name, description, avatar_url, type, visibility, invite_link')
        .eq('visibility', 'public')
        .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
        .order('created_at', { ascending: false })
        .limit(20);

      const [usersRes, groupsRes] = await Promise.all([usersQuery, groupsQuery]);

      setUsers(usersRes.data || []);
      const fetchedGroups = (groupsRes.data as unknown as GroupResult[]) || [];
      setGroups(fetchedGroups);
      await loadMemberships(fetchedGroups.map(g => g.id));

      // Post search
      const matchedUserIds = (usersRes.data || []).map(u => u.id);
      const { data: matchedComments } = await supabase
        .from('comments')
        .select('post_id')
        .ilike('content', searchTerm)
        .limit(50);

      const matchedPostIdsFromComments = (matchedComments || []).map((c: { post_id: string }) => c.post_id);
      const orClauses = [`content.ilike.${searchTerm}`];
      if (matchedUserIds.length > 0) orClauses.push(`user_id.in.(${matchedUserIds.join(',')})`);
      if (matchedPostIdsFromComments.length > 0) orClauses.push(`id.in.(${matchedPostIdsFromComments.join(',')})`);

      let postsQuery = supabase
        .from('posts')
        .select('*')
        .or(orClauses.join(','))
        .order('created_at', { ascending: false })
        .limit(20);

      if (userIdFilter) postsQuery = postsQuery.eq('user_id', userIdFilter);

      const { data: postData } = await postsQuery;

      if (postData && postData.length > 0) {
        const userIds = [...new Set(postData.map(p => p.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds);
        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const postsWithAuthor = postData.map(post => {
          const ap = profileMap.get(post.user_id);
          return {
            ...post,
            media_urls: post.media_urls || [],
            author: ap ? {
              id: ap.id,
              full_name: ap.name || 'Foydalanuvchi',
              username: ap.username || 'user',
              bio: ap.bio || '',
              avatar_url: ap.avatar_url || '',
              cover_url: '',
              instagram: '',
              telegram: '',
              followers_count: 0,
              following_count: 0,
              relatives_count: 0,
              created_at: post.created_at,
            } : undefined,
          };
        }) as Post[];
        setPosts(postsWithAuthor);
      } else {
        setPosts([]);
      }
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userIdFilter, loadMemberships]);

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
      setMemberGroups(new Set());
      setTab(initialTab || 'users');
      setViewerOpen(false);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (open && initialQuery) setQuery(initialQuery);
  }, [open, initialQuery]);

  useEffect(() => {
    if (open && initialTab) setTab(initialTab);
  }, [open, initialTab]);

  // Auto-focus input when sheet opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const goToUser = (userId: string) => {
    onOpenChange(false);
    navigate(`/user/${userId}`);
  };

  const goToGroup = (groupId: string) => {
    onOpenChange(false);
    navigate(`/group-chat/${groupId}`);
  };

  const handleJoinGroup = async (g: GroupResult) => {
    if (!user?.id) return;
    setJoiningGroupId(g.id);
    try {
      // Try RPC first for secure joining
      const { error } = await (supabase as any).rpc('join_group_via_invite', {
        invite_str: g.invite_link,
      });

      if (error) {
        // Fallback: direct upsert for public groups
        const { error: fallbackError } = await supabase.from('group_members').upsert(
          { group_id: g.id, user_id: user.id, role: 'member' },
          { onConflict: 'group_id,user_id' }
        );
        if (fallbackError) throw fallbackError;
      }

      setMemberGroups(prev => new Set([...prev, g.id]));
      toast.success(`"${g.name}" guruhiga qo'shildingiz!`);
    } catch (e) {
      console.error('Join group error:', e);
      toast.error('Guruhga qo\'shilishda xatolik yuz berdi');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const openPostViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <Sheet open={open && !viewerOpen} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 flex flex-col">
          <SheetHeader className="px-4 pt-5 pb-2 flex-shrink-0">
            <SheetTitle className="text-base font-bold">Qidirish</SheetTitle>
          </SheetHeader>

          {/* Search input */}
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, username yoki guruh qidiring..."
                className="pl-9 pr-9 h-11 rounded-2xl bg-muted/60 border-0 focus-visible:ring-1"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/80">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'users' | 'posts' | 'groups')} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 mb-2 grid grid-cols-3 h-9 flex-shrink-0">
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

            {/* ── USERS ───────────────────────────────────────── */}
            <TabsContent value="users" className="flex-1 overflow-y-auto px-4 mt-0 pb-8">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Qidirilmoqda...</p>}
              {!isLoading && query && users.length === 0 && (
                <div className="text-center py-12">
                  <UserPlus className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Hech narsa topilmadi</p>
                </div>
              )}
              {!isLoading && !query && (
                <p className="text-sm text-muted-foreground text-center py-10">Foydalanuvchi nomi yoki ismini kiriting</p>
              )}
              <div className="space-y-1">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/40 transition-colors"
                  >
                    {/* Avatar → go to profile */}
                    <button onClick={() => goToUser(u.id)} className="flex-shrink-0">
                      <Avatar className="h-11 w-11 ring-2 ring-border">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="font-bold text-base">{(u.name || u.username || 'U')[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </button>

                    {/* Info → go to profile */}
                    <button onClick={() => goToUser(u.id)} className="flex-1 text-left min-w-0">
                      <p className="text-sm font-semibold truncate">{u.name || u.username}</p>
                      {u.username && <StarUsername username={u.username} />}
                    </button>

                    {/* Follow button - no navigate on click */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      <FollowButton targetUserId={u.id} size="sm" />
                      <button onClick={() => goToUser(u.id)} className="p-1.5 rounded-full hover:bg-muted">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── POSTS ───────────────────────────────────────── */}
            <TabsContent value="posts" className="flex-1 overflow-y-auto px-4 mt-0 pb-8">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Qidirilmoqda...</p>}
              {!isLoading && query && posts.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Hech narsa topilmadi</p>
                </div>
              )}
              {!isLoading && !query && (
                <p className="text-sm text-muted-foreground text-center py-10">Qidirish uchun so'z kiriting</p>
              )}

              {/* Post grid for quick browse */}
              {posts.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 pb-4">
                  {posts.map((p, index) => {
                    const mediaUrls = p.media_urls?.length > 0 ? p.media_urls : p.image_url ? [p.image_url] : [];
                    const firstMedia = mediaUrls[0];
                    const isVid = firstMedia && (firstMedia.includes('.mp4') || firstMedia.includes('.mov') || firstMedia.includes('.webm'));

                    return (
                      <button
                        key={p.id}
                        onClick={() => openPostViewer(index)}
                        className="relative aspect-square rounded-2xl overflow-hidden bg-muted hover:opacity-90 active:opacity-75 transition-opacity"
                      >
                        {firstMedia ? (
                          isVid ? (
                            <>
                              <video
                                src={firstMedia}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              {/* Video indicator */}
                              <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full px-1.5 py-0.5 text-[10px] text-white font-semibold">▶</div>
                            </>
                          ) : (
                            <img src={firstMedia} alt="" className="w-full h-full object-cover" />
                          )
                        ) : (
                          /* Text-only post */
                          <div className="w-full h-full flex items-center justify-center p-3 bg-gradient-to-br from-primary/10 to-primary/5">
                            <p className="text-xs text-foreground/80 text-center line-clamp-4">{p.content}</p>
                          </div>
                        )}

                        {/* Multiple media indicator */}
                        {mediaUrls.length > 1 && (
                          <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1">
                            <div className="grid grid-cols-2 gap-0.5 w-3 h-3">
                              {[0,1,2,3].map(i => <div key={i} className="bg-white rounded-[1px]" />)}
                            </div>
                          </div>
                        )}

                        {/* Author avatar overlay */}
                        {p.author?.avatar_url && (
                          <div className="absolute bottom-1.5 left-1.5">
                            <Avatar className="h-6 w-6 ring-1 ring-white/60">
                              <AvatarImage src={p.author.avatar_url} />
                              <AvatarFallback className="text-[9px]">{(p.author.full_name || 'U')[0]}</AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── GROUPS ──────────────────────────────────────── */}
            <TabsContent value="groups" className="flex-1 overflow-y-auto px-4 mt-0 pb-8">
              {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Qidirilmoqda...</p>}
              {!isLoading && query && groups.length === 0 && (
                <div className="text-center py-12">
                  <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Hech narsa topilmadi</p>
                </div>
              )}
              {!isLoading && !query && (
                <p className="text-sm text-muted-foreground text-center py-10">Guruh nomini kiriting</p>
              )}
              <div className="space-y-1">
                {groups.map((g) => {
                  const isMember = memberGroups.has(g.id);
                  const isJoining = joiningGroupId === g.id;
                  return (
                    <div
                      key={g.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-muted/40 transition-colors"
                    >
                      {/* Avatar */}
                      <button onClick={() => goToGroup(g.id)} className="flex-shrink-0">
                        <Avatar className="h-12 w-12 ring-2 ring-border">
                          <AvatarImage src={g.avatar_url || undefined} />
                          <AvatarFallback>
                            {g.type === 'group' ? <Users className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                      </button>

                      {/* Info */}
                      <button onClick={() => goToGroup(g.id)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold truncate">{g.name}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary whitespace-nowrap flex-shrink-0">
                            {g.type === 'group' ? 'Guruh' : 'Kanal'}
                          </span>
                        </div>
                        {g.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.description}</p>
                        )}
                      </button>

                      {/* Action: Join or Open */}
                      <div className="flex-shrink-0">
                        {isMember ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => goToGroup(g.id)}
                            className="rounded-full text-xs h-8 px-3"
                          >
                            Ochish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleJoinGroup(g)}
                            disabled={isJoining}
                            className="rounded-full text-xs h-8 px-3"
                          >
                            {isJoining ? '...' : "Qo'shilish"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Fullscreen post viewer - opens on top of everything */}
      {viewerOpen && posts.length > 0 && (
        <UnifiedFullScreenViewer
          posts={posts}
          shorts={[]}
          initialTab="posts"
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
};
