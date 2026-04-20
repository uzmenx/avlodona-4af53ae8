import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Grid3X3, Bookmark, Users, AtSign, ChevronDown, ChevronUp, Grid2X2, LayoutList, Columns2, ShieldBan, ShieldCheck, MoreVertical, Link2, Search, Heart, Eye, ArrowLeftRight, Plus, Image, Video, Loader2, X, Edit2, Camera, Lock } from 'lucide-react';
import { useMemorialPosts } from '@/hooks/useMemorialPosts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Icon } from '@iconify/react';
import { compressImage, uploadToR2 } from '@/lib/r2Upload';
import { FamilyMembersSheet, FollowHubDrawer, SocialLinksList, ImageCropper } from '@/components/profile';
import { SocialLink } from '@/components/profile/SocialLinksEditor';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { usePostCollections } from '@/hooks/usePostCollections';
import { HighlightsRow } from '@/components/profile/HighlightsRow';
import { CollectionsFilter } from '@/components/profile/CollectionsFilter';
import { useUserPosts } from '@/hooks/useUserPosts';
import { useFollow } from '@/hooks/useFollow';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { PostCard } from '@/components/feed/PostCard';
import { MemorialPostCard } from '@/components/post/MemorialPostCard';
import { UnifiedFullScreenViewer } from '@/components/feed/UnifiedFullScreenViewer';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { EndOfFeed } from '@/components/feed/EndOfFeed';
import { FollowButton } from '@/components/user/FollowButton';
import { MessageButton } from '@/components/chat/MessageButton';
import { StarUsername } from '@/components/user/StarUsername';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useTheme, type ThemeMode, type BackgroundTheme } from '@/contexts/ThemeContext';
import { formatCount } from '@/lib/formatCount';
import { RelativeConnectionSheet } from '@/components/family/RelativeConnectionSheet';
import { useFamilyInvitations } from '@/hooks/useFamilyInvitations';
import { UnifiedMergeDialog } from '@/components/family-v2/UnifiedMergeDialog';
import { useToast } from '@/hooks/use-toast';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { useActiveStories } from '@/hooks/useActiveStories';
import { getStoryRingGradient } from '@/components/stories/storyRings';
import { StoryViewer } from '@/components/stories/StoryViewer';
import type { StoryGroup, Story } from '@/hooks/useStories';
import { Post } from '@/types';
import { useAutoPreviewVideo } from '@/hooks/useAutoPreviewVideo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const UserProfileMasonryItem = ({ post }: {post: Post;}) => {
  const mediaUrl = ((post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : post.image_url || '') || '') as string;
  const isVideo = !!mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('.mov') || mediaUrl.includes('.webm'));
  const videoRef = useRef<HTMLVideoElement>(null);
  useAutoPreviewVideo(videoRef, { enabled: isVideo, delayMs: 3000, threshold: 0.6 });

  const likesCount = post.likes_count ?? 0;
  const viewsCount = post.views_count ?? 0;

  return (
    <div className="relative aspect-[3/4] rounded-[20px] overflow-hidden bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
      {mediaUrl ?
      isVideo ?
      <video
        ref={videoRef}
        src={mediaUrl}
        className="w-full h-full object-cover"
        muted
        playsInline
        loop
        preload="metadata" /> :


      <img src={mediaUrl} alt="" className="w-full h-full object-cover" /> :


      <div className="w-full h-full bg-muted" />
      }

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
        <div className="text-white text-[11px] leading-tight">
          <div className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            <span>{formatCount(likesCount)}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Eye className="h-3.5 w-3.5" />
            <span>{formatCount(viewsCount)}</span>
          </div>
        </div>
      </div>
    </div>);

};

interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  cover_url: string | null;
  social_links: SocialLink[] | null;
  theme_mode?: ThemeMode | null;
  bg_theme?: BackgroundTheme | null;
  hide_highlights?: boolean;
  hide_collections?: boolean;
  is_private?: boolean;
  hide_online_status?: boolean;
  hide_mentions?: boolean;
  hide_saved_posts?: boolean;
  last_seen?: string | null;
  // added for unlinked/memorial profiles
  birth_year?: string | null;
  death_year?: string | null;
  owner_id?: string | null;
  linked_user_id?: string | null;
  gender?: string | null;
}

const PremiumStarsIcon = ({ className, active, size = 'default' }: {className?: string;active?: boolean;size?: 'default' | 'sm';}) =>
<div className={cn("relative flex items-center justify-center transition-all duration-300", className)}>
    <Icon
    icon="mdi:stars"
    className={cn(
      size === 'sm' ? "w-5 h-5" : "w-6 h-6",
      "transition-all duration-300",
      active ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "text-muted-foreground opacity-60"
    )} />
  
    <Icon
    icon="pepicons-pop:stars"
    className={cn(
      "absolute transition-all duration-300 delay-75",
      size === 'sm' ? "-top-1 -right-1 w-2.5 h-2.5" : "-top-1.5 -right-1.5 w-3.5 h-3.5",
      active ? "text-emerald-400 opacity-90 scale-110" : "text-muted-foreground opacity-40 scale-75"
    )} />
  
    <Icon
    icon="mdi:stars"
    className={cn(
      "absolute transition-all duration-500 delay-150",
      size === 'sm' ? "-bottom-0.5 -left-0.5 w-2 h-2" : "-bottom-1 -left-1 w-2.5 h-2.5",
      active ? "text-emerald-300 opacity-80 scale-125" : "text-muted-foreground opacity-30 scale-50"
    )} />
  
  </div>;


