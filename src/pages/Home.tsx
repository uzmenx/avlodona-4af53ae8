import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PostCard } from "@/components/feed/PostCard";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { StoriesRow } from "@/components/stories/StoriesRow";
import { YouTubeShortsSection, type Short } from "@/components/shorts/YouTubeShortsSection";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { UnifiedFullScreenViewer } from "@/components/feed/UnifiedFullScreenViewer";
import { NotificationsSheet } from "@/components/notifications/NotificationsSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useStories } from "@/hooks/useStories";
import { usePostsCache } from "@/hooks/usePostsCache";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { useAutoPreviewVideo } from "@/hooks/useAutoPreviewVideo";
import { useTreeFeed } from "@/hooks/useTreeFeed";
import { TreePostCard } from "@/components/feed/TreePostCard";
import { useNotifications } from "@/hooks/useNotifications";
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { Grid2X2, LayoutList, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchSheet } from "@/components/search/SearchSheet";
import { Badge } from "@/components/ui/badge";
import { Post } from "@/types";

type GridLayout = 1 | 2;

const Home = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const { storyGroups, refetch: refetchStories } = useStories();
  const { posts, isLoading, isRefreshing, isLoadingMore, hasMore, fetchPosts, loadMore } = usePostsCache();
  const { treePosts, refetch: refetchTrees } = useTreeFeed();
  const { unreadCount } = useNotifications();
  const { anyBlockedIds } = useBlockedUsers();
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);

  const blockedSet = anyBlockedIds();
  const visiblePosts = posts.filter(p => !blockedSet.has(p.user_id));
  const visibleTreePosts = treePosts.filter(tp => !blockedSet.has(tp.user_id));

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const [viewerTab, setViewerTab] = useState<'posts' | 'shorts'>('posts');
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [cachedShorts, setCachedShorts] = useState<Short[]>([]);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [storyGroupIndex, setStoryGroupIndex] = useState(0);

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useSmoothScroll(true, true); // Enable snap and swipe gestures

  const openPostViewer = (index: number) => {
    setViewerTab('posts');
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  const openShortsViewer = (shorts: Short[], index: number) => {
    setCachedShorts(shorts);
    setViewerTab('shorts');
    setViewerInitialIndex(index);
    setViewerOpen(true);
  };

  const handleShortsChange = useCallback((shorts: Short[]) => {
    setCachedShorts(shorts);
  }, []);

  const openStoryViewer = (groupIndex: number) => {
    setStoryGroupIndex(groupIndex);
    setStoryViewerOpen(true);
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore || posts.length === 0) return;
    loadMore();
  }, [isLoading, isLoadingMore, hasMore, posts.length, loadMore]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {if (entries[0]?.isIntersecting) handleLoadMore();},
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const handleRefresh = async () => {
    // Also refresh shorts
    window.dispatchEvent(new Event('refresh-shorts'));
    await Promise.all([fetchPosts(true), refetchStories(), refetchTrees()]);
  };

  useEffect(() => {
    const onNavHome = (e: Event) => {
      const ce = e as CustomEvent<{ action?: 'scrollTop' | 'refresh' }>;
      if (ce.detail?.action === 'refresh') {
        void handleRefresh();
        return;
      }

      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('avlodona:nav:home', onNavHome as EventListener);
    return () => window.removeEventListener('avlodona:nav:home', onNavHome as EventListener);
  }, [handleRefresh, scrollContainerRef]);

  const toggleGridLayout = () => setGridLayout((prev) => prev === 1 ? 2 : 1);

  const hideNav = storyViewerOpen;

  return (
    <AppLayout showNav={!hideNav}>
      <div className="relative max-w-lg mx-auto min-h-[calc(100vh-4rem)]">
        <motion.header
          initial={{ y: -24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="sticky top-0 z-40 px-4 flex items-center justify-between rounded-2xl mx-3 mt-2 mb-0 border border-white/10 bg-background/40 backdrop-blur-xl shadow-lg my-[6px] py-0">

          <h1 className="text-xl font-bold tracking-tight">{t('feed')}</h1>
          <div className="flex items-center gap-1">

            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="h-9 w-9 rounded-xl">
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationsOpen(true)}
              className="relative h-9 w-9 rounded-xl">

              <Bell className="h-5 w-5" />
              {unreadCount > 0 &&
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">

                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              }
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleGridLayout} className="h-9 w-9 rounded-xl">
              {gridLayout === 1 ? <LayoutList className="h-5 w-5" /> : <Grid2X2 className="h-5 w-5" />}
            </Button>
          </div>
        </motion.header>

        {/* Stories */}
        <StoriesRow onStoryClick={openStoryViewer} />

        {/* YouTube Shorts - compact */}
        <YouTubeShortsSection
          onShortClick={openShortsViewer}
          onShortsChange={handleShortsChange}
          onSearchSubmit={(q) => setSearchInitialQuery(q)}
          onSearchClick={() => setSearchOpen(true)}
        />

        <PullToRefresh onRefresh={handleRefresh}>
          {isLoading ?
          <div className="text-center py-12">
              <p className="text-muted-foreground">{t('loading')}</p>
            </div> :
          visiblePosts.length === 0 ?
          <div className="text-center py-12">
              <p className="text-muted-foreground">{t('noPostsYet')}</p>
              <p className="text-sm text-muted-foreground mt-2">{t('createFirstPost')}</p>
            </div> :
          gridLayout === 1 ?
          <div ref={scrollContainerRef} className="smooth-scroll-container space-y-3 pb-20 px-[5px]">
              {/* Tree posts from community */}
              {visibleTreePosts.map((tp, i) => (
                <div key={`tree-${tp.id}`} className="smooth-scroll-item scroll-transition">
                  <TreePostCard post={tp} author={tp.author} index={i} />
                </div>
              ))}
              {visiblePosts.map((post, index) =>
            <div key={post.id} className="smooth-scroll-item scroll-transition">
              <PostCard post={post} onMediaClick={() => openPostViewer(index)} index={index} />
            </div>
            )}
              <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
              {isLoadingMore && <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>}
              {!hasMore && visiblePosts.length > 0 && <EndOfFeed />}
            </div> :

          <div ref={scrollContainerRef} className="smooth-scroll-container pb-20 px-px">
              <div className="flex gap-1 p-1">
                <div className="flex-1 flex flex-col gap-1">
                  {visiblePosts.filter((_, i) => i % 2 === 0).map((post) => {
                  const idx = visiblePosts.findIndex((p) => p.id === post.id);
                  return (
                    <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx % 2 * 0.05 }} onClick={() => openPostViewer(idx)} className="cursor-pointer smooth-scroll-item scroll-transition">
                        <MasonryItem post={post} />
                      </motion.div>);

                })}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  {visiblePosts.filter((_, i) => i % 2 === 1).map((post) => {
                  const idx = visiblePosts.findIndex((p) => p.id === post.id);
                  return (
                    <motion.div key={post.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: idx % 2 * 0.05 }} onClick={() => openPostViewer(idx)} className="cursor-pointer smooth-scroll-item scroll-transition">
                        <MasonryItem post={post} />
                      </motion.div>);

                })}
                </div>
              </div>
              <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
              {isLoadingMore && <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>}
              {!hasMore && visiblePosts.length > 0 && <EndOfFeed />}
            </div>
          }
        </PullToRefresh>

        {viewerOpen &&
        <UnifiedFullScreenViewer
          posts={visiblePosts}
          shorts={cachedShorts}
          initialTab={viewerTab}
          initialIndex={viewerInitialIndex}
          onClose={() => setViewerOpen(false)} />

        }

        {storyViewerOpen && storyGroups.length > 0 &&
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={storyGroupIndex}
          onClose={() => setStoryViewerOpen(false)}
          onDeleted={() => refetchStories()} />

        }

        <NotificationsSheet open={notificationsOpen} onOpenChange={setNotificationsOpen} />
        <SearchSheet
          open={searchOpen}
          onOpenChange={(open) => {
            setSearchOpen(open);
            if (!open) setSearchInitialQuery('');
          }}
          initialQuery={searchInitialQuery}
        />
      </div>
    </AppLayout>);

};

