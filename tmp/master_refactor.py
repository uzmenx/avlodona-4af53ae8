import os
import re

file_path = r'c:\Users\otabek\Desktop\avlodona\src\components\feed\UnifiedFullScreenViewer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove isTransitioning and slideDirection from all function bodies
# (especially useEffect dependency arrays and logic)
content = content.replace(" if (isTransitioning) return;", "")
content = content.replace("if (isTransitioning) return;", "")
content = content.replace(", isTransitioning", "")
content = content.replace("isTransitioning,", "")
content = content.replace(" slideDirection,", "")
content = content.replace(", slideDirection", "")

# 2. Refactor renderShort: Remove animation classes and internal swipe logic
# We'll replace the block from `const renderShort = () => {` to `};`
render_short_pattern = re.compile(r'const renderShort = \(\) => \{(.*?)};', re.DOTALL)
new_render_short = """const renderShort = () => {
    if (!shorts[shortIndex]) return null;
    const currentShort = shorts[shortIndex];

    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden z-[1]" key={currentShort.id} onClick={handleShortsTap}>
        <div className="relative w-full h-full">
          {!isShortIframeReady && (
            <>
              <img src={currentShort.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover z-[1]" />
              <div className="absolute inset-0 z-[2] bg-black/35" />
              <div className="absolute inset-0 z-[2] flex items-center justify-center">
                <div className="p-4 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
                  <Loader2 className="h-7 w-7 text-white animate-spin" />
                </div>
              </div>
            </>
          )}

          <iframe
            key={currentShort.id}
            ref={shortsIframeRef}
            src={`https://www.youtube.com/embed/${currentShort.id}?rel=0&autoplay=1&controls=0&modestbranding=1&playsinline=1&loop=1&playlist=${currentShort.id}&iv_load_policy=3&fs=0&enablejsapi=1&origin=${encodeURIComponent(ytOrigin)}`}
            className={cn("absolute inset-0 w-full h-full transition-opacity duration-150", isShortIframeReady ? "opacity-100 z-[2]" : "opacity-0 z-[1]")}
            onLoad={() => setIsShortIframeReady(true)}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={currentShort.title}
          />
        </div>

        <div className={cn("absolute inset-0 z-[4] flex items-center justify-center pointer-events-none transition-opacity duration-300", showPlayIndicator ? "opacity-100" : "opacity-0")}>
          <div className="p-4 rounded-full bg-black/35 backdrop-blur-sm border border-white/10">
            {shortsPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 text-white" />}
          </div>
        </div>

        <div className="absolute bottom-16 left-0 right-16 px-4 pb-4 pt-16 z-[5] pointer-events-none text-white shadow-xl">
           <p className="text-[13px] font-medium leading-snug line-clamp-2 drop-shadow-sm">{currentShort.title}</p>
           <p className=\"text-[11px] text-white/50 mt-1 uppercase font-semibold tracking-wider\">{currentShort.channelTitle}</p>
        </div>

        <div className="absolute right-3 top-20 z-[6] flex flex-col gap-2">
          <a
            href={`https://www.youtube.com/shorts/${currentShort.id}`}
            target="_blank"
            rel="noreferrer"
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon icon=\"flat-color-icons:youtube\" className=\"w-5 h-5\" />
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); setShowShortShare(true); }}
            className="p-2.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 hover:bg-white/15 transition-colors"
          >
            <Send className="h-5 w-5 text-white" />
          </button>
        </div>

        <ShareDialog open={showShortShare} onOpenChange={setShowShortShare} shortId={currentShort.id} />
      </div>
    );
  };"""

# 3. Refactor renderPost: Remove animation classes and internal swipe logic
render_post_pattern = re.compile(r'const renderPost = \(\) => \{(.*?)};', re.DOTALL)
new_render_post = """const renderPost = () => {
    if (!posts[postIndex]) return null;
    const currentPost = posts[postIndex];
    const currentMediaUrl = currentPost.media_urls?.[currentMediaIndex] || currentPost.image_url;

    return (
      <div className="flex-1 flex items-center justify-center relative overflow-hidden z-[1]" key={currentPost.id} onClick={handleMediaClick}>
        {isVideo(currentMediaUrl) ? (
          <>
            <video ref={videoRef} src={currentMediaUrl} className="max-w-full max-h-full object-contain" loop playsInline autoPlay />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="p-4 rounded-full bg-black/30 backdrop-blur-sm">
                  <Play className="h-8 w-8 text-white" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img src={currentMediaUrl} alt="" className="max-w-full max-h-full object-contain" />
        )}

        {showDoubleTapHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
             <Heart className={cn("h-28 w-28 text-[#ff2d55] fill-[#ff2d55] drop-shadow-2xl animate-heartBurst")} />
          </div>
        )}

        {currentPost.audio_url && (
           <div className=\"absolute bottom-8 right-6 z-30\" onClick={(e) => e.stopPropagation()}>
               <MusicOverlay audioTitle={currentPost.audio_title} audioArtist={currentPost.audio_artist} isPlaying={isAudioPlaying} isSaved={isSaved(currentPost.audio_url)} onTogglePlay={toggleAudio} />
           </div>
        )}

        {mediaUrls.length > 1 && (
           <div className=\"absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5\">
              {mediaUrls.map((_, i) => (
                 <div key={i} className={cn(\"w-1.5 h-1.5 rounded-full\", currentMediaIndex === i ? \"bg-white\" : \"bg-white/30\")} />
              ))}
           </div>
        )}

        <div className="absolute right-3 bottom-32 z-[2]">
          <FullscreenActions
            postId={currentPost.id}
            initialLikesCount={currentPost.likes_count}
            initialCommentsCount={currentPost.comments_count}
            initialViewsCount={currentPost.views_count ?? 0}
            videoUrl={isVideo(currentMediaUrl) ? currentMediaUrl : undefined}
            onOpenVideoPlayer={(url) => { setVideoPlayerSrc(url); setShowVideoPlayer(true); }}
          />
        </div>

        <div className="absolute bottom-16 left-0 right-14 p-4 z-[1]">
          <div className=\"flex items-center mb-2 gap-2\">
            <UserAvatar userId={currentPost.user_id} className=\"border-2 border-white/20\" />
            <div>
               <p className=\"text-white font-semibold text-sm\">{currentPost.author?.full_name}</p>
               <p className=\"text-white/70 text-xs\">@{currentPost.author?.username}</p>
            </div>
            <FollowButton targetUserId={currentPost.user_id} className=\"ml-2\" />
          </div>
          <PostCaption content={currentPost.content} />
        </div>
      </div>
    );
  };"""

