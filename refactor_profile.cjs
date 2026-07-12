const fs = require('fs');

function refactorProfile() {
    let content = fs.readFileSync('src/pages/Profile.tsx', 'utf-8');

    if (!content.includes('useInfiniteScroll')) {
        content = content.replace("import { useSmoothScroll } from '@/hooks/useSmoothScroll';", "import { useSmoothScroll } from '@/hooks/useSmoothScroll';\nimport { useInfiniteScroll } from '@/hooks/useInfiniteScroll';");
    }

    if (!content.includes(' memo ')) {
        content = content.replace("import { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';");
    }

    const wrappers = `
const ProfilePostItemWrapper = memo(({ post, index, postsList, openViewer, removePost }: { post: any; index: number; postsList: any[]; openViewer: (i: number, p: any[]) => void; removePost: (id: string) => void }) => {
  const handleMediaClick = useCallback(() => openViewer(index, postsList), [index, postsList, openViewer]);
  const handleDelete = useCallback(() => removePost(post.id), [post.id, removePost]);
  return (
    <div className="cursor-pointer">
      <PostCard post={post} onDelete={handleDelete} onMediaClick={handleMediaClick} />
    </div>
  );
});

const ProfileMasonryItemWrapper = memo(({ post, index, postsList, openViewer }: { post: any; index: number; postsList: any[]; openViewer: (i: number, p: any[]) => void }) => {
  const handleMediaClick = useCallback(() => openViewer(index, postsList), [index, postsList, openViewer]);
  return (
    <div onClick={handleMediaClick} className="cursor-pointer">
      <ProfileMasonryItem post={post} />
    </div>
  );
});

`;
    if (!content.includes('ProfilePostItemWrapper')) {
        content = content.replace("const Profile = () => {", wrappers + "const Profile = () => {");
    }

    if (!content.includes('const loadMoreSentinelRef')) {
        content = content.replace("const { posts, isLoading, postsCount, refetch, removePost } = useUserPosts(user?.id);", "const { posts, isLoading, postsCount, refetch, removePost, hasMore, loadMore, isLoadingMore } = useUserPosts(user?.id);\n  const loadMoreSentinelRef = useInfiniteScroll(loadMore, hasMore || false, isLoadingMore || false);");
    }

    const old_list = `                {filteredPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, filteredPosts)}
                className="cursor-pointer">
                
                    <PostCard post={post} onDelete={() => removePost(post.id)} />
                  </div>
              )}`;
    const new_list = `                {filteredPosts.map((post, index) => (
                  <ProfilePostItemWrapper key={post.id} post={post} index={index} postsList={filteredPosts} openViewer={openViewer} removePost={removePost} />
                ))}`;
    content = content.replace(old_list, new_list);

    const old_pin1 = `                  {filteredPosts.map((post, idx) =>
                <div
                  key={post.id}
                  onClick={() => openViewer(idx, filteredPosts)}
                  className="cursor-pointer">
                  
                      <ProfileMasonryItem post={post} />
                    </div>
                )}`;
    const new_pin1 = `                  {filteredPosts.map((post, idx) => (
                    <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />
                  ))}`;
    content = content.replace(old_pin1, new_pin1);

    const old_pin2_0 = `                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })`;
    const new_pin2_0 = `                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })`;
    content = content.replace(old_pin2_0, new_pin2_0);

    const old_pin2_1 = `                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })`;
    const new_pin2_1 = `                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
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

    fs.writeFileSync('src/pages/Profile.tsx', content, 'utf-8');
    console.log("Profile.tsx refactored.");
}

refactorProfile();
