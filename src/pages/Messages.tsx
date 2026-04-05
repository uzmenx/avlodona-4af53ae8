import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConversations } from "@/hooks/useConversations";
import { useGroupChats } from "@/hooks/useGroupChats";
import { useNotifications } from "@/hooks/useNotifications";
import { useActiveStories } from "@/hooks/useActiveStories";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBlockedUsers } from '@/hooks/useBlockedUsers';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StarUsername } from '@/components/user/StarUsername';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, Users, Megaphone, Bell, Sparkles, Edit2, Trash2, X, CheckSquare, Music, ChevronDown } from "lucide-react";
import { Icon } from '@iconify/react';
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { uz } from "date-fns/locale";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NotificationsTab } from "@/components/notifications/NotificationsTab";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getStoryRingGradient as getStoryRingGradientFn } from "@/components/stories/storyRings";
import { StoryViewer } from "@/components/stories/StoryViewer";
import type { StoryGroup, Story } from "@/hooks/useStories";
import { addSwipeGestures } from "@/utils/scrollBehavior";

// Group components
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { AddMembersDialog } from "@/components/groups/AddMembersDialog";
import { ChannelVisibilityDialog } from "@/components/groups/ChannelVisibilityDialog";
import { GroupChatItem } from "@/components/groups/GroupChatItem";
import { RingtoneSelector } from "@/components/chat/RingtoneSelector";

