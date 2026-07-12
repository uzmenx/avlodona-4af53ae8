const fs = require('fs');

function refactorUserProfile() {
    let content = fs.readFileSync('src/pages/UserProfile.tsx', 'utf-8');

    if (!content.includes('useInfiniteScroll')) {
        content = content.replace("import { useSmoothScroll } from '@/hooks/useSmoothScroll';", "import { useSmoothScroll } from '@/hooks/useSmoothScroll';\nimport { useInfiniteScroll } from '@/hooks/useInfiniteScroll';");
    }

    if (!content.includes(' memo ')) {
        content = content.replace("import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';", "import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from 'react';");
    }

    const wrappers = `
const UserProfilePostItemWrapper = memo(({ post, index, postsList, openViewer }: { post: any; index: number; postsList: any[]; openViewer: (p: any[], i: number) => void }) => {
  const handleMediaClick = useCallback(() => openViewer(postsList, index), [index, postsList, openViewer]);
  return (
    <div className="cursor-pointer">
      <PostCard post={post} onMediaClick={handleMediaClick} />
    </div>
  );
});

const UserProfileMasonryItemWrapper = memo(({ post, index, postsList, openViewer }: { post: any; index: number; postsList: any[]; openViewer: (p: any[], i: number) => void }) => {
  const handleMediaClick = useCallback(() => openViewer(postsList, index), [index, postsList, openViewer]);
  return (
    <div onClick={handleMediaClick} className="cursor-pointer">
      <UserProfileMasonryItem post={post} />
    </div>
  );
});

`;
    if (!content.includes('UserProfilePostItemWrapper')) {
        content = content.replace("const UserProfile = () => {", wrappers + "const UserProfile = () => {");
    }

    if (!content.includes('const loadMoreSentinelRef')) {
        content = content.replace("const { posts, isLoading: postsLoading, postsCount, refetch } = useUserPosts(effectivePostsUserId, isMemorial);", "const { posts, isLoading: postsLoading, postsCount, refetch, hasMore, loadMore, isLoadingMore } = useUserPosts(effectivePostsUserId, isMemorial);\n  const loadMoreSentinelRef = useInfiniteScroll(loadMore, hasMore || false, isLoadingMore || false);");
    }

    const old_list = `                {filteredPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(filteredPosts, index)}
                className="cursor-pointer">
                
                    <PostCard post={post} onMediaClick={() => openViewer(filteredPosts, index)} />
                  </div>
              )}`;
    const new_list = `                {filteredPosts.map((post, index) => (
                  <UserProfilePostItemWrapper key={post.id} post={post} index={index} postsList={filteredPosts} openViewer={openViewer} />
                ))}`;
    content = content.replace(old_list, new_list);

    // Some versions might have different spacing, let's just do an aggressive replace for the list layout map block:
    // Actually, looking at grep, the map in UserProfile is:
    /*
                {filteredPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(filteredPosts, index)}
                className="cursor-pointer">
                
                    <PostCard post={post} onMediaClick={() => openViewer(filteredPosts, index)} />
                  </div>
              )}
    */

    const old_pin1 = `                  {filteredPosts.map((post, idx) =>
                <div
                  key={post.id}
                  onClick={() => openViewer(filteredPosts, idx)}
                  className="cursor-pointer">
                  
                      <UserProfileMasonryItem post={post} />
                    </div>
                )}`;
    const new_pin1 = `                  {filteredPosts.map((post, idx) => (
                    <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />
                  ))}`;
    content = content.replace(old_pin1, new_pin1);

    const old_pin2_0 = `                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(filteredPosts, idx)}
                        className="cursor-pointer">
                        
                            <UserProfileMasonryItem post={post} />
                          </div>);

                  })`;
    const new_pin2_0 = `                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })`;
    content = content.replace(old_pin2_0, new_pin2_0);

    const old_pin2_1 = `                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(filteredPosts, idx)}
                        className="cursor-pointer">
                        
                            <UserProfileMasonryItem post={post} />
                          </div>);

                  })`;
    const new_pin2_1 = `                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })`;
    content = content.replace(old_pin2_1, new_pin2_1);

    const old_end = `                    <span style={{ fontSize: 20 }}>✦</span>
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
                )}`;
    const new_end = `                    <span style={{ fontSize: 20 }}>✦</span>
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
                <div ref={loadMoreSentinelRef} className="h-4 w-full" />`;
    if (!content.includes('<div ref={loadMoreSentinelRef}')) {
        content = content.replace(old_end, new_end);
        content = content.replace(old_end, new_end);
        content = content.replace(old_end, new_end);
    }

    const old_gif = `      {/* Live animated GIF overlays for grid preview */}
      {(() => {
        if (isVideo) return null;
        // In the grid we only show GIFs for the first media item
        const overlays = post.media_metadata?.[0]?.gifOverlays;`;
    const new_gif = `      {/* Live animated GIF overlays for grid preview */}
      {(() => {
        if (isVideo) return null;
        if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-perf') === 'low') return null;
        // In the grid we only show GIFs for the first media item
        const overlays = post.media_metadata?.[0]?.gifOverlays;`;
    content = content.replace(old_gif, new_gif);

    fs.writeFileSync('src/pages/UserProfile.tsx', content, 'utf-8');
    console.log("UserProfile.tsx refactored.");
}

refactorUserProfile();
