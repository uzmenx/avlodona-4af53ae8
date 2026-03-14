import { RefObject, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { TreePostCard } from "@/components/feed/TreePostCard";
import { PostCard } from "@/components/feed/PostCard";
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
  t,
  scrollContainerRef,
  loadMoreSentinelRef,
  openPostViewer
}: FeedListLayoutProps) => {
  // Merge tree posts and regular posts into one list sorted by created_at desc
  const unified = useMemo(() => {
    const items: FeedItem[] = [
      ...posts.map((p): FeedItem => ({ kind: 'post', data: p, created_at: p.created_at })),
      ...treePosts.map((tp): FeedItem => ({ kind: 'tree', data: tp, created_at: tp.created_at })),
    ];
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [posts, treePosts]);

  // Build a mapping from unified index to the original posts-only index
  // (needed so openPostViewer receives the correct index into the posts array)
  const postIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let postIdx = 0;
    // posts are sorted by created_at desc already, same order as in the unified list
    // We need to iterate unified and track the original post index
    const postOrder = posts.map(p => p.id);
    const postIdToIdx = new Map(postOrder.map((id, i) => [id, i]));
    unified.forEach((item, i) => {
      if (item.kind === 'post') {
        map.set(i, postIdToIdx.get((item.data as Post).id) ?? 0);
      }
    });
    return map;
  }, [unified, posts]);

  return (
    <div ref={scrollContainerRef} className="space-y-3 pb-20 px-[5px]">
      <Virtuoso
        useWindowScroll
        data={unified}
        itemContent={(index, item) => (
          <div className="mb-3">
            {item.kind === 'tree' ? (
              <TreePostCard
                post={item.data as FeedTreePost}
                author={(item.data as FeedTreePost).author}
                index={index}
              />
            ) : (
              <PostCard
                post={item.data as Post}
                onMediaClick={() => openPostViewer(postIndexMap.get(index) ?? 0)}
                index={index}
              />
            )}
          </div>
        )}
      />

      <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
      {isLoadingMore && <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>}
      {!hasMore && posts.length > 0 && <EndOfFeed />}
    </div>
  );
};