interface FollowUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface GlobalUserResult {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface GlobalGroupResult {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  type: 'group' | 'channel';
  visibility: 'public' | 'private';
}

type TabValue = "all" | "groups" | "channels" | "followers" | "following" | "notifications";

interface PendingGroupData {
  name: string;
  description: string;
  avatarUrl: string | null;
  memberIds?: string[];
}

const Messages = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const { conversations, isLoading: convLoading, totalUnread, refetch: refetchConversations } = useConversations();
  const { groups, channels, isLoading: groupsLoading, createGroupChat, refetch: refetchGroups } = useGroupChats();
  const { unreadCount: notifUnreadCount } = useNotifications();
  const { getStoryInfo } = useActiveStories();
  const { isEitherBlocked } = useBlockedUsers();

  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyViewerGroups, setStoryViewerGroups] = useState<StoryGroup[]>([]);

  // Check if tab param is set to notifications
  const initialTab = searchParams.get("tab") === "notifications" ? "notifications" : "all";
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [globalUsers, setGlobalUsers] = useState<GlobalUserResult[]>([]);
  const [globalGroups, setGlobalGroups] = useState<GlobalGroupResult[]>([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  const topRef = useRef<HTMLDivElement | null>(null);
  const swipeTabRef = useRef<HTMLDivElement | null>(null);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchConversations(), refetchGroups()]);
  }, [refetchConversations, refetchGroups]);

  useEffect(() => {
    const onNavMessages = (e: Event) => {
      const ce = e as CustomEvent<{action?: 'scrollTop' | 'refresh';}>;
      if (ce.detail?.action === 'refresh') {
        void handleRefresh();
        return;
      }

      const el = topRef.current;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('avlodona:nav:messages', onNavMessages as EventListener);
    return () => window.removeEventListener('avlodona:nav:messages', onNavMessages as EventListener);
  }, [handleRefresh]);

  useEffect(() => {
    const el = swipeTabRef.current;
    if (!el) return;

    const order: TabValue[] = ['all', 'groups', 'channels'];
    const idx = order.indexOf(activeTab);
    if (idx < 0 || !['all', 'groups', 'channels'].includes(activeTab)) return;

    const cleanup = addSwipeGestures(
      el,
      () => {
        const next = order[idx + 1];
        if (next) setActiveTab(next);
      },
      () => {
        const prev = order[idx - 1];
        if (prev) setActiveTab(prev);
      }
    );

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [activeTab]);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [showRingtoneSelector, setShowRingtoneSelector] = useState(false);

  // Group/Channel creation flow
  const [createType, setCreateType] = useState<"group" | "channel" | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [showVisibilityDialog, setShowVisibilityDialog] = useState(false);
  const [pendingGroupData, setPendingGroupData] = useState<PendingGroupData | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchFollowUsers = async () => {
      // Fetch followers
      const { data: followersData } = await supabase.from("follows").select("follower_id").eq("following_id", user.id);

      if (followersData) {
        const followerIds = followersData.map((f) => f.follower_id);
        if (followerIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", followerIds);
          setFollowers(profiles || []);
        }
      }

      // Fetch following
      const { data: followingData } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);

      if (followingData) {
        const followingIds = followingData.map((f) => f.following_id);
        if (followingIds.length > 0) {
          const { data: profiles } = await supabase.from("profiles").select("id, name, username, avatar_url").in("id", followingIds);
          setFollowing(profiles || []);
        }
      }
    };

    fetchFollowUsers();
  }, [user?.id]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: false, locale: uz });
  };

  const formatLastMessagePreview = (content: string | null | undefined) => {
    if (!content) return '';
    const hasPost = /\[\[POST:[^\]]+\]\]/.test(content);
    const hasShort = /\[\[SHORT:[^\]]+\]\]/.test(content);

    const cleaned = content.
    replace(/\[\[(POST|SHORT):[^\]]+\]\]/g, '').
    replace(/\n?📎\s*(Post|Shorts):\s*\S+/g, '').
    replace(/https?:\/\/\S+/g, '').
    trim();

    if (!cleaned) {
      if (hasPost) return 'Post';
      if (hasShort) return 'Shorts';
      return '';
    }

    // If it contained a marker, keep a short label rather than leaking the marker
    if (hasPost) return `Post: ${cleaned}`;
    if (hasShort) return `Shorts: ${cleaned}`;
    return cleaned;
  };

  const handleUserClick = (userId: string) => {
    if (isEitherBlocked(userId)) {
      toast.error('Bu foydalanuvchi bilan chat cheklangan');
      return;
    }
    navigate(`/chat/${userId}`);
  };

  const fetchStoryGroupForUser = async (targetUserId: string): Promise<StoryGroup | null> => {
    try {
      const { data: stories, error } = await supabase.from('stories').select('*').eq('user_id', targetUserId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: true });

      if (error) throw error;
      if (!stories || stories.length === 0) return null;

      const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', [targetUserId]);

      const authorProfile = profiles?.find((p) => p.id === targetUserId);
      const viewerId = user?.id;

      const [viewsRes, likesRes] = await Promise.all([
      viewerId ?
      supabase.from('story_views').select('story_id').eq('viewer_id', viewerId).in('story_id', stories.map((s) => s.id)) :
      Promise.resolve({ data: [] as { story_id: string }[] }),
      viewerId ?
      supabase.from('story_likes').select('story_id').eq('user_id', viewerId).in('story_id', stories.map((s) => s.id)) :
      Promise.resolve({ data: [] as { story_id: string }[] })]
      );

      const viewedStoryIds = new Set((viewsRes as { data: { story_id: string }[] | null })?.data?.map((v) => v.story_id) || []);
      const likedStoryIds = new Set((likesRes as { data: { story_id: string }[] | null })?.data?.map((l) => l.story_id) || []);

      const normalizedStories: Story[] = stories.map((s: Record<string, unknown>) => ({
        ...s,
        media_type: s.media_type as 'image' | 'video',
        ring_id: s.ring_id || 'default',
        author: authorProfile ?
        {
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          avatar_url: authorProfile.avatar_url
        } :
        undefined,
        has_viewed: viewerId ? viewedStoryIds.has(s.id) : false,
        has_liked: viewerId ? likedStoryIds.has(s.id) : false
      }));

      return {
        user_id: targetUserId,
        user: authorProfile || { id: targetUserId, name: null, username: null, avatar_url: null },
        stories: normalizedStories,
        has_unviewed: normalizedStories.some((s) => !s.has_viewed)
      };
    } catch (err) {
      console.error('Error fetching user stories:', err);
      return null;
    }
  };

  const openStoriesForUser = async (targetUserId: string) => {
    const g = await fetchStoryGroupForUser(targetUserId);
    if (!g) return;
    setStoryViewerGroups([g]);
    setStoryViewerOpen(true);
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/group-chat/${groupId}`);
  };

  const handleOpenGlobalUser = (userId: string) => {
    if (isEitherBlocked(userId)) {
      toast.error('Bu foydalanuvchi bilan chat cheklangan');
      return;
    }
    navigate(`/user/${userId}`);
  };

  useEffect(() => {
    let cancelled = false;
    const q = searchQuery.trim();

    if (!q) {
      setGlobalUsers([]);
      setGlobalGroups([]);
      setGlobalLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setGlobalLoading(true);
      try {
        const searchTerm = `%${q}%`;

        const usersQuery = supabase.
        from('profiles').
        select('id, name, username, avatar_url').
        or(`username.ilike.${searchTerm},name.ilike.${searchTerm}`).
        limit(10);

        const groupsQuery = supabase.
        from('group_chats').
        select('id, name, description, avatar_url, type, visibility').
        eq('visibility', 'public').
        or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`).
        order('created_at', { ascending: false }).
        limit(10);

        const [usersRes, groupsRes] = await Promise.all([usersQuery, groupsQuery]);
        if (cancelled) return;

        const rawUsers = (usersRes.data || []) as GlobalUserResult[];
        const cleanedUsers = rawUsers.filter((u) => u.id !== user?.id);
        setGlobalUsers(cleanedUsers);
        setGlobalGroups((groupsRes.data as unknown as GlobalGroupResult[]) || []);
      } catch (e) {
        console.error('Global search error:', e);
      } finally {
        if (!cancelled) setGlobalLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isEitherBlocked, searchQuery, user?.id]);

  // Filter functions
  const filteredConversations = (conversations ?? []).filter((conv) => {
    if (!searchQuery) return true;
    const name = conv.otherUser.name?.toLowerCase() || "";
    const username = conv.otherUser.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredGroups = (groups ?? []).filter((g) => {
    if (!searchQuery) return true;
    return g.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredChannels = (channels ?? []).filter((c) => {
    if (!searchQuery) return true;
    return c.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredFollowers = followers.filter((f) => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || "";
    const username = f.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const filteredFollowing = following.filter((f) => {
    if (!searchQuery) return true;
    const name = f.name?.toLowerCase() || "";
    const username = f.username?.toLowerCase() || "";
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  // Combine and sort all chats for the "All" tab
  const allChats = [
    ...filteredConversations.map(conv => ({ ...conv, chatType: 'direct' as const, sortTime: conv.last_message_at || new Date(0).toISOString() })),
    ...filteredGroups.map(group => ({ ...group, chatType: 'group' as const, sortTime: group.lastMessage?.created_at || group.created_at })),
    ...filteredChannels.map(channel => ({ ...channel, chatType: 'channel' as const, sortTime: channel.lastMessage?.created_at || channel.created_at }))
  ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());

  // Create group/channel handlers
  const handleNewGroup = () => {
    setCreateType("group");
    setShowCreateDialog(true);
  };

  const handleNewChannel = () => {
    setCreateType("channel");
    setShowCreateDialog(true);
  };

  const handleCreateNext = (name: string, description: string, avatarUrl: string | null) => {
    setPendingGroupData({ name, description, avatarUrl });
    setShowCreateDialog(false);
    setShowMembersDialog(true);
  };

  const handleMembersComplete = async (memberIds: string[]) => {
    if (!pendingGroupData || !createType) return;

    if (createType === "channel") {
      setShowMembersDialog(false);
      setShowVisibilityDialog(true);
      // Store memberIds temporarily
      setPendingGroupData({
        ...pendingGroupData,
        memberIds: memberIds
      });
    } else {
      // Create group immediately
      const groupId = await createGroupChat(
        pendingGroupData.name,
        "group",
        memberIds,
        pendingGroupData.description,
        pendingGroupData.avatarUrl || undefined,
        "private"
      );

      if (groupId) {
        toast.success(t('groupCreated'));
        setShowMembersDialog(false);
        resetCreateFlow();
        navigate(`/group-chat/${groupId}`);
      } else {
        toast.error(t('errorOccurred'));
      }
    }
  };

  const handleVisibilityComplete = async (visibility: "public" | "private", inviteLink: string) => {
    if (!pendingGroupData || !createType) return;

    const memberIds = pendingGroupData.memberIds || [];

    const channelId = await createGroupChat(
      pendingGroupData.name,
      "channel",
      memberIds,
      pendingGroupData.description,
      pendingGroupData.avatarUrl || undefined,
      visibility
    );

    if (channelId) {
      toast.success(t('channelCreated'));
      setShowVisibilityDialog(false);
      resetCreateFlow();
      navigate(`/group-chat/${channelId}`);
    } else {
      toast.error(t('errorOccurred'));
    }
  };

  const resetCreateFlow = () => {
    setCreateType(null);
    setPendingGroupData(null);
    setShowCreateDialog(false);
    setShowMembersDialog(false);
    setShowVisibilityDialog(false);
  };

  const isLoading = convLoading || groupsLoading;

  const tabBtnClass = (isActive: boolean) => cn(
    'flex-1 h-10 rounded-xl border text-sm font-semibold transition-colors',
    isActive ?
    'bg-gradient-to-r from-indigo-500/90 via-violet-500/90 to-fuchsia-500/90 border-white/20 text-white shadow-[0_14px_34px_-16px_rgba(99,102,241,0.9)]' :
    'bg-black/25 border-white/15 text-foreground hover:bg-black/35'
  );

  const allGroupLabel = activeTab === 'followers' ?
  t('followersTab') :
  activeTab === 'following' ?
  t('followingTab') :
  t('allChats');

  const isAllGroupActive = activeTab === 'all' || activeTab === 'followers' || activeTab === 'following';

  return (
    <AppLayout>
      <div ref={(n) => {topRef.current = n;}} />
      <div className="h-[100dvh] overflow-y-auto pb-20 overscroll-contain">

        {/* Header */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-indigo-500/25 via-violet-500/20 to-background/10 backdrop-blur-xl">
          <div className="px-4 flex items-center gap-3 py-[5px]">
            {isEditMode ?
            <>
                <Button variant="ghost" size="icon" onClick={() => {setIsEditMode(false);setSelectedConvIds(new Set());}}>
                  <X className="h-5 w-5" />
                </Button>
                <span className="flex-1 font-semibold">{selectedConvIds.size} tanlandi</span>
                <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRingtoneSelector(true)}
                title="Qo'ng'iroq ovozi">

                  <Music className="h-5 w-5" />
                </Button>
                <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                disabled={selectedConvIds.size === 0}
                onClick={async () => {
                  for (const id of selectedConvIds) {
                    // Delete all messages first, then conversation
                    await supabase.from('messages').delete().eq('conversation_id', id);
                    await supabase.from('conversations').delete().eq('id', id);
                  }
                  setSelectedConvIds(new Set());
                  setIsEditMode(false);
                  toast.success("O'chirildi");
                  // Refetch handled by realtime
                }}>

                  <Trash2 className="h-5 w-5" />
                </Button>
              </> :

            <>
                <h1 className="text-xl font-bold flex-1">{t('messages')}</h1>
                {totalUnread > 0 &&
              <Badge variant="destructive" className="rounded-full">
                    {totalUnread}
                  </Badge>
              }
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95 group">
                      <Icon 
                        icon="heroicons:sparkles-20-solid" 
                        className="h-5 w-5 text-primary/80 group-hover:text-primary transition-colors" 
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-60 border-white/10 bg-background/60 backdrop-blur-2xl rounded-[24px] p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Amallar</p>
                    </div>
                    <DropdownMenuItem 
                      onClick={() => setIsEditMode(true)}
                      className="rounded-[14px] focus:bg-primary/10 focus:text-primary cursor-pointer px-3 py-2.5 transition-colors gap-3"
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                        <Edit2 className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">Taxrirlash</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowRingtoneSelector(true)}
                      className="rounded-[14px] focus:bg-primary/10 focus:text-primary cursor-pointer px-3 py-2.5 transition-colors gap-3"
                    >
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                        <Music className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm">Rington sozlamalari</span>
                    </DropdownMenuItem>
                    
                    <div className="h-px bg-white/5 my-2 mx-2" />
                    
                    <div className="px-3 py-2 mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Yangi chat</p>
                    </div>
                    
                    <DropdownMenuItem 
                      onClick={handleNewGroup}
                      className="rounded-[14px] focus:bg-primary/10 focus:text-primary cursor-pointer px-3 py-2.5 transition-colors gap-3"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Yangi guruh</span>
                        <span className="text-[10px] opacity-60">Do'stlar va oila uchun</span>
                      </div>
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem 
                      onClick={handleNewChannel}
                      className="rounded-[14px] focus:bg-primary/10 focus:text-primary cursor-pointer px-3 py-2.5 transition-colors gap-3"
                    >
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 text-indigo-400">
                        <Megaphone className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">Yangi kanal</span>
                        <span className="text-[10px] opacity-60">Muhim yangiliklar uchun</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            }
          </div>

          {/* Search */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchChats')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-black/25 border-white/15 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0" />

            </div>
          </div>

          {/* Tabs - 2 rows */}
          <div className="px-4 pb-2 space-y-2">
             <div className="flex-row flex items-start justify-start gap-[3px]">
              <DropdownMenu>
                <div
                  className={cn(
                    "flex-1 h-10 rounded-full border overflow-hidden flex",
                    isAllGroupActive ?
                    "bg-gradient-to-r from-indigo-500/90 via-violet-500/90 to-fuchsia-500/90 border-white/20 text-white shadow-[0_14px_34px_-16px_rgba(99,102,241,0.9)]" :
                    "bg-black/25 border-white/15 text-foreground hover:bg-black/35"
                  )}
                  aria-label="All options">

                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "h-full w-[30%] flex items-center justify-center transition-colors",
                        isAllGroupActive ? "bg-black/10" : "bg-white/10",
                        "active:scale-[0.99]"
                      )}>

                      <span className="inline-flex items-center gap-1">
                        





                        <ChevronDown className="h-4 w-4 opacity-80" />
                      </span>
                    </button>
                  </DropdownMenuTrigger>

                  <button
                    type="button"
                    onClick={() => setActiveTab("all")}
                    className={cn(
                      "h-full flex-1 font-semibold flex items-center justify-center transition-colors",
                      "active:scale-[0.99]"
                    )}>

                    {t("allChats")}
                  </button>
                </div>
                <DropdownMenuContent align="start" className="min-w-44">
                  <DropdownMenuItem onClick={() => setActiveTab("all")}>{t("allChats")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("followers")}>{t("followersTab")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveTab("following")}>{t("followingTab")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("groups")} className={tabBtnClass(activeTab === "groups")}>
                <Users className="h-4 w-4 mr-1" />
                {t('groups')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setActiveTab("channels")} className={tabBtnClass(activeTab === "channels")}>
                <Megaphone className="h-4 w-4 mr-1" />
                {t('channels')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("notifications")}
                className={cn('flex-1 h-10 rounded-xl border text-sm font-semibold transition-colors relative justify-center',
                activeTab === 'notifications' ?
                'bg-black/25 border-white/15 text-foreground' :
                'bg-black/25 border-white/15 text-foreground hover:bg-black/35'
                )}>

                <Bell className="h-4 w-4 mr-1" />
                {notifUnreadCount > 0 &&
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] min-w-4">

                    {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                  </Badge>
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div ref={swipeTabRef} className="touch-pan-y">
          {/* All chats */}
          {activeTab === "all" &&
          <>
              {isLoading ?
            <div className="text-center py-12">
                   <p className="text-muted-foreground">{t('loading')}</p>
                </div> :

            <>
                  {searchQuery.trim() &&
              <div className="px-4 pb-2 space-y-2">
                      {globalLoading &&
                <p className="text-xs text-muted-foreground">{t('loading')}</p>
                }

                      {!globalLoading && globalUsers.length === 0 && globalGroups.length === 0 &&
                <p className="text-xs text-muted-foreground">Hech narsa topilmadi</p>
                }

                      {globalUsers.length > 0 &&
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
                          {globalUsers.map((u) =>
                  <button
                    key={u.id}
                    onClick={() => handleOpenGlobalUser(u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors">
                    
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={u.avatar_url || undefined} />
                                <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0 text-left">
                                <p className="font-semibold truncate">{u.name || u.username || t('user')}</p>
                                <div className="truncate">
                                  <StarUsername username={u.username || 'username'} textClassName="text-sm" />
                                </div>
                              </div>
                              <span className="px-3 py-1.5 rounded-xl border border-white/15 bg-black/10 text-xs font-semibold whitespace-nowrap">
                                {t('messageBtn')}
                              </span>
                            </button>
                  )}
                        </div>
                }

                      {globalGroups.length > 0 &&
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
                          {globalGroups.map((g) =>
                  <button
                    key={g.id}
                    onClick={() => handleGroupClick(g.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors">
                    
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={g.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10">
                                  {g.type === 'group' ?
                        <Users className="h-5 w-5 text-primary" /> :

                        <Megaphone className="h-5 w-5 text-primary" />
                        }
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold truncate">{g.name}</p>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                                    {g.type === 'group' ? 'Guruh' : 'Kanal'}
                                  </span>
                                </div>
                                {g.description && <p className="text-sm text-muted-foreground truncate">{g.description}</p>}
                              </div>
                            </button>
                  )}
                        </div>
                }
                    </div>
              }

                  {/* AI Do'stim - pinned contact */}
                  <div
                onClick={() => navigate('/ai-chat')}
                className="flex items-center gap-3 p-4 cursor-pointer active:bg-muted transition-colors relative overflow-hidden group">
                    {/* Glass background effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-pink-500/10 group-hover:from-violet-500/15 group-hover:to-pink-500/15 transition-all rounded-2xl border" />
                    <div className="relative flex items-center gap-3 w-full">
                      <div className="relative">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 p-[2px] shadow-lg shadow-purple-500/30">
                          <img
                        src="/ai-avatar.png"
                        alt="AI"
                        className="h-full w-full rounded-full object-cover bg-background"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/favicon.ico';
                        }} />

                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold truncate text-foreground">{t('aiName')}</h3>
                          <Sparkles className="h-3.5 w-3.5 text-purple-400 flex-shrink-0" />
                        </div>
                        <p className="text-sm text-muted-foreground truncate"> {t('aiDesc')}</p>
                      </div>
                      <Badge className="bg-gradient-to-r from-violet-500 to-pink-500 text-white border-0 text-[10px] px-2">
                        AI
                      </Badge>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {activeTab === 'all' && (
                      <>
                        {allChats.map((item) => {
                          if (item.chatType === 'direct') {
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isEditMode) {
                                    setSelectedConvIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id); else
                                      next.add(item.id);
                                      return next;
                                    });
                                  } else {
                                    handleUserClick(item.otherUser.id);
                                  }
                                }}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 active:scale-[0.99] rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md',
                                  isEditMode && selectedConvIds.has(item.id) ? 'bg-primary/10' : 'hover:bg-white/10'
                                )}>
                                <div className="relative">
                                  {(() => {
                                    const storyInfo = getStoryInfo(item.otherUser.id);
                                    if (storyInfo) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openStoriesForUser(item.otherUser.id);
                                          }}
                                          className="h-12 w-12 rounded-full p-[2px] flex items-center justify-center"
                                          style={{
                                            background: storyInfo.has_unviewed ?
                                            getStoryRingGradientFn(storyInfo.ring_id) :
                                            undefined
                                          }}
                                          aria-label="View story">
                                          {!storyInfo.has_unviewed && <div className="absolute inset-0 rounded-full bg-muted-foreground/30 p-[2px]" />}
                                          <div className="w-full h-full rounded-full bg-background p-[1.5px]">
                                            <Avatar className="h-full w-full">
                                              <AvatarImage src={item.otherUser.avatar_url || undefined} />
                                              <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
                                            </Avatar>
                                          </div>
                                        </button>
                                      );
                                    }
                                    return (
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage src={item.otherUser.avatar_url || undefined} />
                                        <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
                                      </Avatar>
                                    );
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <StarUsername username={item.otherUser.username || item.otherUser.name || 'Foydalanuvchi'} />
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                      {item.last_message_at ? formatTime(item.last_message_at) : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <p className={cn(
                                      "text-sm truncate leading-snug",
                                      item.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                                    )}>
                                      {item.lastMessage?.sender_id === user?.id ? `${t('you')}: ` : ""}
                                      {(item as { lastMessage?: { content: string } }).lastMessage?.content || t('noMessagesYet')}
                                    </p>
                                    {item.unreadCount > 0 && (
                                      <div className="bg-primary text-primary-foreground min-w-[20px] h-5 rounded-full px-1.5 flex items-center justify-center text-[10px] font-bold shadow-sm shadow-primary/20 shrink-0">
                                        {item.unreadCount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          return <GroupChatItem key={item.id} chat={item as any} onClick={() => handleGroupClick(item.id)} />;
                        })}

                        {allChats.length === 0 && (
                          <div className="text-center py-12 px-4">
                            <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground mt-1">{t('createGroupOrChannel')}</p>
                          </div>
                        )}
                      </>
                    )}


                    {/* Empty search results handled above */}

                  </div>
            </>
            }
            </>
          }

          {/* Groups */}
          {activeTab === "groups" &&
          <>
              {groupsLoading ?
            <div className="text-center py-12">
                   <p className="text-muted-foreground">{t('loading')}</p>
                </div> :
            filteredGroups.length === 0 ?
            <div className="text-center py-12 px-4">
                   <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                   <p className="text-muted-foreground">{t('noGroups')}</p>
                   <Button variant="link" onClick={handleNewGroup}>{t('createNewGroup')}</Button>
                </div> :

            filteredGroups.map((group) =>
            <GroupChatItem key={group.id} chat={group} onClick={() => handleGroupClick(group.id)} />
            )
            }
            </>
          }

          {/* Channels */}
          {activeTab === "channels" &&
          <>
              {groupsLoading ?
            <div className="text-center py-12">
                  <p className="text-muted-foreground">{t('loading')}</p>
                </div> :
            filteredChannels.length === 0 ?
            <div className="text-center py-12 px-4">
                   <Megaphone className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                   <p className="text-muted-foreground">{t('noChannels')}</p>
                   <Button variant="link" onClick={handleNewChannel}>{t('createNewChannel')}</Button>
                </div> :

            filteredChannels.map((channel) =>
            <GroupChatItem key={channel.id} chat={channel} onClick={() => handleGroupClick(channel.id)} />
            )
            }
            </>
          }

          {/* Followers */}
          {activeTab === "followers" &&
          <>
              {filteredFollowers.length === 0 ?
            <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">{t('noFollowers')}</p>
                </div> :

            filteredFollowers.map((follower) =>
            <div
              key={follower.id}
              onClick={() => handleUserClick(follower.id)}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors">

                    <Avatar className="h-12 w-12">
                      <AvatarImage src={follower.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(follower.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{follower.name || t('user')}</h3>
                      <div className="truncate">
                        <StarUsername username={follower.username || 'username'} textClassName="text-sm" />
                      </div>
                    </div>

                     <Button variant="outline" size="sm">
                       {t('messageBtn')}
                     </Button>
                  </div>
            )
            }
            </>
          }

          {/* Following */}
          {activeTab === "following" &&
          <>
              {filteredFollowing.length === 0 ?
            <div className="text-center py-12 px-4">
                  <p className="text-muted-foreground">{t('notFollowing')}</p>
                </div> :

            filteredFollowing.map((followingUser) =>
            <div
              key={followingUser.id}
              onClick={() => handleUserClick(followingUser.id)}
              className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors">

                    <Avatar className="h-12 w-12">
                      <AvatarImage src={followingUser.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(followingUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{followingUser.name || t('user')}</h3>
                      <div className="truncate">
                        <StarUsername username={followingUser.username || 'username'} textClassName="text-sm" />
                      </div>
                    </div>

                     <Button variant="outline" size="sm">
                       {t('messageBtn')}
                     </Button>
                  </div>
            )
            }
            </>
          }

          {/* Notifications */}
          {activeTab === "notifications" && <NotificationsTab />}
        </div>
      </div>

      {/* Dialogs */}
      {createType &&
      <>
          <CreateGroupDialog
          open={showCreateDialog}
          onOpenChange={(open) => {
            if (!open) resetCreateFlow();
            setShowCreateDialog(open);
          }}
          type={createType}
          onNext={handleCreateNext} />

          <AddMembersDialog
          open={showMembersDialog}
          onOpenChange={(open) => {
            if (!open) resetCreateFlow();
            setShowMembersDialog(open);
          }}
          type={createType}
          onComplete={handleMembersComplete}
          onBack={() => {
            setShowMembersDialog(false);
            setShowCreateDialog(true);
          }} />

          {createType === "channel" &&
        <ChannelVisibilityDialog
          open={showVisibilityDialog}
          onOpenChange={(open) => {
            if (!open) resetCreateFlow();
            setShowVisibilityDialog(open);
          }}
          onComplete={handleVisibilityComplete}
          onBack={() => {
            setShowVisibilityDialog(false);
            setShowMembersDialog(true);
          }} />

        }
        </>
      }

      <RingtoneSelector
        open={showRingtoneSelector}
        onOpenChange={setShowRingtoneSelector} />

      {storyViewerOpen && storyViewerGroups.length > 0 &&
      <StoryViewer
        storyGroups={storyViewerGroups}
        initialGroupIndex={0}
        onClose={() => setStoryViewerOpen(false)} />

      }

    </AppLayout>);
};

export default Messages;