const MasonryItem = ({ post }: {post: Post;}) => {
  const mediaUrl = post.media_urls?.[0] || post.image_url;
  const isVideo = mediaUrl && (mediaUrl.includes(".mp4") || mediaUrl.includes(".mov") || mediaUrl.includes(".webm"));
  const videoRef = useRef<HTMLVideoElement>(null);
  useAutoPreviewVideo(videoRef, { enabled: !!isVideo, delayMs: 3000, threshold: 0.6 });

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-muted/80 shadow-xl shadow-black/20 border border-white/10">
      {mediaUrl ?
      <>
          {isVideo ?
        <video
          ref={videoRef}
          src={mediaUrl}
          className="w-full h-auto block"
          style={{ maxHeight: "80vh" }}
          muted
          playsInline
          loop
          preload="metadata"
        /> :

        <img src={mediaUrl} alt="Post" className="w-full h-auto block" style={{ maxHeight: "80vh" }} />
        }
          {post.media_urls && post.media_urls.length > 1 &&
        <div className="absolute top-2 right-2 bg-background/80 rounded px-1.5 py-0.5 text-xs font-medium">
              +{post.media_urls.length - 1}
            </div>
        }
        </> :

      <div className="w-full aspect-square flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
          {post.content?.substring(0, 50)}
        </div>
      }
    </div>);

};

export default Home;