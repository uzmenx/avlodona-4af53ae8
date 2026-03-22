import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Settings, Edit, Search, Grid3X3, Bookmark, Users, AtSign, ChevronDown, ChevronUp, BadgeCheck, BadgeX, Clock, LayoutList, Grid2X2, Columns2, Sparkles, Trash2, Check, Heart, Eye } from 'lucide-react';

import { HighlightsRow, FollowHubDrawer, SocialLinksList, CollectionsFilter } from '@/components/profile';

import { useUserPosts } from '@/hooks/useUserPosts';
import { useSavedPosts } from '@/hooks/useSavedPosts';
import { useFollow } from '@/hooks/useFollow';
import { useStoryHighlights } from '@/hooks/useStoryHighlights';
import { useMentionsCollabs } from '@/hooks/useMentionsCollabs';

import { type PostCollection, usePostCollections } from '@/hooks/usePostCollections';
import { useSmoothScroll } from '@/hooks/useSmoothScroll';
import { useActiveStories } from '@/hooks/useActiveStories';

import { useStories } from '@/hooks/useStories';
import { PostCard } from '@/components/feed/PostCard';
import { MemorialPostCard } from '@/components/post/MemorialPostCard';
import { FullScreenViewer } from '@/components/feed/FullScreenViewer';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { EndOfFeed } from '@/components/feed/EndOfFeed';
import { HighlightEditor } from '@/components/profile/HighlightEditor';
import { CollabRequestsSheet } from '@/components/post/CollabRequestsSheet';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StarUsername } from '@/components/user/StarUsername';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatCount';
import { getStoryRingGradient } from '@/components/stories/storyRings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Post } from '@/types';
import { useAutoPreviewVideo } from '@/hooks/useAutoPreviewVideo';
import { Icon } from '@iconify/react';

const PremiumStarsIcon = ({ className, active, size = 'default' }: { className?: string; active?: boolean; size?: 'default' | 'sm' }) => (
  <div className={cn("relative flex items-center justify-center transition-all duration-300", className)}>
    <Icon 
      icon="mdi:stars" 
      className={cn(
        size === 'sm' ? "w-5 h-5" : "w-6 h-6",
        "transition-all duration-300", 
        active ? "text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "text-muted-foreground opacity-60"
      )}
    />
    <Icon 
      icon="pepicons-pop:stars" 
      className={cn(
        "absolute transition-all duration-300 delay-75", 
        size === 'sm' ? "-top-1 -right-1 w-2.5 h-2.5" : "-top-1.5 -right-1.5 w-3.5 h-3.5",
        active ? "text-emerald-400 opacity-90 scale-110" : "text-muted-foreground opacity-40 scale-75"
      )}
    />
    <Icon 
      icon="mdi:stars" 
      className={cn(
        "absolute transition-all duration-500 delay-150", 
        size === 'sm' ? "-bottom-0.5 -left-0.5 w-2 h-2" : "-bottom-1 -left-1 w-2.5 h-2.5",
        active ? "text-emerald-300 opacity-80 scale-125" : "text-muted-foreground opacity-30 scale-50"
      )}
    />
  </div>
);

