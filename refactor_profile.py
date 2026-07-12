import re

# Refactor Profile.tsx
with open(r'c:\Users\otabek\Desktop\avlodona\src\pages\Profile.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add imports
if 'useInfiniteScroll' not in content:
    content = content.replace("import { useSmoothScroll } from '@/hooks/useSmoothScroll';", "import { useSmoothScroll } from '@/hooks/useSmoothScroll';\nimport { useInfiniteScroll } from '@/hooks/useInfiniteScroll';")

# Ensure memo is imported
if ' memo ' not in content:
    content = content.replace("import { useCallback, useEffect, useMemo, useRef, useState } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';")

# 2. Add Wrapper Components before Profile
wrappers = """
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

"""

if 'ProfilePostItemWrapper' not in content:
    content = content.replace("const Profile = () => {", wrappers + "const Profile = () => {")

# 3. Add useInfiniteScroll call inside Profile
if 'const loadMoreSentinelRef' not in content:
    content = content.replace("const { posts, isLoading, postsCount, refetch, removePost } = useUserPosts(user?.id);", "const { posts, isLoading, postsCount, refetch, removePost, hasMore, loadMore, isLoadingMore } = useUserPosts(user?.id);\n  const loadMoreSentinelRef = useInfiniteScroll(loadMore, hasMore || false, isLoadingMore || false);")

# 4. Replace list maps
# Posts List Layout
old_list = """                {filteredPosts.map((post, index) =>
              <div
                key={post.id}
                onClick={() => openViewer(index, filteredPosts)}
                className="cursor-pointer">
                
                    <PostCard post={post} onDelete={() => removePost(post.id)} />
                  </div>
              )}"""
new_list = """                {filteredPosts.map((post, index) => (
                  <ProfilePostItemWrapper key={post.id} post={post} index={index} postsList={filteredPosts} openViewer={openViewer} removePost={removePost} />
                ))}"""
content = content.replace(old_list, new_list)

# Posts Pinterest Layout (single col)
old_pin1 = """                  {filteredPosts.map((post, idx) =>
                <div
                  key={post.id}
                  onClick={() => openViewer(idx, filteredPosts)}
                  className="cursor-pointer">
                  
                      <ProfileMasonryItem post={post} />
                    </div>
                )}"""
new_pin1 = """                  {filteredPosts.map((post, idx) => (
                    <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />
                  ))}"""
content = content.replace(old_pin1, new_pin1)

# Posts Pinterest Layout (two col)
old_pin2_0 = """                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })"""
new_pin2_0 = """                  filter((_, i) => i % 2 === 0).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
                  })"""
content = content.replace(old_pin2_0, new_pin2_0)

old_pin2_1 = """                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return (
                      <div
                        key={post.id}
                        onClick={() => openViewer(idx, filteredPosts)}
                        className="cursor-pointer">
                        
                            <ProfileMasonryItem post={post} />
                          </div>);

                  })"""
new_pin2_1 = """                  filter((_, i) => i % 2 === 1).
                  map((post) => {
                    const idx = filteredPosts.findIndex((p) => p.id === post.id);
                    return <ProfileMasonryItemWrapper key={post.id} post={post} index={idx} postsList={filteredPosts} openViewer={openViewer} />;
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

with open(r'c:\Users\otabek\Desktop\avlodona\src\pages\Profile.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Profile.tsx refactored.")
