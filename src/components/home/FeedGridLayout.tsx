import { RefObject } from "react";
import { MasonryItem } from "./MasonryItem";
import { EndOfFeed } from "@/components/feed/EndOfFeed";
import { Post } from "@/types";

interface FeedGridLayoutProps {
  posts: Post[];
  isLoadingMore: boolean;
  hasMore: boolean;
  t: (key: string) => string;
  scrollContainerRef: RefObject<HTMLDivElement>;
  loadMoreSentinelRef: RefObject<HTMLDivElement>;
  openPostViewer: (index: number) => void;
}

export const FeedGridLayout = ({
  posts,
  isLoadingMore,
  hasMore,
  t,
  scrollContainerRef,
  loadMoreSentinelRef,
  openPostViewer
}: FeedGridLayoutProps) => {
  const leftColPosts = posts.filter((_, i) => i % 2 === 0);
  const rightColPosts = posts.filter((_, i) => i % 2 === 1);

  return (
    <div ref={scrollContainerRef} className="smooth-scroll-container pb-20 px-px">
      <div className="flex p-1 gap-px">
        <div className="flex-1 flex flex-col gap-1">
          {leftColPosts.map((post) => {
            const idx = posts.findIndex((p) => p.id === post.id);
            return (
              <MasonryItem 
                key={post.id} 
                post={post} 
                index={idx} 
                onClick={() => openPostViewer(idx)} 
              />
            );
          })}
        </div>
        <div className="flex-1 flex flex-col gap-1">
          {rightColPosts.map((post) => {
            const idx = posts.findIndex((p) => p.id === post.id);
            return (
              <MasonryItem 
                key={post.id} 
                post={post} 
                index={idx} 
                onClick={() => openPostViewer(idx)} 
              />
            );
          })}
        </div>
      </div>
      <div ref={loadMoreSentinelRef} className="h-4 min-h-4" aria-hidden />
      {isLoadingMore && <div className="text-center py-4 text-muted-foreground text-sm">{t('loading')}</div>}
      {!hasMore && posts.length > 0 && <EndOfFeed />}
    </div>
  );
};