const ProfileMasonryItem = ({ post }: {post: Post;}) => {
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

const Profile = () => {

  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { posts, isLoading, postsCount, refetch, removePost } = useUserPosts(user?.id);
  const { savedPosts, savedMemorialPosts, isLoading: savedLoading, fetchSavedPosts } = useSavedPosts();
  const { followersCount, followingCount } = useFollow(user?.id);
  const { highlights, fetchHighlights } = useStoryHighlights();
  const {
    collections,
    selectedCollectionId,
    setSelectedCollectionId,
    collectionPosts,
    createCollection,
    updateCollection,
    deleteCollection,
    addPostToCollection,
    removePostFromCollection
  } = usePostCollections();

  const { mentionedPosts, collabPosts, pendingCollabs, respondToCollab } = useMentionsCollabs();
  const { getStoryInfo } = useActiveStories();
  const { storyGroups } = useStories();

  const [lastProfileTapTsRef] = useState({ current: 0 });
  const [bioExpanded, setBioExpanded] = useState(false);
  const [needsMoreButton, setNeedsMoreButton] = useState(false);
  const [showPostsStats, setShowPostsStats] = useState(false);
  const [followHubOpen, setFollowHubOpen] = useState(false);
  const [followHubTab, setFollowHubTab] = useState<'followers' | 'following' | 'unfollow'>('followers');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerPosts, setViewerPosts] = useState<Post[]>([]);
  const [showNewHighlight, setShowNewHighlight] = useState(false);
  const [postsLayout, setPostsLayout] = useState<'list' | 'pinterest1' | 'pinterest2'>('pinterest2');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'mentions'>('posts');
  const [showCollabRequests, setShowCollabRequests] = useState(false);
  const [collectionEditorOpen, setCollectionEditorOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<PostCollection | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTheme, setEditingTheme] = useState(0);
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [collectionTab, setCollectionTab] = useState<'all' | 'selected'>('all');
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [profileStoryGroups, setProfileStoryGroups] = useState<any[]>([]);
  const [lastPostsTabTapTsRef] = useState({ current: 0 });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const familyMemberCountRef = useRef(0);
  const [familyMemberCount, setFamilyMemberCount] = useState(0);

  useEffect(() => {
    if (showPostsStats) return;
    // no-op: keep follow hub controlled by user
  }, [showPostsStats]);

  const cyclePostsLayout = useCallback(() => {
    setPostsLayout((prev) => (prev === 'list' ? 'pinterest2' : 'list'));
  }, []);

  const togglePostsLayoutHidden = useCallback(() => {
    setPostsLayout((prev) => (prev === 'list' ? 'pinterest2' : 'list'));
  }, []);

  const collectionThemes = useMemo(
    () => [
    { bg: 'from-rose-500/25 via-fuchsia-500/15 to-indigo-500/25', ring: 'ring-rose-500/25' },
    { bg: 'from-emerald-500/25 via-teal-500/15 to-cyan-500/25', ring: 'ring-emerald-500/25' },
    { bg: 'from-amber-500/25 via-orange-500/15 to-rose-500/25', ring: 'ring-amber-500/25' },
    { bg: 'from-sky-500/25 via-blue-500/15 to-violet-500/25', ring: 'ring-sky-500/25' },
    { bg: 'from-violet-500/25 via-purple-500/15 to-pink-500/25', ring: 'ring-violet-500/25' },
    { bg: 'from-lime-500/20 via-green-500/15 to-emerald-500/25', ring: 'ring-lime-500/25' }],

    []
  );

  const openCollectionEditor = useCallback(async (c: PostCollection, mode: 'create' | 'edit' = 'edit') => {
    setCollectionEditorMode(mode);
    setEditingCollection(c);
    setEditingName(c.name || '');
    setEditingTheme(Number.isFinite((c as any).theme) ? (c as any).theme as number || 0 : 0);
    setCollectionTab('selected');

    try {
      const { data: items, error } = await supabase.
      from('post_collection_items').
      select('post_id').
      eq('collection_id', c.id);
      if (error) throw error;
      setSelectedPostIds(new Set((items || []).map((i) => i.post_id)));
    } catch (e) {
      console.error('Error fetching collection items:', e);
      setSelectedPostIds(new Set());
    }

    setCollectionEditorOpen(true);
  }, []);

  const [collectionEditorMode, setCollectionEditorMode] = useState<'create' | 'edit'>('edit');

  const togglePostInEditor = useCallback((postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);else
      next.add(postId);
      return next;
    });
  }, []);

  const saveCollectionEditor = useCallback(async () => {
    if (!editingCollection) return;
    if (isSavingCollection) return;

    setIsSavingCollection(true);
    try {
      const { data: items, error } = await supabase.
      from('post_collection_items').
      select('post_id').
      eq('collection_id', editingCollection.id);
      if (error) throw error;
      const currentIds = new Set((items || []).map((i) => i.post_id));

      const toAdd: string[] = [];
      const toRemove: string[] = [];

      for (const id of selectedPostIds) {
        if (!currentIds.has(id)) toAdd.push(id);
      }
      for (const id of currentIds) {
        if (!selectedPostIds.has(id)) toRemove.push(id);
      }

      const nameTrimmed = editingName.trim();
      if (nameTrimmed && nameTrimmed !== editingCollection.name) {
        await updateCollection(editingCollection.id, { name: nameTrimmed });
      }

      const existingTheme = Number.isFinite((editingCollection as any).theme) ? (editingCollection as any).theme as number || 0 : 0;
      if (editingTheme !== existingTheme) {
        await updateCollection(editingCollection.id, { theme: editingTheme });
      }

      for (const pid of toAdd) {
        await addPostToCollection(editingCollection.id, pid);
      }
      for (const pid of toRemove) {
        await removePostFromCollection(editingCollection.id, pid);
      }

      setCollectionEditorOpen(false);
      setEditingCollection(null);
    } catch (e) {
      console.error('Error saving collection editor:', e);
      toast({ title: 'Saqlashda xatolik', description: 'Rang yoki postlar saqlanmadi. (DB migration theme qo‘shilganini tekshiring)' });
    } finally {
      setIsSavingCollection(false);
    }
  }, [addPostToCollection, editingCollection, editingName, editingTheme, isSavingCollection, removePostFromCollection, selectedPostIds, toast, updateCollection]);

  const handleDeleteCollection = useCallback(async () => {
    if (!editingCollection) return;
    try {
      await deleteCollection(editingCollection.id);
      setCollectionEditorOpen(false);
      setEditingCollection(null);
    } catch (e) {
      console.error('Error deleting collection:', e);
    }
  }, [deleteCollection, editingCollection]);

  const bioRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bioRef.current && profile?.bio) {
      // Check if bio text overflows 2 lines
      const lineHeight = parseInt(window.getComputedStyle(bioRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * 2;
      setNeedsMoreButton(bioRef.current.scrollHeight > maxHeight);
    }
  }, [profile?.bio]);

  const scrollContainerRef = useSmoothScroll(true, true);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), fetchSavedPosts(), fetchHighlights()]);
  }, [fetchHighlights, fetchSavedPosts, refetch]);

  const scrollToTop = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollContainerRef]);

  useEffect(() => {
    const onNavProfile = (e: Event) => {
      const ce = e as CustomEvent<{action?: 'scrollTop' | 'refresh';}>;
      if (ce.detail?.action === 'refresh') {
        void handleRefresh();
        scrollToTop();
        return;
      }

      scrollToTop();
    };

    window.addEventListener('avlodona:nav:profile', onNavProfile as EventListener);
    return () => window.removeEventListener('avlodona:nav:profile', onNavProfile as EventListener);
  }, [handleRefresh, scrollToTop]);

  // Load family tree member count
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('family_tree_members').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).
    then(({ count }) => setFamilyMemberCount(count || 0));
  }, [user?.id]);

  const hideHighlights = (profile as any)?.hide_highlights === true;
  const hideCollections = (profile as any)?.hide_collections === true;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const openViewer = (index: number, postsList: typeof posts) => {
    setViewerInitialIndex(index);
    setViewerPosts(postsList);
    setViewerOpen(true);
  };

  const displayPosts = selectedCollectionId ? collectionPosts : posts;
  const filteredPosts = useMemo(() => {
    const q = appliedSearchQuery.trim().toLowerCase();
    if (!q) return displayPosts;
    return (displayPosts || []).filter((p) => (p?.content || '').toLowerCase().includes(q));
  }, [appliedSearchQuery, displayPosts]);

  const hasMore = false;

  return (
    <AppLayout>
      <div
        className="min-h-screen pb-20 relative"
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
        }}
      >
        {/* Main Container */}
        <div className="max-w-md mx-auto">

        {/* ═══════════════════════════════════════
                                                                        COVER IMAGE
                                                                     ═══════════════════════════════════════ */}
        <div className="relative h-28 overflow-hidden rounded-b-2xl">

          {(profile as any)?.cover_url ?
            <img
              src={(profile as any).cover_url}
              alt="Cover"
              className="w-full h-full object-cover" /> :

            <div className="w-full h-full bg-white/5 dark:bg-white/0" />
            }
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Action buttons — top right */}
          <div className="absolute top-3 right-3 flex gap-2 z-10">
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
                    'h-9 bg-black/30 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 rounded-xl transition-all duration-200 mr-2',
                    searchExpanded ? 'w-44 px-3 opacity-100' : 'w-0 px-0 opacity-0 pointer-events-none'
                  )} />
                
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
                  className="relative h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">
                  
                <Search className="h-4 w-4" />
              </Button>
            </form>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/settings')}
                className="h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">

              <Settings className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/edit-profile')}
                className="h-9 w-9 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 text-white rounded-xl">

              <Edit className="h-4 w-4" />
            </Button>
          </div>

        </div>

          {/* PROFILE HEADER BLOCK */}
          <div className="px-3 -mt-8 relative z-10">

            {/* ROW 1: Followers | Avatar | Postlar */}
            <div className="flex items-end justify-between gap-1 mb-1">

              {/* LEFT: Followers */}
              <button
                type="button"
                onClick={() => {
                  setFollowHubTab('followers');
                  setFollowHubOpen(true);
                }}

                className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0">
                
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  {t('followers')}
                </span>
                <span className="text-lg font-extrabold text-foreground leading-none">
                  {formatCount(followersCount)}
                </span>
              </button>

              {/* CENTER: Avatar with story ring */}
              <div className="flex-shrink-0 flex flex-col items-center">
                {(() => {
                  const myStoryInfo = user ? getStoryInfo(user.id) : undefined;
                  if (myStoryInfo) {
                    return (
                      <div
                        className="h-16 w-16 rounded-full p-[2px] cursor-pointer shadow-2xl"
                        style={{
                          background: myStoryInfo.has_unviewed ?
                          getStoryRingGradient(myStoryInfo.ring_id) :
                          'var(--muted-foreground)'
                        }}
                        onClick={() => {
                          const idx = storyGroups.findIndex((g) => g.user_id === user?.id);
                          if (idx >= 0) {
                            setProfileStoryGroups([storyGroups[idx]]);
                            setStoryViewerOpen(true);
                          }
                        }}>
                          
                        <div className="w-full h-full rounded-full bg-background p-[2px]">
                          <Avatar className="h-full w-full">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                              {getInitials(profile?.name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </div>);

                  }
                  return (
                    <Avatar className="h-16 w-16 border-4 border-background shadow-2xl ring-2 ring-primary/30">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-accent text-white font-bold">
                        {getInitials(profile?.name)}
                      </AvatarFallback>
                    </Avatar>);

                })()}
              </div>

              {/* RIGHT: Postlar */}
              <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0 relative">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                  {t('posts')}
                </span>
                <span className="text-lg font-extrabold text-foreground leading-none">
                  {formatCount(postsCount)}
                </span>
                <button
                  onClick={() => setShowPostsStats(!showPostsStats)}
                  className="absolute -bottom-2 right-2 h-5 w-5 bg-muted rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-all opacity-65"
                  style={{ transform: showPostsStats ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>

                  <ChevronDown className="h-3 w-3 text-foreground" />
                </button>
              </div>
            </div>

            {/* ROW 2: Name & Username */}
            <div className="text-center mb-1.5">
              {profile?.name && (
                <h1 className="text-lg font-extrabold text-foreground leading-tight truncate">
                  {profile.name}
                </h1>
              )}
              <div className="mt-0.5 break-words whitespace-normal my-0">
                <StarUsername username={profile?.username || user?.email?.split('@')[0] || 'username'} />
              </div>
            </div>

            {/* ROW 3: Kuzatilmoqda | (spacer) | Oila a'zolari */}
            {showPostsStats &&
            <div className="flex justify-center mb-1">
                <div className="flex items-end justify-center gap-1.5 w-full max-w-[480px]">
                  <button
                  type="button"
                  onClick={() => {
                    setFollowHubTab('following');
                    setFollowHubOpen(true);
                  }}

                  className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0">
                    
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                      {t('following')}
                    </span>
                    <span className="text-lg font-extrabold text-foreground leading-none">
                      {formatCount(followingCount)}
                    </span>
                  </button>

                  <button
                  type="button"
                  onClick={() => {
                    setFollowHubTab('unfollow');
                    setFollowHubOpen(true);
                  }}
                  className="flex-shrink-0 w-16 h-[44px] flex items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl"
                  aria-label="Unfollow history">
                    
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </button>

                  <div className="flex-1 flex flex-col items-center justify-center bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl px-1.5 py-1 shadow-lg min-w-0">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                      Oila a'zolari
                    </span>
                    <span className="text-lg font-extrabold text-foreground leading-none">
                      {formatCount(familyMemberCount)}
                    </span>
                  </div>
                </div>
              </div>
            }
            {/* Bio */}
            {profile?.bio &&
            <div className="mb-1.5 px-3">
                <div className="bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/20 rounded-2xl p-1.5 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                  <div className="relative">
                    <div
                    ref={bioRef}
                    className={`text-xs text-muted-foreground leading-relaxed transition-all duration-300 cursor-pointer ${
                    !bioExpanded && needsMoreButton ? 'line-clamp-2' : ''}`
                    }
                    style={{
                      overflow: 'hidden',
                      display: 'webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: bioExpanded ? 'unset' : '2'
                    }}
                    onClick={() => needsMoreButton && setBioExpanded(!bioExpanded)}>

                      {profile.bio}
                      {!bioExpanded && needsMoreButton &&
                    <span className="inline-flex items-center gap-1 ml-1">
                          <span className="text-blue-500 hover:underline">...</span>
                          <ChevronDown
                        className="h-4 w-4"
                        style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }} />

                        </span>
                    }
                      {bioExpanded &&
                    <span className="inline-flex items-center gap-1 ml-1">
                          <ChevronUp
                        className="h-4 w-4"
                        style={{ color: 'rgba(255,255,255,0.6)', transition: 'transform 0.2s' }} />

                        </span>
                    }
                    </div>
                  </div>
                </div>
              </div>
            }

            {/* Social Links */}
            {(profile as any)?.social_links &&
            <div className="flex justify-center mb-1.5">
                <SocialLinksList links={(profile as any).social_links} className="justify-center" />
              </div>
            }
          </div>

          {/* ═══════════════════════════════════════
                                                                       STORY HIGHLIGHTS
                                                                    ═══════════════════════════════════════ */}
          {!hideHighlights &&
          <div className="flex justify-center">
              <HighlightsRow
              highlights={highlights}
              isOwner={true}
              onCreateNew={() => setShowNewHighlight(true)}
              onRefresh={fetchHighlights} />

            </div>
          }

          {/* ═══════════════════════════════════════
                                                                       COLLECTIONS FILTER
                                                                    ═══════════════════════════════════════ */}
          {!hideCollections && activeTab === 'posts' &&
          <div className="flex items-start justify-start">
              <CollectionsFilter
              collections={collections}
              selectedId={selectedCollectionId}
              onSelect={setSelectedCollectionId}
              isOwner={true}
              onCreateCollection={async (name, theme) => {
                const created = await createCollection(name, theme);
                if (created) {
                  await openCollectionEditor(created as any, 'create');
                }
              }}
              onLongPressCollection={(c) => openCollectionEditor(c, 'edit')} />

            </div>
          }

          {/* ═══════════════════════════════════════
                                                                       TABS
                                                                    ═══════════════════════════════════════ */}
          <div className="px-4">
            <div className="flex border-b border-border mb-1">
              <button
                onClick={() => {
                  if (activeTab !== 'posts') {
                    setActiveTab('posts');
                    setSelectedCollectionId(null);
                  } else {
                    cyclePostsLayout();
                  }
                }}
                className={cn(
                  'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-all duration-300',
                  activeTab === 'posts' ?
                  'border-primary' :
                  'border-transparent'
                )}>

                <div 
                  className={cn(
                    "relative w-16 h-8 bg-slate-100/90 dark:bg-slate-800/80 rounded-full border border-slate-200/60 dark:border-white/10 p-1 flex items-center shadow-md transition-all duration-500 overflow-hidden",
                    activeTab !== 'posts' && "opacity-60 scale-90 grayscale-[0.5]"
                  )}
                >
                  {/* Sliding Handle */}
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

                  {/* Background Icons */}
                  <div className="flex w-full justify-between items-center px-1.5 opacity-30">
                    <LayoutList className="h-4 w-4" />
                    <PremiumStarsIcon active={activeTab === 'posts'} size="sm" />
                  </div>
                  
                  {/* Subtle Glow Trail */}
                  <div 
                    className={cn(
                      "absolute inset-y-0 w-8 bg-gradient-to-r from-emerald-400/20 to-teal-400/20 blur-md transition-all duration-500",
                      postsLayout === 'list' ? "left-0" : "left-8"
                    )}
                  />
                </div>
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={cn(
                  'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-colors',
                  activeTab === 'saved' ?
                  'border-primary text-primary' :
                  'border-transparent text-muted-foreground'
                )}>

                <Bookmark className="h-5 w-5" />
              </button>
              <button
                onClick={() => setActiveTab('mentions')}
                className={cn(
                  'flex-1 py-1.5 flex items-center justify-center border-b-2 transition-colors',
                  activeTab === 'mentions' ?
                  'border-primary text-primary' :
                  'border-transparent text-muted-foreground'
                )}>

                <AtSign className="h-5 w-5" />
              </button>
              {pendingCollabs.length > 0 &&
              <button
                onClick={() => setShowCollabRequests(true)}
                className="py-2 px-3 flex items-center justify-center border-b-2 border-transparent text-muted-foreground relative">

                  <Users className="h-5 w-5" />
                  <Badge
                  variant="destructive"
                  className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">

                    {pendingCollabs.length}
                  </Badge>
                </button>
              }
            </div>
          </div>

          <FollowHubDrawer
            open={followHubOpen}
            onOpenChange={setFollowHubOpen}
            userId={user?.id}
            initialTab={followHubTab} />
          

          {/* ═══════════════════════════════════════
                                                                       POSTS TAB
                                                                    ═══════════════════════════════════════ */}
        {activeTab === 'posts' &&
          <PullToRefresh onRefresh={refetch} useWindowScroll={true}>
            {isLoading ?
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div> :
            filteredPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <Grid3X3 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {selectedCollectionId ? "Bu ro'yxatda postlar yo'q" : t('noPosts')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {!selectedCollectionId && t('createFirst')}
                </p>
              </div> :

            postsLayout === 'list' ?
            <div ref={scrollContainerRef} className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {filteredPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, filteredPosts)}
                className="cursor-pointer">
                
                    <PostCard post={post} onDelete={() => removePost(post.id)} />
                  </div>
              )}
                {hasMore === false && filteredPosts.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8,
                      }}
                    />
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0,
                      }}
                    >
                      Postlar tugadi
                    </p>
                  </div>
                )}
              </div> :
            postsLayout === 'pinterest1' ?
            <div ref={scrollContainerRef} className="smooth-scroll-container pb-20 px-px">
                <div className="flex flex-col gap-1 p-1">
                  {filteredPosts.map((post, idx) =>
                <div
                  key={post.id}
                  onClick={() => openViewer(idx, filteredPosts)}
                  className="cursor-pointer">
                  
                      <ProfileMasonryItem post={post} />
                    </div>
                )}
                </div>
                {hasMore === false && filteredPosts.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8,
                      }}
                    />
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0,
                      }}
                    >
                      Postlar tugadi
                    </p>
                  </div>
                )}
              </div> :

            <div ref={scrollContainerRef} className="smooth-scroll-container pb-20 px-px">
                <div className="flex p-1 gap-[2px]">
                  <div className="flex-1 flex flex-col gap-1">
                    {filteredPosts.
                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })}
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    {filteredPosts.
                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })}
                  </div>
                </div>
                {hasMore === false && filteredPosts.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '24px 16px 40px',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 1.5,
                        borderRadius: 99,
                        background: 'rgba(100,130,160,0.25)',
                        marginBottom: 8,
                      }}
                    />
                    <span style={{ fontSize: 20 }}>✦</span>
                    <p
                      style={{
                        fontSize: 13,
                        color: 'rgba(80,100,130,0.6)',
                        fontWeight: 500,
                        letterSpacing: 0.3,
                        margin: 0,
                      }}
                    >
                      Postlar tugadi
                    </p>
                  </div>
                )}
              </div>
            }
          </PullToRefresh>
          }

        {/* ═══════════════════════════════════════
                                                                        SAVED TAB
                                                                     ═══════════════════════════════════════ */}
        {activeTab === 'saved' &&
          <PullToRefresh onRefresh={fetchSavedPosts} useWindowScroll={true}>
            {savedLoading ?
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div> :
            savedPosts.length === 0 && savedMemorialPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <Bookmark className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">{t('noSaved')}</p>
              </div> :

            <div ref={scrollContainerRef} className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {/* Merge and sort both regular and memorial saved posts by date */}
                {[
                  ...savedPosts.map(p => ({ type: 'regular' as const, post: p, date: new Date(p.created_at).getTime() })),
                  ...savedMemorialPosts.map(p => ({ type: 'memorial' as const, post: p, date: new Date(p.savedAt || p.created_at).getTime() }))
                ]
                  .sort((a, b) => b.date - a.date)
                  .map((item, index) => item.type === 'regular' ? (
                    <div
                      key={`reg-${item.post.id}`}
                      onClick={() => openViewer(index, savedPosts)}
                      className="cursor-pointer">
                      <PostCard post={item.post} />
                    </div>
                  ) : (
                    <MemorialPostCard key={`mem-${item.post.id}`} post={item.post as any} />
                  ))
                }
                <EndOfFeed />
              </div>
            }
          </PullToRefresh>
          }

        {/* ═══════════════════════════════════════
                                                                        MENTIONS TAB
                                                                     ═══════════════════════════════════════ */}
        {activeTab === 'mentions' &&
          <PullToRefresh onRefresh={async () => {}} useWindowScroll={true}>
            {isLoading ?
            <div className="text-center py-12">
                <p className="text-muted-foreground">{t('loading')}</p>
              </div> :
            mentionedPosts.length === 0 && collabPosts.length === 0 ?
            <div className="text-center py-12 px-4">
                <AtSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">Siz belgilangan postlar yo'q</p>
              </div> :

            <div ref={scrollContainerRef} className="smooth-scroll-container space-y-4 px-0 md:px-4">
                {[...collabPosts, ...mentionedPosts].map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, [...collabPosts, ...mentionedPosts])}
                className="cursor-pointer">
                
                        <PostCard post={post} />
                      </div>
              )}
                <EndOfFeed />
              </div>
            }
          </PullToRefresh>
          }
        </div>
      </div>

      {viewerOpen && (
        <FullScreenViewer
          posts={viewerPosts}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {showNewHighlight && (
        <HighlightEditor
          open={showNewHighlight}
          onClose={() => { setShowNewHighlight(false); fetchHighlights(); }}
          isNew
        />
      )}

      <CollabRequestsSheet
        open={showCollabRequests}
        onOpenChange={setShowCollabRequests}
        requests={pendingCollabs}
        onRespond={respondToCollab} />

      {storyViewerOpen && profileStoryGroups.length > 0 && (
        <StoryViewer
          storyGroups={profileStoryGroups}
          initialGroupIndex={0}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}

        {/* Collection Editor Dialog */}
        <Dialog open={collectionEditorOpen} onOpenChange={setCollectionEditorOpen}>
          <DialogContent className="max-w-md p-0 overflow-hidden bg-background border-none shadow-2xl rounded-3xl">
            <div className="p-6 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center justify-between">
                  {collectionEditorMode === 'create' ? "Yangi ro'yxat" : "Ro'yxatni tahrirlash"}
                  {collectionEditorMode === 'edit' &&
                  <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteCollection}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  }
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Nom bering</label>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    placeholder="Masalan: Sevimli postlar"
                    className="h-12 px-4 bg-muted/50 border-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl text-lg" />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground ml-1">Mavzu tanlang</label>
                  <div className="grid grid-cols-3 gap-3">
                    {collectionThemes.map((theme, idx) =>
                    <button
                        key={idx}
                        onClick={() => setEditingTheme(idx)}
                        className={cn(
                          'h-14 rounded-2xl bg-gradient-to-br transition-all duration-300 relative group overflow-hidden ring-offset-2 ring-offset-background',
                          theme.bg,
                          editingTheme === idx ? `ring-2 ${theme.ring} scale-[1.02]` : 'opacity-80 hover:opacity-100 hover:scale-[1.02]'
                        )}>
                      {editingTheme === idx &&
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                        <Check className="h-6 w-6 text-white drop-shadow-md" />
                      </div>
                      }
                    </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 p-1 bg-muted/50 rounded-2xl">
                  <button
                    onClick={() => setCollectionTab('all')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-xl transition-all',
                      collectionTab === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}>
                    Barcha postlar
                  </button>
                  <button
                    onClick={() => setCollectionTab('selected')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-xl transition-all',
                      collectionTab === 'selected' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}>
                    Tanlanganlar ({selectedPostIds.size})
                  </button>
                </div>

                <ScrollArea className="h-[300px] rounded-2xl bg-muted/30">
                  <div className="p-3 grid grid-cols-3 gap-2">
                    {(collectionTab === 'all' ? posts : posts.filter((p) => selectedPostIds.has(p.id))).map((post) =>
                    <button
                        key={post.id}
                        onClick={() => togglePostInEditor(post.id)}
                        className={cn(
                          'relative aspect-square rounded-xl overflow-hidden group transition-all duration-300',
                          selectedPostIds.has(post.id) ? 'ring-2 ring-primary scale-[0.98]' : 'hover:scale-[1.02]'
                        )}>
                      <img
                          src={(post.media_urls && post.media_urls.length > 0 ? post.media_urls[0] : post.image_url) || ''}
                          className={cn('w-full h-full object-cover transition-opacity', selectedPostIds.has(post.id) ? 'opacity-70' : 'group-hover:opacity-90')} />
                      {selectedPostIds.has(post.id) &&
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="bg-primary text-white p-1 rounded-full shadow-lg">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                      }
                    </button>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <Button
                onClick={saveCollectionEditor}
                disabled={isSavingCollection || !editingName.trim()}
                className="w-full h-14 text-lg font-bold rounded-2xl bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]">
                {isSavingCollection ? 'Saqlanmoqda...' : collectionEditorMode === 'create' ? "Ro'yxatni yaratish" : 'Saqlash'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </AppLayout>
  );
};

export default Profile;