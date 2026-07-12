import re

with open(r'c:\Users\otabek\Desktop\avlodona\src\pages\UserProfile.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
if 'useInfiniteScroll' not in content:
    content = content.replace("import { useSmoothScroll } from '@/hooks/useSmoothScroll';", "import { useSmoothScroll } from '@/hooks/useSmoothScroll';\nimport { useInfiniteScroll } from '@/hooks/useInfiniteScroll';")

if ' memo ' not in content:
    content = content.replace("import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';", "import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, memo } from 'react';")

# 2. Add Wrapper Components before UserProfile
wrappers = """
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

"""

if 'UserProfilePostItemWrapper' not in content:
    content = content.replace("const UserProfile = () => {", wrappers + "const UserProfile = () => {")

# 3. Add useInfiniteScroll call inside UserProfile
if 'const loadMoreSentinelRef' not in content:
    content = content.replace("const { posts, isLoading: postsLoading, postsCount, refetch } = useUserPosts(effectivePostsUserId, isMemorial);", "const { posts, isLoading: postsLoading, postsCount, refetch, hasMore, loadMore, isLoadingMore } = useUserPosts(effectivePostsUserId, isMemorial);\n  const loadMoreSentinelRef = useInfiniteScroll(loadMore, hasMore || false, isLoadingMore || false);")

# 4. Replace list maps
# Posts List Layout
old_list = """                {filteredPosts.map((post, index) =>
              <div key={post.id}>
                    <PostCard post={post} onMediaClick={() => openViewer(filteredPosts, index)} />
                  </div>
            )}"""
new_list = """                {filteredPosts.map((post, index) => (
                  <UserProfilePostItemWrapper key={post.id} post={post} index={index} postsList={filteredPosts} openViewer={openViewer} />
                ))}"""
content = content.replace(old_list, new_list)

# Posts Pinterest Layout (single col)
old_pin1 = """                  {filteredPosts.map((post, idx) =>
                <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                      <UserProfileMasonryItem post={post} />
                    </div>
              )}"""
new_pin1 = """                  {filteredPosts.map((post, idx) => (
                    <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />
                  ))}"""
content = content.replace(old_pin1, new_pin1)

# Posts Pinterest Layout (two col)
old_pin2_0 = """                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>);

                  })"""
new_pin2_0 = """                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })"""
content = content.replace(old_pin2_0, new_pin2_0)

old_pin2_1 = """                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div key={post.id} onClick={() => openViewer(filteredPosts, idx)} className="cursor-pointer">
                            <UserProfileMasonryItem post={post} />
                          </div>);

                  })"""
new_pin2_1 = """                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <UserProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })"""
content = content.replace(old_pin2_1, new_pin2_1)

# Add sentinel div
if '<div ref={loadMoreSentinelRef} className="h-4 w-full" />' not in content:
    old_end = """                    <span style={{ fontSize: 20 }}>✦</span>
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
                )}"""
    new_end = """                    <span style={{ fontSize: 20 }}>✦</span>
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
                <div ref={loadMoreSentinelRef} className="h-4 w-full" />"""
    content = content.replace(old_end, new_end)


# Skip GIF rendering on low-perf
old_gif = """      {/* Live animated GIF overlays for grid preview */}
      {(() => {
        if (isVideo) return null;
        // In the grid we only show GIFs for the first media item
        const overlays = post.media_metadata?.[0]?.gifOverlays;"""
new_gif = """      {/* Live animated GIF overlays for grid preview */}
      {(() => {
        if (isVideo) return null;
        if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-perf') === 'low') return null;
        // In the grid we only show GIFs for the first media item
        const overlays = post.media_metadata?.[0]?.gifOverlays;"""
content = content.replace(old_gif, new_gif)

with open(r'c:\Users\otabek\Desktop\avlodona\src\pages\UserProfile.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("UserProfile.tsx refactored.")