# 4. Refactor main return statement
return_pattern = re.compile(r'  return \(\s*<>\s*<div\s*ref=\{containerRef\}(.*?)    </>\);', re.DOTALL)
new_return = """  return (
    <>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[60] flex flex-col bg-black overflow-hidden"
      >
        {/* Ambient Background */}
        {ambientUrl &&
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
              {activeTab === 'posts' && isVideo(ambientUrl) ?
            <video
              key={ambientUrl}
              ref={ambientVideoRef}
              src={ambientUrl}
              className="absolute inset-0 w-full h-full object-cover opacity-70 blur-[20px]"
              muted playsInline autoPlay loop /> :
            <img
              key={ambientUrl}
              src={ambientUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-70 blur-[20px]" />
            }
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>
        }

        {/* Top bar */}
        <div className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between px-3 pt-[env(safe-area-inset-top,10px)] pb-2 bg-gradient-to-b from-black/60 to-transparent">
          <button onClick={handleClose} className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex gap-1 bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/10">
            <button
              onClick={() => handleTabSwitch('shorts')}
              className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", activeTab === 'shorts' ? "bg-white text-black" : "text-white/60 hover:text-white")}
            >
              YT Shorts
            </button>
            <button
              onClick={() => handleTabSwitch('posts')}
              className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all", activeTab === 'posts' ? "bg-white text-black" : "text-white/60 hover:text-white")}
            >
              Postlar
            </button>
          </div>

          <div className="w-9" />
        </div>

        {/* Scroll Feed */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar relative z-50 pt-[calc(44px+env(safe-area-inset-top,0px))]"
        >
          {activeTab === 'posts' ? (
            posts.map((post, i) => (
              <div key={post.id} className="h-[100dvh] w-full snap-start snap-always border-b-2 border-white/20 relative overflow-hidden">
                {Math.abs(postIndex - i) <= 1 ? renderPost() : <div className=\"w-full h-full bg-black/20\" />}
              </div>
            ))
          ) : (
            shorts.map((short, i) => (
              <div key={short.id} className="h-[100dvh] w-full snap-start snap-always border-b-2 border-white/20 relative overflow-hidden">
                {Math.abs(shortIndex - i) <= 1 ? renderShort() : <div className=\"w-full h-full bg-black/20\" />}
              </div>
            ))
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[80] bg-black">
          <SamsungUltraVideoPlayer src={videoPlayerSrc} onClose={() => setShowVideoPlayer(false)} startInFullscreen={true} />
        </div>,
        document.body
      )}

      {storyViewerOpen && storyViewerGroups.length > 0 &&
      <StoryViewer storyGroups={storyViewerGroups} initialGroupIndex={0} onClose={() => setStoryViewerOpen(false)} />
      }
    </>);"""

# Find full block to replace
start_idx = content.find("  return (")
# Find index of last `</>);`
end_idx = content.rfind("    </>);") + 9

if start_idx != -1 and end_idx != -1:
   # Apply regex replacements for functions
   content = re.sub(r'const renderShort = \(\) => \{.*? };\n\n  // ─── RENDER: Posts tab ───', new_render_short + "\\n\\n  // ─── RENDER: Posts tab ───", content, flags=re.DOTALL)
   content = re.sub(r'const renderPost = \(\) => \{.*? };\n\n  useEffect', new_render_post + "\\n\\n  useEffect", content, flags=re.DOTALL)
   
   # Apply main return replacement
   final_content = content[:start_idx] + new_return + content[end_idx:]
   
   with open(file_path, 'w', encoding='utf-8') as f:
       f.write(final_content)
   print("Successfully Master Refactored")
else:
   print(f"Could not find return block. start={start_idx}, end={end_idx}")