export const UserProfilePage = () => {
  const { userId } = useParams<{userId: string;}>();
  const [searchParams] = useSearchParams();
  const isMemorial = searchParams.get('memorial') === 'true';
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { setOverride } = useTheme();
  const { toast } = useToast();
  const { isBlocked, isBlockedBy, isEitherBlocked, blockUser, unblockUser } = useBlockedUsers();
  const { getStoryInfo } = useActiveStories();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedMemorialMemberId, setResolvedMemorialMemberId] = useState<string | undefined>(undefined);
  const effectivePostsUserId = isMemorial ? resolvedMemorialMemberId || userId : userId;
  const { posts, isLoading: postsLoading, postsCount, refetch } = useUserPosts(effectivePostsUserId, isMemorial);
  const { isFollowing, followersCount, followingCount } = useFollow(userId);
  const isRestricted = !!(profile?.is_private && !isFollowing && currentUser?.id !== userId && !isMemorial);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'mentions'>(isMemorial ? 'mentions' : 'posts');
  const [postsLayout, setPostsLayout] = useState<'pinterest1' | 'list'>('pinterest1');
  const [memorialLayout, setMemorialLayout] = useState<'grid' | 'list'>('grid');
  const cycleMemorialLayout = useCallback(() => {
    setMemorialLayout((prev) => prev === 'grid' ? 'list' : 'grid');
  }, []);
  const lastPostsTabTapTsRef = useRef<number>(0);

  const { savedPosts, savedMemorialPosts } = useSavedPosts(effectivePostsUserId);

  // Memorial posts
  const { posts: memorialPosts, loading: memorialLoading, addPost: addMemorialPost, refetch: refetchMemorial } = useMemorialPosts(resolvedMemorialMemberId);
  const mappedMemorialPosts: Post[] = useMemo(() => {
    return memorialPosts.map((mp) => ({
      id: mp.id,
      user_id: mp.created_by,
      content: mp.caption || '',
      media_urls: mp.media_url ? [mp.media_url] : [],
      created_at: mp.created_at || '',
      likes_count: mp.likes_count || 0,
      comments_count: (mp as { comments_count?: number }).comments_count || 0,
      views_count: mp.views_count || 0,
      author: mp.author as unknown as { id: string; name: string; username: string; avatar_url: string },
      is_memorial: true
    })) as unknown as Post[];
  }, [memorialPosts]);


  const lastProfileTapTsRef = useRef<number>(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState<Post[]>([]);
  const [showPostsStats, setShowPostsStats] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [profileStoryGroups, setProfileStoryGroups] = useState<StoryGroup[]>([]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [followHubOpen, setFollowHubOpen] = useState(false);
  const [followHubTab, setFollowHubTab] = useState<'followers' | 'following' | 'unfollow'>('followers');
  const [familyMembersOpen, setFamilyMembersOpen] = useState(false);
  const [familyMemberCount, setFamilyMemberCount] = useState(0);

  // Bio expand/collapse states
  const [bioExpanded, setBioExpanded] = useState(false);
  const [needsMoreButton, setNeedsMoreButton] = useState(false);
  const bioRef = useRef<HTMLDivElement>(null);
  
  // Profile edit states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBirthYear, setEditBirthYear] = useState('');
  const [editDeathYear, setEditDeathYear] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarEditInputRef = useRef<HTMLInputElement>(null);
  const [editCropperState, setEditCropperState] = useState<{isOpen: boolean; imageUrl: string; cropType: 'avatar' | 'cover'}>({isOpen: false, imageUrl: '', cropType: 'cover'});

  const { highlights } = useStoryHighlights(userId);
  const { collections, selectedCollectionId, setSelectedCollectionId, collectionPosts } = usePostCollections(userId);
  const { mentionedPosts: userMentionedPosts, collabPosts: userCollabPosts } = useMentionsCollabs(effectivePostsUserId, isMemorial);

  // Define openViewer locally if needed or just use the one below
  const openViewer = useCallback((allPosts: Post[], startIndex: number) => {
    setViewerPosts(allPosts);
    setViewerStartIndex(startIndex);
    setIsViewerOpen(true);
  }, []);

  const fetchStoryGroupForUser = useCallback(async (targetUserId: string): Promise<StoryGroup | null> => {
    const { data: userData } = await supabase.
    from('profiles').
    select('username').
    eq('id', targetUserId).
    single();

    if (!userData) return null;

    const { data: stories, error } = await supabase.
    from('stories').
    select('*').
    eq('user_id', targetUserId).
    gt('expires_at', new Date().toISOString()).
    order('created_at', { ascending: true });

    if (error) throw error;
    if (!stories || stories.length === 0) return null;

    const { data: profiles } = await supabase.
    from('profiles').
    select('id, name, username, avatar_url').
    in('id', [targetUserId]);

    const authorProfile = profiles?.find((p) => p.id === targetUserId);
    const viewerId = currentUser?.id;

    const [viewsRes, likesRes] = await Promise.all([
    viewerId ?
    supabase.
    from('story_views').
    select('story_id').
    eq('viewer_id', viewerId).
    in('story_id', stories.map((s) => s.id)) :
    Promise.resolve({ data: [] as {story_id: string}[] }),
    viewerId ?
    supabase.
    from('story_likes').
    select('story_id').
    eq('user_id', viewerId).
    in('story_id', stories.map((s) => s.id)) :
    Promise.resolve({ data: [] as {story_id: string}[] })]
    );

    const viewedStoryIds = new Set((viewsRes.data as {story_id: string;}[] | null)?.map((v) => v.story_id) || []);
    const likedStoryIds = new Set((likesRes.data as {story_id: string;}[] | null)?.map((l) => l.story_id) || []);

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

    const hasUnviewed = normalizedStories.some((s) => !s.has_viewed);

    return {
      user_id: targetUserId,
      user: authorProfile || { id: targetUserId, name: null, username: null, avatar_url: null },
      stories: normalizedStories,
      has_unviewed: hasUnviewed
    };
  }, [currentUser?.id]);

  const [initialStoryIndex, setInitialStoryIndex] = useState(0);

  const openProfileStories = useCallback(async (storyId?: string) => {
    if (!userId) return;
    const g = await fetchStoryGroupForUser(userId);
    if (!g) {
      if (storyId) toast({ title: 'Hikoya topilmadi' });
      return;
    }

    let storyIdx = 0;
    if (storyId) {
      storyIdx = g.stories.findIndex((s) => s.id === storyId);
      if (storyIdx === -1) storyIdx = 0;
    }

    setInitialStoryIndex(storyIdx);
    setProfileStoryGroups([g]);
    setStoryViewerOpen(true);
  }, [fetchStoryGroupForUser, toast, userId]);

  // Handle URL parameters for highlighting posts or stories
  useEffect(() => {
    if (isLoading || postsLoading) return;

    const postId = searchParams.get('postId');
    const view = searchParams.get('view');
    const storyId = searchParams.get('storyId');

    if (view === 'stories' && !storyViewerOpen) {
      openProfileStories(storyId || undefined);
    } else if (postId && posts.length > 0 && !isViewerOpen) {
      const index = posts.findIndex((p) => p.id === postId);
      if (index !== -1) {
        openViewer(posts, index);
      }
    }
  }, [searchParams, posts, isViewerOpen, storyViewerOpen, openProfileStories, openViewer, isLoading, postsLoading]);

  const cyclePostsLayout = useCallback(() => {
    setPostsLayout((prev) => prev === 'list' ? 'pinterest1' : 'list');
  }, []);

  const togglePostsLayoutHidden = useCallback(() => {
    setPostsLayout((prev) => prev === 'list' ? 'pinterest1' : 'list');
  }, []);

  // Family tree connection states
  const [relativeSheetOpen, setRelativeSheetOpen] = useState(false);

  // Full merge flow (same as FamilyTreeV2)
  const {
    showMergeDialog, mergeData,
    executeMerge: executeTreeMerge, closeMergeDialog, isMerging,
  } = useFamilyInvitations();

  useEffect(() => {
    if (!userId) return;
    supabase.
    from('family_tree_members').
    select('id', { count: 'exact', head: true }).
    eq('owner_id', userId).
    then(({ count }) => setFamilyMemberCount(count || 0));
  }, [userId]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Redirect to own profile if viewing self
  useEffect(() => {
    if (currentUser?.id && userId === currentUser.id) {
      navigate('/profile', { replace: true });
    }
  }, [currentUser?.id, userId, navigate]);

  const isProfileBlocked = !!(userId && isEitherBlocked(userId));

  // Bio overflow detection
  useEffect(() => {
    if (bioRef.current && profile?.bio) {
      // Check if bio text overflows 3 lines
      const lineHeight = parseInt(window.getComputedStyle(bioRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 2;
      setNeedsMoreButton(bioRef.current.scrollHeight > maxHeight);
    }
  }, [profile?.bio]);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      if (isMemorial) {
        setResolvedMemorialMemberId(undefined);

        // Primary: treat route param as family_tree_members.id
        let memberRow: {
          id: string;
          name?: string | null;
          member_name?: string | null;
          photo_url?: string | null;
          avatar_url?: string | null;
          birth_year?: string | null;
          death_year?: string | null;
          cover_url?: string | null;
          owner_id?: string | null;
          linked_user_id?: string | null;
          gender?: string | null;
        } | null = null;
        {
          const { data, error } = await supabase.
          from('family_tree_members').
          select('*').
          eq('id', userId).
          maybeSingle();

          if (error) throw error;
          memberRow = (data as typeof memberRow) || null;
        }

        // Fallback: sometimes we might be routed with a linked user id
        if (!memberRow) {
          const { data, error } = await supabase.
          from('family_tree_members').
          select('*').
          eq('linked_user_id', userId).
          limit(1).
          maybeSingle();

          if (error) throw error;
          memberRow = (data as typeof memberRow) || null;
        }

        if (memberRow) {
          setResolvedMemorialMemberId(memberRow.id);

          const memberName = memberRow.name ?? memberRow.member_name ?? null;
          const memberAvatarUrl = memberRow.photo_url ?? memberRow.avatar_url ?? null;
          const birthYear = memberRow.birth_year ?? null;
          const deathYear = memberRow.death_year ?? null;

          setProfile({
            id: memberRow.id,
            name: memberName,
            username: memberName ? memberName.toLowerCase().replace(/\s+/g, '_') : `memorial_${memberRow.id.substring(0, 8)}`,
            avatar_url: memberAvatarUrl,
            bio: deathYear ?
            `${birthYear ? birthYear + ' ' : ''}- ${deathYear}\nXotirasiga bag'ishlanadi` :
            "Xotira sahifasi",
            cover_url: memberRow.cover_url ?? null,
            social_links: null,
            theme_mode: null,
            bg_theme: null,
            birth_year: birthYear,
            death_year: deathYear,
            owner_id: memberRow.owner_id ?? null,
            linked_user_id: memberRow.linked_user_id ?? null,
            gender: memberRow.gender ?? null,
          });
        } else {
          setProfile(null);
        }
      } else {
        setResolvedMemorialMemberId(undefined);
        let { data, error } = await supabase.
        from('profiles').
        select('*').
        eq('id', userId).
        maybeSingle();

        if (error || !data) {
          // Fallback to user_id if id query fails or returns nothing
          const { data: fallbackData } = await (supabase as unknown as { from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } } } })
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (fallbackData) {
            data = fallbackData;
            error = null;
          }
        }

        if (error) throw error;
        if (data) {
          const d = data as Record<string, unknown>;
          setProfile({
            ...data,
            theme_mode: d.theme_mode as ThemeMode || 'system',
            bg_theme: d.bg_theme as BackgroundTheme || null,
            social_links: data.social_links as unknown as SocialLink[] | null || null
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isMemorial]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), fetchProfile()]);
  }, [fetchProfile, refetch]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const rawMode = profile?.theme_mode ?? undefined;
    const rawBg = profile?.bg_theme ?? undefined;

    const isValidMode = rawMode === 'light' || rawMode === 'dark' || rawMode === 'system';
    const isValidBg = rawBg === 'none' || rawBg === 'aurora' || rawBg === 'sunset' || rawBg === 'ocean';

    if (isValidMode || isValidBg) {
      setOverride({
        mode: isValidMode ? rawMode : undefined,
        bgTheme: isValidBg ? rawBg : undefined
      });
    } else {
      setOverride(null);
    }

    return () => {
      setOverride(null);
    };
  }, [profile?.bg_theme, profile?.theme_mode, setOverride]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };


  const handleSaveEdit = async () => {
    if (!profile || !userId) return;
    setIsSavingEdit(true);
    try {
      const updates: Record<string, string | number | null> = {
        member_name: editName,
        birth_year: editBirthYear ? parseInt(editBirthYear) : null,
        death_year: editDeathYear ? parseInt(editDeathYear) : null,
      };

      if (editCoverUrl && !editCoverUrl.startsWith('blob:')) {
        updates.cover_url = editCoverUrl;
      }
      if (editAvatarUrl && !editAvatarUrl.startsWith('blob:')) {
        updates.photo_url = editAvatarUrl;
      }

      await supabase
        .from('family_tree_members')
        .update(updates)
        .eq('id', userId)
        .eq('owner_id', currentUser?.id);

      toast({ title: 'Profil muvaffaqiyatli saqlandi' });
      setEditModalOpen(false);
      fetchProfile();
    } catch (e) {
      console.error(e);
      toast({ title: 'Xatolik yuz berdi', variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditCropperState({ isOpen: true, imageUrl: reader.result as string, cropType: type });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = async (croppedUrl: string) => {
    try {
      const response = await fetch(croppedUrl);
      const blob = await response.blob();
      const type = editCropperState.cropType;
      const filename = type === 'cover'
        ? `memorial_cover_${userId}_${Date.now()}.jpg`
        : `memorial_avatar_${userId}_${Date.now()}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      const compressed = await compressImage(file, type === 'cover' ? 800 : 256, type === 'cover' ? 800 : 256, 0.85);
      const url = await uploadToR2(compressed, type === 'cover' ? `memorial-covers/${userId}` : `memorial-avatars/${userId}`);
      if (type === 'cover') {
        setEditCoverUrl(url);
      } else {
        setEditAvatarUrl(url);
      }
    } finally {
      URL.revokeObjectURL(croppedUrl);
    }
  };

  const displayPosts = selectedCollectionId ? collectionPosts : posts;
  const filteredPosts = useMemo(() => {
    const q = appliedSearchQuery.trim().toLowerCase();
    if (!q) return displayPosts;
    return (displayPosts || []).filter((p) => (p?.content || '').toLowerCase().includes(q));
  }, [appliedSearchQuery, displayPosts]);

  const hasMore = false;



  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        </div>
      </AppLayout>);

  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Foydalanuvchi topilmadi</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Orqaga
          </Button>
        </div>
      </AppLayout>);

  }

  return (
    <AppLayout>
      <div
        className="min-h-screen pb-20"
        onPointerUp={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('button, a, input, textarea, select, [role="button"], [data-no-double-tap="true"]')) return;

          const now = Date.now();
          const DOUBLE_TAP_DELAY = 300;
          if (now - lastProfileTapTsRef.current < DOUBLE_TAP_DELAY) {
            lastProfileTapTsRef.current = 0;
            scrollToTop();
            void handleRefresh();
          } else {
            lastProfileTapTsRef.current = now;
          }
        }}>
        
        {/* Header with back button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 h-9 w-9 rounded-full"
          style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)'
          }}>
          
          <ArrowLeft className="h-5 w-5 text-white" />
        </Button>

            {/* Actions menu (top-right) */}
            {userId && !isMemorial &&
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = searchQuery.trim();
              setAppliedSearchQuery(trimmed);
            }}
            className="flex items-center">
            
              <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qidirish"
              className={cn(
                'h-9 bg-white/15 text-white placeholder:text-white/70 border border-white/20 rounded-full transition-all duration-200 mr-2',
                searchExpanded ? 'w-44 px-3 opacity-100' : 'w-0 px-0 opacity-0 pointer-events-none'
              )}
              style={{ backdropFilter: 'blur(8px)' }} />
            
              <Button
              variant="ghost"
              size="icon"
              type={searchExpanded ? 'submit' : 'button'}
              onClick={() => {
                if (searchExpanded) {
                  setSearchExpanded(false);
                  setSearchQuery('');
                  setAppliedSearchQuery('');
                  return;
                }
                setSearchExpanded(true);
                setTimeout(() => searchInputRef.current?.focus(), 0);
              }}
              className="h-9 w-9 rounded-full text-white"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)'
              }}
              aria-label="Search">
              
                <Search className="h-5 w-5" />
              </Button>
            </form>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-white"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)'
                }}
                aria-label="More"
                type="button">
                
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                className="gap-3 cursor-pointer"
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}/user/${userId}`;
                    await navigator.clipboard.writeText(url);
                    toast({ title: 'Havola nusxalandi' });
                  } catch {
                    toast({ title: 'Nusxalashda xatolik', variant: 'destructive' });
                  }
                }}>
                
                  <Link2 className="h-4 w-4" />
                  <span>Profil linki</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                className={cn(
                  'gap-3 cursor-pointer',
                  isBlocked(userId) ? 'text-primary' : 'text-destructive'
                )}
                onClick={async () => {
                  if (isBlocked(userId)) {
                    await unblockUser(userId);
                    toast({ title: 'Blok olib tashlandi' });
                  } else {
                    await blockUser(userId);
                    toast({ title: 'Foydalanuvchi bloklandi' });
                  }
                }}>
                
                  {isBlocked(userId) ? <ShieldCheck className="h-4 w-4" /> : <ShieldBan className="h-4 w-4" />}
                  <span>{isBlocked(userId) ? 'Blokdan chiqarish' : 'Bloklash'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }

        {/* Memorial "add post" button (top-right) */}
        {isMemorial && profile &&
        <div className="absolute top-4 right-4 z-10 flex gap-2">
            {!profile.linked_user_id && profile.owner_id === currentUser?.id && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditName(profile.name || '');
                  setEditBirthYear(profile.birth_year || '');
                  setEditDeathYear(profile.death_year || '');
                  setEditCoverUrl(profile.cover_url || '');
                  setEditModalOpen(true);
                }}
                className="h-10 w-10 rounded-full text-white"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
                aria-label="Tahrirlash"
              >
                <Edit2 className="h-5 w-5" />
              </Button>
            )}
            <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/create?memberId=' + resolvedMemorialMemberId)}
            className="h-10 w-10 rounded-full text-white"
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)'
            }}
            aria-label="Xotira post qoldirish">
            
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        }

        {/* Cover Image */}
        <div className="relative h-28 overflow-hidden rounded-b-2xl">
          {profile.cover_url ?
          <img src={profile.cover_url} alt="Cover" className="w-full h-full object-cover" /> :

          <div className="w-full h-full bg-gradient-to-br from-primary via-accent to-primary/60" />
          }
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/20" />
        </div>
        
        {/* Profile Info */}
        <div className="px-3 -mt-8 relative z-10">
          {/* ROW 1: Followers | Avatar | Oila a'zolari */}
          <div className="flex items-end justify-between gap-1 mb-1">

            {/* LEFT: Followers */}
            {!isMemorial ?
            <button
              type="button"
              onClick={() => {
                if (isRestricted) return;
                setFollowHubTab('followers');
                setFollowHubOpen(true);
              }}
              className={cn(
                "flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0",
                isRestricted ? "opacity-90 cursor-default" : "cursor-pointer active:scale-95 transition-all"
              )}>
              
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  Kuzatuvchilar
                </span>
                <span className="text-lg font-extrabold text-foreground leading-none">
                  {formatCount(followersCount)}
                </span>
              </button> :
            <button
              type="button"
              className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0"
              onClick={() => setActiveTab('mentions')}>
              
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                Postlar
              </span>
              <span className="text-lg font-extrabold text-foreground leading-none">
                {formatCount(memorialPosts.length)}
              </span>
            </button>
            }

            {/* CENTER: Avatar (with story ring when user has active story) */}
            <div className="flex-shrink-0 flex flex-col items-center">
              {(() => {
                const info = userId && !isMemorial ? getStoryInfo(userId) : undefined;
                if (info) {
                  return (
                    <div
                      className={cn("h-16 w-16 rounded-full p-[2px] shadow-2xl", !isRestricted && "cursor-pointer")}
                      style={{
                        background: info.has_unviewed && !isRestricted ? getStoryRingGradient(info.ring_id as string) : 'var(--muted-foreground)'
                      }}
                      onClick={() => {
                        if (isRestricted) return;
                        openProfileStories();
                      }}>
                      
                      <div className="w-full h-full rounded-full bg-background p-[2px]">
                        <Avatar className="h-full w-full">
                          <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>);

                }

                return (
                  <Avatar className="h-16 w-16 border-4 border-background shadow-2xl ring-2 ring-primary/30">
                    <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                      {getInitials(profile.name)}
                    </AvatarFallback>
                  </Avatar>);

              })()}
            </div>

            {/* RIGHT: Oila a'zolari yoki Yili */}
            {profile.birth_year ? (
              <div
                className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0 relative">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  Yili
                </span>
                {profile.death_year ? (
                  <div className="flex items-center gap-1 leading-none">
                    <span className="text-sm font-extrabold text-foreground">{profile.birth_year}</span>
                    <span className="text-muted-foreground text-xs font-medium">—</span>
                    <span className="text-sm font-extrabold text-foreground">{profile.death_year}</span>
                  </div>
                ) : (
                  <span className="text-lg font-extrabold text-foreground leading-none">{profile.birth_year}</span>
                )}
              </div>
            ) : isMemorial ? (
              <div className="flex-1" />
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isRestricted) return;
                  setFamilyMembersOpen(true);
                }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0 relative",
                  isRestricted ? "opacity-90 cursor-default" : "cursor-pointer active:scale-95 transition-all"
                )}>
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  Oila a'zolari
                </span>
                <span className="text-lg font-extrabold text-foreground leading-none">
                  {formatCount(familyMemberCount)}
                </span>
                {!isRestricted && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPostsStats(!showPostsStats);
                    }}
                    className="absolute -bottom-2 right-2 h-5 w-5 bg-muted rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-all cursor-pointer"
                    style={{ transform: showPostsStats ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                    <ChevronDown className="h-3 w-3 text-foreground" />
                  </div>
                )}
              </button>
            )}
          </div>

          {/* ROW 2: Qarindoshim | Name & Username | Xabar */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {!isMemorial ?
            <Button
              variant="outline"
              size="sm"
              className="bg-white/10 dark:bg-white/5 border-white/20 hover:bg-white/20 active:scale-95 active:bg-white/30 transition-all text-foreground h-8 text-xs px-2.5"
              onClick={() => setRelativeSheetOpen(true)}>
              
                <Users className="h-3.5 w-3.5 mr-2" />
                Qarindosh
              </Button> :

            <div className="w-20" /> /* Spacer for centering */
            }

            <div className="min-w-0 flex-1 text-center">
              {profile.name && (
                <h1 className="text-lg font-extrabold text-foreground leading-tight truncate">
                  {profile.name}
                </h1>
              )}
              <div className="mt-0.5 truncate">
                <StarUsername username={profile.username ? profile.username : 'username'} />
              </div>
            </div>

            {!isMemorial ?
            !isProfileBlocked && <MessageButton userId={userId} className="h-8 text-xs px-2.5" /> :

            <div className="w-20" /> /* Spacer for centering */
            }
          </div>

          {isProfileBlocked &&
          <div className="mb-2 rounded-2xl border border-border/40 bg-background/60 backdrop-blur-md px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {userId && isBlocked(userId) ?
              'Siz bu foydalanuvchini bloklagansiz.' :
              userId && isBlockedBy(userId) ?
              'Siz bu foydalanuvchi tomonidan bloklangansiz.' :
              'Bu foydalanuvchi bilan aloqa cheklangan.'}
              </p>
            </div>
          }

          {/* ROW 3: Kuzatilmoqda | (spacer) | Postlar */}
          {showPostsStats &&
          <div className="flex justify-center mb-1">
              <div className="flex items-end justify-center gap-1.5 w-full max-w-[480px]">
                {!isMemorial &&
              <button
                type="button"
                onClick={() => {
                  if (isRestricted) return;
                  setFollowHubTab('following');
                  setFollowHubOpen(true);
                }}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0",
                  isRestricted ? "opacity-90 cursor-default" : "cursor-pointer active:scale-95 transition-all"
                )}>
                
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                      Kuzatilmoqda
                    </span>
                    <span className="text-lg font-extrabold text-foreground leading-none">
                      {formatCount(followingCount)}
                    </span>
                  </button>
              }

                {!isMemorial &&
              <div className="flex-shrink-0">
                    <FollowButton targetUserId={userId} size="sm" className="h-[44px] text-xs px-4" />
                  </div>
              }

              {!isMemorial &&
                <div
                  className={cn(
                    "flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0",
                    isRestricted && "opacity-90 cursor-default"
                  )}>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                    Postlar
                  </span>
                  <span className="text-lg font-extrabold text-foreground leading-none">
                    {formatCount(postsCount)}
                  </span>
                </div>
              }
              </div>
            </div>
          }

          <FollowHubDrawer
            open={followHubOpen}
            onOpenChange={setFollowHubOpen}
            userId={userId}
            initialTab={followHubTab}
            showUnfollowTab={false} />
          

          <FamilyMembersSheet open={familyMembersOpen} onOpenChange={setFamilyMembersOpen} ownerId={userId} />

          {/* Bio */}
          {profile.bio &&
          <div className="mb-1.5 px-3">
              


































            
            </div>
          }

          {/* Social Links */}
          {profile.social_links && !isRestricted &&
          <div className="flex justify-center mb-1.5">
              <SocialLinksList links={profile.social_links} className="justify-center" />
            </div>
          }

          {/* Action Buttons */}
          <div className="mb-2" />
        </div>

        {/* Story Highlights */}
        {highlights.length > 0 && !isMemorial && !isRestricted &&
        <div className="flex justify-center">
            <HighlightsRow highlights={highlights} isOwner={false} />
          </div>
        }

        {/* Collections filter */}
        {collections.length > 0 && activeTab === 'posts' && !isMemorial && !isRestricted &&
        <CollectionsFilter
          collections={collections}
          selectedId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
          isOwner={false} />

        }

        {isProfileBlocked ?
        <div className="px-4 py-10">
            <p className="text-center text-sm text-muted-foreground">
              {userId && isBlocked(userId) ?
            'Siz bu foydalanuvchini bloklagansiz.' :
            userId && isBlockedBy(userId) ?
            'Siz bu foydalanuvchi tomonidan bloklangansiz.' :
            'Bu foydalanuvchi bilan aloqa cheklangan.'}
            </p>
          </div> :
        isRestricted ?
          <div className="px-5 py-16 flex flex-col items-center text-center mt-4 border-t border-white/5">
            <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex flex-col items-center justify-center mb-4 bg-background/50 backdrop-blur-sm shadow-xl">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Bu akkaunt yopiq</h2>
            <p className="text-muted-foreground text-sm max-w-[250px]">
              Post va rasmlarni ko'rish uchun ushbu foydalanuvchiga obuna bo'ling.
            </p>
            {userId && <FollowButton targetUserId={userId} className="mt-6 font-semibold" size="lg" />}
          </div> :

        <>

        {/* ═══════════════════════════════════════
                                                                     TABS
                                                                  ═══════════════════════════════════════ */}
        <div className="px-4">
          {!isMemorial && (
            <div className="flex border-b border-border/20 mb-2 mt-4 relative">
              {/* Posts tab with layout toggle */}
              <button
                onClick={() => {
                  if (activeTab === 'posts') {
                    setPostsLayout(prev => prev === 'list' ? 'pinterest1' : 'list');
                  } else {
                    setActiveTab('posts');
                  }
                }}
                className={cn(
                  'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-all duration-300',
                  activeTab === 'posts' ? 'border-primary' : 'border-transparent'
                )}>
                <div
                  className={cn(
                    "relative w-16 h-8 bg-slate-100/90 dark:bg-slate-800/80 rounded-full border border-slate-200/60 dark:border-white/10 p-1 flex items-center shadow-md transition-all duration-500 overflow-hidden",
                    activeTab !== 'posts' && "opacity-60 scale-90 grayscale-[0.5]"
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-y-1 w-7 rounded-full bg-white dark:bg-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform z-20",
                      postsLayout === 'list' ? "left-1" : "left-8"
                    )}
                  >
                    <Icon
                      icon={postsLayout === 'list' ? "weui:transfer2-filled" : "mdi:stars"}
                      className={cn(
                        "h-4 w-4 transition-colors duration-300",
                        postsLayout === 'list' ? "text-emerald-600" : "text-amber-500"
                      )}
                    />
                  </div>
                  <div className="flex w-full justify-between items-center px-1.5 opacity-30">
                    <LayoutList className="h-4 w-4" />
                    <PremiumStarsIcon active={activeTab === 'posts'} size="sm" />
                  </div>
                  <div
                    className={cn(
                      "absolute inset-y-0 w-8 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 blur-md transition-all duration-500",
                      postsLayout === 'list' ? "left-0" : "left-8"
                    )}
                  />
                </div>
              </button>

              {/* Saved tab — hidden when profile hides saved posts */}
              {!profile?.hide_saved_posts && (
                <button
                  onClick={() => setActiveTab('saved')}
                  className={cn(
                    'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-colors',
                    activeTab === 'saved'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground'
                  )}>
                  <Bookmark className="h-5 w-5" />
                </button>
              )}

              {/* Mentions tab — hidden when profile hides mentions */}
              {!profile?.hide_mentions && (
                <button
                  onClick={() => setActiveTab('mentions')}
                  className={cn(
                    'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-colors',
                    activeTab === 'mentions'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground'
                  )}>
                  <AtSign className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Posts Grid / List */}
        {activeTab === 'posts' && (() => {
            return (
              <PullToRefresh onRefresh={refetch} useWindowScroll={true}>
            {postsLoading ?
                <div className="text-center py-12">
                <p className="text-muted-foreground">Yuklanmoqda...</p>
              </div> :
                filteredPosts.length === 0 ?
                <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{selectedCollectionId ? "Bu ro'yxatda postlar yo'q" : "Hozircha postlar yo'q"}</p>
              </div> :
                postsLayout === 'list' ?
                <div className="space-y-4 px-0 md:px-4">
                {filteredPosts.map((post, index) =>
                  <div key={post.id} onClick={() => openViewer(filteredPosts, index)} className="cursor-pointer">
                    <PostCard post={post} />
                  </div>
                  )}
                {hasMore === false && filteredPosts.length > 0 &&
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px'
                    }}>
                    
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8
                      }} />
                    
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0
                      }}>
                      
                      Postlar tugadi
                    </p>
                  </div>
                  }
              </div> :
                postsLayout === 'pinterest1' ?
                <div className="pb-20 px-px">
                <div className="grid grid-cols-2 gap-1 p-1">
                  {filteredPosts.map((post, idx) =>
                    <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                      <UserProfileMasonryItem post={post} />
                    </div>
                    )}
                </div>
                {hasMore === false && filteredPosts.length > 0 &&
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px'
                    }}>
                    
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8
                      }} />
                    
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0
                      }}>
                      
                      Postlar tugadi
                    </p>
                  </div>
                  }
              </div> :

                <div className="pb-20 px-px">
                <div className="flex gap-1 p-1">
                  <div className="flex-1 flex flex-col gap-1">
                    {filteredPosts.
                      filter((_, i) => i % 2 === 0).
                      map((post) => {
                        const idx = filteredPosts.findIndex((p) => p.id === post.id);
                        return (
                          <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>);

                      })}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {filteredPosts.
                      filter((_, i) => i % 2 === 1).
                      map((post) => {
                        const idx = filteredPosts.findIndex((p) => p.id === post.id);
                        return (
                          <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>);

                      })}
                  </div>
                </div>
                {hasMore === false && filteredPosts.length > 0 &&
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px'
                    }}>
                    
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8
                      }} />
                    
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0
                      }}>
                      
                      Postlar tugadi
                    </p>
                  </div>
                  }
              </div>
              }
          </PullToRefresh>)

          })()}

        {activeTab === 'saved' && (() => {
            if (profile?.hide_saved_posts) {
              return (
                <div className="text-center py-12 px-4">
                  <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Saqlangan postlar yopiq</p>
                </div>
              )
            }
            const allSaved = [...savedPosts, ...savedMemorialPosts].sort((a,b) => new Date((a as unknown as Record<string, unknown>).savedAt as string || a.created_at).getTime() - new Date((b as unknown as Record<string, unknown>).savedAt as string || b.created_at).getTime());
            return allSaved.length === 0 ? (
                <div className="text-center py-12 px-4">
                <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Hozircha saqlangan postlar yo'q</p>
              </div>
            ) : (
                <div className="columns-2 gap-2 sm:gap-4 pb-8 px-2 sm:px-4">
                  {allSaved.map((post, index) =>
                    <div key={post.id} onClick={() => openViewer(allSaved as unknown as Post[], index)} className="cursor-pointer mb-2 sm:mb-4 break-inside-avoid">
                      {(post as unknown as Record<string, unknown>).isMemorial ?
                        <MemorialPostCard post={post as unknown as Parameters<typeof MemorialPostCard>[0]['post']} /> :
                        <PostCard post={post as unknown as Parameters<typeof PostCard>[0]['post']} />}
                    </div>
                  )}
                </div>
            )
          })()}

        {/* Mentions / Xotira postlari tab */}
        {activeTab === 'mentions' && (() => {
            if (profile?.hide_mentions) {
              return (
                <div className="text-center py-12 px-4">
                  <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Eslatmalar yopiq</p>
                </div>
              )
            }
            return (
              <div>
                {isMemorial ? (
            /* Memorial profile: show memorial_posts with layout toggle */
            <PullToRefresh onRefresh={refetchMemorial} useWindowScroll={true}>
                {memorialLoading ?
              <div className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </div> :
              memorialPosts.length === 0 ?
              <div className="text-center py-12 px-4">
                    <Heart className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Hali xotira post yo'q</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">+ tugmasini bosing</p>
                    <Button variant="outline" className="mt-4" onClick={() => navigate('/create?memberId=' + resolvedMemorialMemberId)}>
                      <Plus className="h-4 w-4 mr-1" /> Xotira qo'shish
                    </Button>
                  </div> :

              <>
                {/* Layout toggle bar */}
                <div className="flex items-center justify-center px-3 py-3 border-b border-white/5 mb-2">
                  <div className="bg-white/10 p-1 rounded-full relative flex-row flex items-start justify-start gap-[4px]">
                    <button
                      onClick={() => setMemorialLayout('list')}
                      className={cn("p-1.5 rounded-full z-10 transition-colors", memorialLayout === 'list' ? "text-white" : "text-white/50")}>
                      
                      <LayoutList className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setMemorialLayout('grid')}
                      className={cn("p-1.5 rounded-full z-10 transition-colors", memorialLayout === 'grid' ? "text-white" : "text-white/50")}>
                      
                      <Grid2X2 className="h-4 w-4" />
                    </button>
                    {/* Animated pill background */}
                    <div
                      className="absolute inset-y-1 bg-white/20 rounded-full transition-all duration-300 ease-out"
                      style={{
                        left: memorialLayout === 'list' ? '0.25rem' : 'calc(50% + 0.125rem)',
                        width: 'calc(50% - 0.375rem)'
                      }} />
                    
                  </div>
                </div>

                {memorialLayout === 'grid' ? (
                /* 2-column masonry layout — same as regular posts */
                <div className="pb-20 px-px">
                    <div className="flex gap-1 p-1">
                      <div className="flex-1 flex flex-col gap-1">
                        {memorialPosts.
                      filter((_, i) => i % 2 === 0).
                      map((mp) => {
                        const mediaUrl = mp.media_url || '';
                        const isVid = mp.media_type === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov');
                        const originalIndex = memorialPosts.findIndex((p) => p.id === mp.id);
                        return (
                          <div
                            key={mp.id}
                            className="relative aspect-[3/4] rounded-[20px] overflow-hidden bg-muted/80 shadow-xl shadow-black/20 border border-white/10 cursor-pointer"
                            onClick={() => openViewer(mappedMemorialPosts, originalIndex)}>
                            
                                {isVid ?
                            <video src={mediaUrl} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="metadata" /> :

                            <img src={mediaUrl} alt="" className="w-full h-full object-cover pointer-events-none" loading="lazy" />
                            }
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                                  <div className="text-white text-[11px] leading-tight">
                                    <div className="flex items-center gap-1">
                                      <Heart className="h-3.5 w-3.5" />
                                      <span>{formatCount(mp.likes_count ?? 0)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>{formatCount(mp.views_count ?? 0)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>)

                      })}
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        {memorialPosts.
                      filter((_, i) => i % 2 === 1).
                      map((mp) => {
                        const mediaUrl = mp.media_url || '';
                        const isVid = mp.media_type === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov');
                        const originalIndex = memorialPosts.findIndex((p) => p.id === mp.id);
                        return (
                          <div
                            key={mp.id}
                            className="relative aspect-[3/4] rounded-[20px] overflow-hidden bg-muted/80 shadow-xl shadow-black/20 border border-white/10 cursor-pointer"
                            onClick={() => openViewer(mappedMemorialPosts, originalIndex)}>
                            
                                {isVid ?
                            <video src={mediaUrl} className="w-full h-full object-cover pointer-events-none" muted playsInline preload="metadata" /> :

                            <img src={mediaUrl} alt="" className="w-full h-full object-cover pointer-events-none" loading="lazy" />
                            }
                                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                                  <div className="text-white text-[11px] leading-tight">
                                    <div className="flex items-center gap-1">
                                      <Heart className="h-3.5 w-3.5" />
                                      <span>{formatCount(mp.likes_count ?? 0)}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>{formatCount(mp.views_count ?? 0)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>)

                      })}
                      </div>
                    </div>
                  </div>) :

                <div className="space-y-0 px-0 md:px-4 pb-20">
                    {memorialPosts.map((mp, index) =>
                  <MemorialPostCard key={mp.id} post={mp} onMediaClick={() => openViewer(mappedMemorialPosts, index)} />
                  )}
                    <EndOfFeed />
                  </div>
                }
              </>
              }
              </PullToRefresh>) : (

            /* Normal profile: show mentions and collabs */
            userMentionedPosts.length === 0 && userCollabPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                  <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Belgilangan postlar yo'q</p>
                </div> :

            <div className="space-y-4 px-0 md:px-4">
                  {[...userMentionedPosts, ...userCollabPosts].
              filter((v, i, a) => a.findIndex((p) => p.id === v.id) === i).
              sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).
              map((post, index) =>
              <div key={post.id} onClick={() => openViewer([...userMentionedPosts, ...userCollabPosts].
              filter((v, i, a) => a.findIndex((p) => p.id === v.id) === i).
              sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), index)} className="cursor-pointer">
                        <PostCard post={post} />
                      </div>
              )}
                  <EndOfFeed />
                </div>)
            }
          </div>
            )
          })()}


        {/* Full screen viewer */}
        {isViewerOpen &&
          <UnifiedFullScreenViewer
            posts={viewerPosts.length > 0 ? viewerPosts : filteredPosts}
            shorts={[]}
            initialTab="posts"
            initialIndex={viewerStartIndex}
            onClose={() => setIsViewerOpen(false)} />

          }

        {/* Story Viewer for this profile only */}
        {storyViewerOpen && profileStoryGroups.length > 0 && (
          <StoryViewer
            storyGroups={profileStoryGroups}
            initialGroupIndex={0}
            initialStoryIndex={initialStoryIndex}
            persistKey={`userprofile:${userId || 'unknown'}`}
            onClose={() => setStoryViewerOpen(false)} />
          )}

        {/* Profile Edit Dialog */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-3xl border border-white/10 bg-background/95 backdrop-blur-2xl shadow-2xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Profilni tahrirlash</DialogTitle>
            </DialogHeader>

            {/* Cover section - acts as header */}
            <div
              className="relative h-36 bg-gradient-to-br from-slate-700 to-slate-900 cursor-pointer group"
              onClick={() => coverInputRef.current?.click()}
            >
              {editCoverUrl && <img src={editCoverUrl} alt="Cover" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full border border-white/20 backdrop-blur-sm font-medium flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-3.5 h-3.5" />
                  Fon rasmini o'zgartirish
                </div>
              </div>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleEditFileSelect(e, 'cover')}
              />
            </div>

            {/* Avatar overlapping cover */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[102px] z-20">
              <div
                className="w-24 h-24 rounded-full ring-4 ring-background overflow-hidden cursor-pointer group/av shadow-xl bg-gradient-to-br from-primary to-accent"
                onClick={() => avatarEditInputRef.current?.click()}
              >
                {(editAvatarUrl || profile?.avatar_url) && (
                  <img src={editAvatarUrl || profile?.avatar_url || ''} alt="Avatar" className="w-full h-full object-cover" />
                )}
                {!editAvatarUrl && !profile?.avatar_url && (
                  <span className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                    {(editName || profile?.name || '?')[0]?.toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input
                ref={avatarEditInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleEditFileSelect(e, 'avatar')}
              />
            </div>

            {/* Form body */}
            <div className="px-5 pb-5 pt-16 flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ism</Label>
                <div className="relative">
                  <Input
                    value={editName}
                    maxLength={25}
                    onChange={(e) => setEditName(e.target.value.slice(0, 25))}
                    placeholder="Ismini kiriting"
                    className="rounded-2xl h-12 bg-muted/30 border-muted/50 focus:border-primary/50 text-center text-base font-medium pr-14"
                  />
                  <span className={cn(
                    "absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium tabular-nums",
                    editName.length >= 23 ? "text-rose-400" : "text-muted-foreground/50"
                  )}>{editName.length}/25</span>
                </div>
              </div>

              {/* Years */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Yillar</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium text-center">Tug'ilgan</span>
                    <Input
                      type="number"
                      value={editBirthYear}
                      onChange={(e) => setEditBirthYear(e.target.value)}
                      placeholder="1980"
                      min="1800"
                      max={new Date().getFullYear()}
                      className="rounded-2xl h-11 bg-muted/30 border-muted/50 focus:border-primary/50 text-center text-base font-semibold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground font-medium text-center">Vafot etgan</span>
                    <Input
                      type="number"
                      value={editDeathYear}
                      onChange={(e) => setEditDeathYear(e.target.value)}
                      placeholder="2020"
                      min="1800"
                      max={new Date().getFullYear()}
                      className="rounded-2xl h-11 bg-muted/30 border-muted/50 focus:border-primary/50 text-center text-base font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Preview of years */}
              {(editBirthYear || editDeathYear) && (
                <div className="flex items-center justify-center gap-2 bg-muted/20 rounded-2xl py-2 px-4 border border-muted/30">
                  <span className="text-sm font-medium text-foreground/80">
                    {editBirthYear && <span>{editBirthYear}</span>}
                    {editBirthYear && editDeathYear && <span className="mx-1 text-muted-foreground">—</span>}
                    {editDeathYear && <span>{editDeathYear}</span>}
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setEditModalOpen(false)} className="flex-1 rounded-2xl h-11 border-muted/60">
                  Bekor
                </Button>
                <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 rounded-2xl h-11">
                  {isSavingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Saqlash
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </>
        }

        {/* Crop modal for edit dialog */}
        <ImageCropper
          isOpen={editCropperState.isOpen}
          onClose={() => setEditCropperState(prev => ({ ...prev, isOpen: false }))}
          imageUrl={editCropperState.imageUrl}
          aspectRatio={editCropperState.cropType === 'cover' ? 16 / 7 : 1}
          shape={editCropperState.cropType === 'cover' ? 'rect' : 'circle'}
          title={editCropperState.cropType === 'cover' ? 'Fon rasmini kesish' : 'Profil rasmini kesish'}
          onCropComplete={handleCropComplete}
        />

        {/* Relative connection sheet */}
        <RelativeConnectionSheet
            open={relativeSheetOpen}
            onOpenChange={setRelativeSheetOpen}
            targetUserId={userId}
            targetUserName={profile?.name || 'Foydalanuvchi'} />

        {/* Merge dialog — same as FamilyTreeV2 */}
        {mergeData !== null && (
          <UnifiedMergeDialog
            isOpen={showMergeDialog}
            onClose={closeMergeDialog}
            data={mergeData}
            onConfirm={executeTreeMerge}
            isProcessing={isMerging}
          />
        )}
      </div>
    </AppLayout>)

};

export default UserProfilePage;
