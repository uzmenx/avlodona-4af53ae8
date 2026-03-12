import { RefObject } from "react";
import { Virtuoso } from "react-virtuoso";
import { TreePostCard } from "@/components/feed/TreePostCard";
import { PostCard } from "@/components/feed/PostCard";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { Post } from "@/types";
import { FeedTreePost } from "@/hooks/useTreeFeed";

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
  // Combine tree posts and regular posts for virtuoso if needed, 
  // but for now let's keep the structure similar to original Home.tsx
  // We'll use Virtuoso for the main posts list.
  
  return (
    <div ref={scrollContainerRef} className="space-y-3 pb-20 px-[5px]">
      {/* Tree posts from community - kept static as they are usually few at top */}
      {treePosts.map((tp, i) => (
        <div key={`tree-${tp.id}`}>
          <TreePostCard post={tp} author={tp.author} index={i} />
        </div>
      ))}
      
      {/* Main posts with Virtuoso for performance */}
      <Virtuoso
        useWindowScroll
        data={posts}
        itemContent={(index, post) => (
          <div className="mb-3">
            <PostCard 
              post={post} 
              onMediaClick={() => openPostViewer(index)} 
              index={index} 
            />
          </div>
        )}
      />

      <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
      {isLoadingMore && <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>}
      {!hasMore && posts.length > 0 && <EndOfFeed />}
    </div>
  );
};
