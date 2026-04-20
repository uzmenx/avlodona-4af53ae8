import { RefObject, useMemo } from "react";
import { TreePostCard } from "@/components/feed/TreePostCard";
import { PostCard } from "@/components/feed/PostCard";
import { PostCardSkeleton } from "@/components/feed/PostCardSkeleton";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { Post } from "@/types";
import { FeedTreePost } from "@/hooks/useTreeFeed";

type FeedItem =
  | { kind: 'post'; data: Post; created_at: string }
  | { kind: 'tree'; data: FeedTreePost; created_at: string };

interface FeedListLayoutProps {
  posts: Post[];
  treePosts: FeedTreePost[];
  isLoadingMore: boolean;
  hasMore: boolean;
  isInitialLoading?: boolean;
  t: (key: string) => string;
  scrollContainerRef: RefObject<HTMLDivElement>;
  loadMoreSentinelRef: RefObject<HTMLDivElement>;
  openPostViewer: (index: number) => void;
}

export const FeedListLayout = ({
  posts,
  treePosts,
  isLoadingMore,
  hasMore,
  isInitialLoading,
  t,
  scrollContainerRef,
  loadMoreSentinelRef,
  openPostViewer,
}: FeedListLayoutProps) => {
  const unified = useMemo(() => {
    const items: FeedItem[] = [
      ...posts.map((p): FeedItem => ({ kind: 'post', data: p, created_at: p.created_at })),
      ...treePosts.map((tp): FeedItem => ({ kind: 'tree', data: tp, created_at: tp.created_at })),
    ];
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [posts, treePosts]);

  const postIdToIdx = useMemo(
    () => new Map(posts.map((p, i) => [p.id, i])),
    [posts]
  );

  return (
    <div ref={scrollContainerRef} className="space-y-3 pb-20 px-[5px]">
      {isInitialLoading && unified.length === 0 && <PostCardSkeleton count={4} />}

      {unified.map((item, index) => (
        <div key={`${item.kind}-${(item.data as { id: string }).id}`} className="mb-3">
          {item.kind === 'tree' ? (
            <TreePostCard
              post={item.data as FeedTreePost}
              author={(item.data as FeedTreePost).author}
              index={index}
            />
          ) : (
            <PostCard
              post={item.data as Post}
              onMediaClick={() =>
                openPostViewer(postIdToIdx.get((item.data as Post).id) ?? 0)
              }
              index={index}
            />
          )}
        </div>
      ))}

      <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
      {isLoadingMore && (
        <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>
      )}
      {!hasMore && posts.length > 0 && <EndOfFeed />}
    </div>
  );
};
