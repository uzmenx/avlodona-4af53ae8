import { useState, useEffect, useCallback, useRef, forwardRef, useMemo } from "react";
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
import { Virtuoso } from "react-virtuoso";

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
  const [allDropdownOpen, setAllDropdownOpen] = useState(false);

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
        ring_id: (s.ring_id as string) || 'default',
        author: authorProfile ?
        {
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          avatar_url: authorProfile.avatar_url
        } :
        undefined,
        has_viewed: viewerId ? viewedStoryIds.has(s.id as string) : false,
        has_liked: viewerId ? likedStoryIds.has(s.id as string) : false
      })) as unknown as Story[];

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

  // Filter functions memoized
  const filteredConversations = useMemo(() => {
    return (conversations ?? []).filter((conv) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = conv.otherUser.name?.toLowerCase() || "";
      const username = conv.otherUser.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [conversations, searchQuery]);

  const filteredGroups = useMemo(() => {
    return (groups ?? []).filter((g) => {
      if (!searchQuery) return true;
      return g.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [groups, searchQuery]);

  const filteredChannels = useMemo(() => {
    return (channels ?? []).filter((c) => {
      if (!searchQuery) return true;
      return c.name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [channels, searchQuery]);

  const filteredFollowers = useMemo(() => {
    return followers.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = f.name?.toLowerCase() || "";
      const username = f.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [followers, searchQuery]);

  const filteredFollowing = useMemo(() => {
    return following.filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = f.name?.toLowerCase() || "";
      const username = f.username?.toLowerCase() || "";
      return name.includes(q) || username.includes(q);
    });
  }, [following, searchQuery]);

  // Combine and sort all chats for the "All" tab
  const allChats = useMemo(() => {
    return [
      ...filteredConversations.map(conv => ({ ...conv, chatType: 'direct' as const, sortTime: conv.last_message_at || new Date(0).toISOString() })),
      ...filteredGroups.map(group => ({ ...group, chatType: 'group' as const, sortTime: group.lastMessage?.created_at || group.created_at })),
      ...filteredChannels.map(channel => ({ ...channel, chatType: 'channel' as const, sortTime: channel.lastMessage?.created_at || channel.created_at }))
    ].sort((a, b) => new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime());
  }, [filteredConversations, filteredGroups, filteredChannels]);

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
      <div ref={swipeTabRef} className="pb-20 min-h-screen touch-pan-y">

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
                        icon="lets-icons:setting-alt-fill" 
                        className="h-6 w-6 text-primary/80 group-hover:text-primary transition-colors" 
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-[250] min-w-60 bg-popover border-white/10 shadow-xl rounded-[24px] p-2">
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

          {/* Tabs - Modern Premium Design */}
          <div className="px-4 pb-3">
            <div className="premium-tabs-container">
              {/* All / Followers / Following Dropdown Tab */}
              <DropdownMenu open={allDropdownOpen} onOpenChange={setAllDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => {
                      if (!isAllGroupActive) {
                        e.preventDefault();
                        setActiveTab("all");
                      }
                      // if already active, let the trigger open the dropdown naturally
                    }}
                    className={cn(
                      "flex-1 premium-tab-btn",
                      isAllGroupActive ? "premium-tab-btn-active" : "premium-tab-btn-inactive"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{allGroupLabel}</span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", isAllGroupActive ? "opacity-100" : "opacity-60", allDropdownOpen ? "rotate-180" : "")} />
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={8}
                  className="z-[250] min-w-[140px] bg-popover/90 backdrop-blur-2xl border-white/10 shadow-2xl rounded-2xl p-1"
                >
                  <DropdownMenuItem
                    onClick={() => { setActiveTab("all"); setAllDropdownOpen(false); }}
                    className="rounded-xl focus:bg-primary/10 cursor-pointer py-1.5 px-2.5 gap-2"
                  >
                    <MessageCircle className="h-3.5 w-3.5 opacity-60" />
                    <span className="font-semibold text-[11px] tracking-tight">{t("allChats")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setActiveTab("followers"); setAllDropdownOpen(false); }}
                    className="rounded-xl focus:bg-primary/10 cursor-pointer py-1.5 px-2.5 gap-2"
                  >
                    <Users className="h-3.5 w-3.5 opacity-60" />
                    <span className="font-semibold text-[11px] tracking-tight">{t("followersTab")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setActiveTab("following"); setAllDropdownOpen(false); }}
                    className="rounded-xl focus:bg-primary/10 cursor-pointer py-1.5 px-2.5 gap-2"
                  >
                    <span className="font-semibold text-[11px] tracking-tight">{t("followingTab")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Groups Tab */}
              <button
                onClick={() => setActiveTab("groups")}
                className={cn(
                  "premium-tab-btn",
                  activeTab === "groups" ? "premium-tab-btn-active" : "premium-tab-btn-inactive"
                )}
              >
                <Users className="h-4 w-4" />
                <span className="truncate">{t('groups')}</span>
              </button>

              {/* Channels Tab */}
              <button
                onClick={() => setActiveTab("channels")}
                className={cn(
                  "premium-tab-btn",
                  activeTab === "channels" ? "premium-tab-btn-active" : "premium-tab-btn-inactive"
                )}
              >
                <Megaphone className="h-4 w-4" />
                <span className="truncate">{t('channels')}</span>
              </button>
            </div>

            {/* Notification Row - More subtle but distinct */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={() => setActiveTab("notifications")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border transition-all active:scale-95 relative",
                  activeTab === "notifications" ?
                  "bg-white/10 border-white/20 text-foreground shadow-inner" :
                  "bg-black/20 border-white/10 text-muted-foreground hover:bg-black/30"
                )}
              >
                <Bell className={cn("h-4 w-4", activeTab === "notifications" ? "text-primary animate-pulse" : "")} />
                <span className="text-xs font-bold uppercase tracking-wider">{t('notifications')}</span>
                {notifUnreadCount > 0 &&
                  <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                    <Badge
                      variant="destructive"
                      className="relative h-5 min-w-5 p-0 flex items-center justify-center text-[10px] rounded-full border-2 border-background"
                    >
                      {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                    </Badge>
                  </div>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div>
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
                                <AvatarImage src={u.avatar_url || undefined} loading="lazy" decoding="async" />
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
                                <AvatarImage src={g.avatar_url || undefined} loading="lazy" decoding="async" />
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
                      <Virtuoso
                        useWindowScroll
                        data={allChats}
                        computeItemKey={(_, item) => item.id}
                        increaseViewportBy={{ top: 600, bottom: 900 }}
                        components={{
                          List: forwardRef<HTMLDivElement, any>((props, ref) => (
                            <div
                              {...props}
                              ref={ref}
                              className={cn("divide-y divide-border", props.className)}
                            />
                          )),
                          EmptyPlaceholder: () => (
                            <div className="text-center py-12 px-4">
                              <MessageCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                              <p className="text-sm text-muted-foreground mt-1">{t('createGroupOrChannel')}</p>
                            </div>
                          )
                        }}
                        itemContent={(_, item) => {
                          if (item.chatType === 'direct') {
                            return (
                              <div
                                onClick={() => {
                                  if (isEditMode) {
                                    setSelectedConvIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                      return next;
                                    });
                                  } else {
                                    handleUserClick(item.otherUser.id);
                                  }
                                }}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-300 relative overflow-hidden',
                                  isEditMode ? 'translate-x-0' : '',
                                  isEditMode && selectedConvIds.has(item.id) ? 'bg-primary/5' : 'hover:bg-white/5 active:bg-white/10'
                                )}
                              >
                                {/* Telegram-style selection circle */}
                                {isEditMode && (
                                  <div className="flex-shrink-0 flex items-center justify-center w-6 transition-all duration-300 animate-in fade-in slide-in-from-left-2">
                                    <div className={cn(
                                      "h-5 w-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center",
                                      selectedConvIds.has(item.id)
                                        ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20"
                                        : "border-muted-foreground/30 bg-transparent"
                                    )}>
                                      {selectedConvIds.has(item.id) && <Icon icon="lucide:check" className="h-3 w-3 text-primary-foreground" />}
                                    </div>
                                  </div>
                                )}

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
                                            background: storyInfo.has_unviewed ? getStoryRingGradientFn(storyInfo.ring_id) : undefined
                                          }}
                                          aria-label="View story"
                                        >
                                          {!storyInfo.has_unviewed && <div className="absolute inset-0 rounded-full bg-muted-foreground/30 p-[2px]" />}
                                          <div className="w-full h-full rounded-full bg-background p-[1.5px]">
                                            <Avatar className="h-full w-full">
                                              <AvatarImage
                                                src={item.otherUser.avatar_url || undefined}
                                                loading="lazy"
                                                decoding="async"
                                              />
                                              <AvatarFallback>{getInitials(item.otherUser.name)}</AvatarFallback>
                                            </Avatar>
                                          </div>
                                        </button>
                                      );
                                    }

                                    return (
                                      <Avatar className="h-12 w-12">
                                        <AvatarImage
                                          src={item.otherUser.avatar_url || undefined}
                                          loading="lazy"
                                          decoding="async"
                                        />
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

                          return (
                            <GroupChatItem
                              chat={item as any}
                              isEditMode={isEditMode}
                              isSelected={isEditMode && selectedConvIds.has(item.id)}
                              onClick={() => {
                                if (isEditMode) {
                                  setSelectedConvIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                    return next;
                                  });
                                } else {
                                  handleGroupClick(item.id);
                                }
                              }}
                            />
                          );
                        }}
                      />
                    )}
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

            <Virtuoso
              useWindowScroll
              data={filteredGroups}
              computeItemKey={(_, group) => group.id}
              itemContent={(_, group) => (
                <GroupChatItem 
                  key={group.id} 
                  chat={group as any} 
                  isEditMode={isEditMode}
                  isSelected={isEditMode && selectedConvIds.has(group.id)}
                  onClick={() => {
                    if (isEditMode) {
                      setSelectedConvIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) next.delete(group.id); else
                        next.add(group.id);
                        return next;
                      });
                    } else {
                      handleGroupClick(group.id);
                    }
                  }} 
                />
              )}
            />
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

            <Virtuoso
              useWindowScroll
              data={filteredFollowing}
              computeItemKey={(_, followingUser) => followingUser.id}
              itemContent={(_, followingUser) => (
                <div
                  key={followingUser.id}
                  onClick={() => handleUserClick(followingUser.id)}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer active:bg-muted transition-colors">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={followingUser.avatar_url || undefined} loading="lazy" decoding="async" />
                    <AvatarFallback>{getInitials(followingUser.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{followingUser.name || t('user')}</h3>
                    <div className="truncate">
                      <StarUsername username={followingUser.username || 'username'} textClassName="text-sm" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUserClick(followingUser.id); }}>
                    {t('messageBtn')}
                  </Button>
                </div>
              )}
            />
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

      {/* Bottom Action Bar for Edit Mode */}
      {isEditMode && selectedConvIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-xs animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-4 bg-background/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center justify-around gap-2">
            <Button
              variant="ghost"
              className="flex-1 h-12 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive flex flex-col gap-0.5"
              onClick={async () => {
                for (const id of selectedConvIds) {
                  await supabase.from('messages').delete().eq('conversation_id', id);
                  await supabase.from('conversations').delete().eq('id', id);
                }
                setSelectedConvIds(new Set());
                setIsEditMode(false);
                toast.success("O'chirildi");
              }}
            >
              <Trash2 className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">O'chirish</span>
            </Button>
            
            <div className="w-px h-8 bg-white/10" />
            
            <Button
              variant="ghost"
              className="flex-1 h-12 rounded-xl text-primary hover:bg-primary/10 hover:text-primary flex flex-col gap-0.5"
              onClick={() => {
                setSelectedConvIds(new Set());
                setIsEditMode(false);
              }}
            >
              <X className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Bekor qilish</span>
            </Button>
          </div>
        </div>
      )}

      {storyViewerOpen && storyViewerGroups.length > 0 &&
      <StoryViewer
        storyGroups={storyViewerGroups}
        initialGroupIndex={0}
        onClose={() => setStoryViewerOpen(false)} />

      }

    </AppLayout>);
};

export default Messages;
