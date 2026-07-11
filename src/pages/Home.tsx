import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PullToRefresh } from "@/components/feed/PullToRefresh";
import { YouTubeShortsSection, type Short } from "@/components/shorts/YouTubeShortsSection";
import { SHOW_YOUTUBE } from "@/lib/utils";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { UnifiedFullScreenViewer } from "@/components/feed/UnifiedFullScreenViewer";
import { NotificationsSheet } from "@/components/notifications/NotificationsSheet";

import { useLanguage } from "@/contexts/LanguageContext";
import { useStories } from "@/hooks/useStories";
import { usePostsCache } from "@/hooks/usePostsCache";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { useTreeFeed } from "@/hooks/useTreeFeed";
import { useNotifications } from "@/hooks/useNotifications";
import { useConversations } from "@/hooks/useConversations";
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { SearchSheet } from "@/components/search/SearchSheet";

import { HomeHeader } from "@/components/home/HomeHeader";
import { FeedListLayout } from "@/components/home/FeedListLayout";
import { FeedGridLayout } from "@/components/home/FeedGridLayout";

type GridLayout = 1 | 2;

const Home = () => {
  const { t } = useLanguage();
  const { storyGroups, refetch: refetchStories } = useStories();
  const { posts, isLoading, isLoadingMore, hasMore, fetchPosts, forceRefresh, loadMore } = usePostsCache();
  const { treePosts, refetch: refetchTrees } = useTreeFeed();
  const { unreadCount } = useNotifications();
  const { totalUnread: messageCount } = useConversations();
  const { anyBlockedIds } = useBlockedUsers();
  
  const [gridLayout, setGridLayout] = useState<GridLayout>(1);
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
  const scrollContainerRef = useSmoothScroll(true, true);
  const topAnchorRef = useRef<HTMLDivElement>(null);

  const blockedSet = anyBlockedIds();
  const visiblePosts = useMemo(() => posts.filter((p) => !blockedSet.has(p.user_id)), [posts, blockedSet]);
  const visibleTreePosts = useMemo(() => treePosts.filter((tp) => !blockedSet.has(tp.user_id)), [treePosts, blockedSet]);

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
      (entries) => { if (entries[0]?.isIntersecting) handleLoadMore(); },
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  const handleRefresh = useCallback(async () => {
    window.dispatchEvent(new Event('refresh-shorts'));
    await Promise.all([forceRefresh(), refetchStories(), refetchTrees()]);
  }, [forceRefresh, refetchStories, refetchTrees]);

  useEffect(() => {
    const onNavHome = (e: Event) => {
      const ce = e as CustomEvent<{ action?: 'scrollTop' | 'refresh'; }>;
      if (ce.detail?.action === 'refresh') {
        void handleRefresh();
        return;
      }
      const anchor = topAnchorRef.current;
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  return (
    <AppLayout showNav={!storyViewerOpen}>
      <div className="relative max-w-lg mx-auto min-h-[calc(100vh-4rem)]">
        <div ref={topAnchorRef} />
        
        <HomeHeader
          unreadCount={unreadCount}
          messageCount={messageCount}
          gridLayout={gridLayout}
          onToggleLayout={() => setGridLayout(prev => prev === 1 ? 2 : 1)}
          onSearchSubmit={(q) => { setSearchInitialQuery(q); setSearchOpen(true); }}
          onSearchFocus={() => setSearchOpen(true)}
          onNotificationsClick={() => setNotificationsOpen(true)}
          onStoryClick={openStoryViewer}
        />

        {SHOW_YOUTUBE && (
          <YouTubeShortsSection
            onShortClick={openShortsViewer}
            onShortsChange={setCachedShorts}
            onSearchSubmit={setSearchInitialQuery}
            onSearchClick={() => setSearchOpen(true)} 
          />
        )}
        
        <PullToRefresh onRefresh={handleRefresh} useWindowScroll={true}>
          {visiblePosts.length === 0 && visibleTreePosts.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t('noPostsYet')}</p>
              <p className="text-sm text-muted-foreground mt-2">{t('createFirstPost')}</p>
            </div>
          ) : gridLayout === 1 ? (
            <FeedListLayout
              posts={visiblePosts}
              treePosts={visibleTreePosts}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              isInitialLoading={isLoading}
              t={t}
              scrollContainerRef={scrollContainerRef}
              loadMoreSentinelRef={loadMoreSentinelRef}
              openPostViewer={openPostViewer}
            />
          ) : (
            <FeedGridLayout 
              posts={visiblePosts}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore}
              t={t}
              scrollContainerRef={scrollContainerRef}
              loadMoreSentinelRef={loadMoreSentinelRef}
              openPostViewer={openPostViewer}
            />
          )}
        </PullToRefresh>

        {viewerOpen && (
          <UnifiedFullScreenViewer
            posts={visiblePosts}
            shorts={cachedShorts}
            initialTab={viewerTab}
            initialIndex={viewerInitialIndex}
            onClose={() => setViewerOpen(false)} 
          />
        )}

        {storyViewerOpen && storyGroups.length > 0 && (
          <StoryViewer
            storyGroups={storyGroups}
            initialGroupIndex={storyGroupIndex}
            onClose={() => setStoryViewerOpen(false)}
            onDeleted={() => refetchStories()} 
          />
        )}

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
    </AppLayout>
  );
};

export default Home;