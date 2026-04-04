import os
import re

file_path = r'c:\Users\otabek\Desktop\avlodona\src\components\feed\UnifiedFullScreenViewer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Broad cleanup of isTransitioning and slideDirection
content = content.replace(" if (isTransitioning) return;", "")
content = content.replace("if (isTransitioning) return;", "")
content = content.replace(", isTransitioning", "")
content = content.replace("isTransitioning,", "")
content = content.replace(" slideDirection,", "")
content = content.replace(", slideDirection", "")

# 2. Refactor main return (use RFIND to get the actual component return)
start_idx = content.rfind("  return (")
end_idx = content.rfind("    </>);") + 9

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
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'blur(16px) saturate(145%) brightness(0.92) contrast(1.05)',
                transform: 'scale(1.08)',
                opacity: 0.72
              }}
              muted
              playsInline
              autoPlay
              loop
              preload="metadata"
              controls={false}
              disablePictureInPicture /> :


            <img
              key={ambientUrl}
              src={ambientUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                filter: 'blur(16px) saturate(145%) brightness(0.92) contrast(1.05)',
                transform: 'scale(1.08)',
                opacity: 0.72
              }} />

            }

              <div className="absolute inset-0 bg-black/28" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" />
              <div
              className="absolute inset-[-10%]"
              style={{
                background:
                'radial-gradient(ellipse at center, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.38) 58%, rgba(0,0,0,0.72) 100%)'
              }} />
            
            </div>
          </div>
        }

        {activeTab === 'posts' && dominantColor &&
        <div className="fixed inset-0 z-0" style={{
          background: `radial-gradient(ellipse at center, transparent 0%, ${dominantColor} 70%)`,
          backdropFilter: 'blur(20px)'
        }} />
        }

        {/* Top bar with tabs */}
        <div className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-between px-3 pt-[env(safe-area-inset-top,10px)] pb-2 bg-gradient-to-b from-black/50 to-transparent">
          <button onClick={handleClose} className="p-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 my-0">
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex gap-0.5 bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10 py-[2px] my-[23px]">
            <button
              onClick={() => handleTabSwitch('shorts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'shorts' ? "bg-white/20 text-white shadow-sm" : "text-white/50 hover:text-white/70"
              )}>
              yt shorts
            </button>
            <button
              onClick={() => handleTabSwitch('posts')}
              className={cn(
                "px-3.5 py-1 rounded-full text-[11px] font-medium transition-all",
                activeTab === 'posts' ? "bg-white/20 text-white shadow-sm" : "text-white/50 hover:text-white/70"
              )}>
              postlar
            </button>
          </div>

          <div className="w-7" />
        </div>

        {/* Scrollable Feed */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar z-50 pt-[env(safe-area-inset-top,44px)]"
        >
          {activeTab === 'posts' ? (
            posts.map((post, i) => (
              <div key={post.id} className="h-[100dvh] w-full snap-start snap-always border-b-2 border-white relative overflow-hidden flex flex-col">
                {i === postIndex ? renderPost() : (
                  <div className="flex-1 flex items-center justify-center bg-black/20">
                    <img 
                      src={post.media_urls?.[0] || post.image_url} 
                      alt="" 
                      className=\"max-w-full max-h-full object-contain opacity-50 blur-sm\" 
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            shorts.map((short, i) => (
              <div key={short.id} className="h-[100dvh] w-full snap-start snap-always border-b-2 border-white relative overflow-hidden flex flex-col">
                {i === shortIndex ? renderShort() : (
                  <div className="flex-1 relative bg-black/20">
                    <img 
                      src={short.thumbnail} 
                      alt="" 
                      className=\"absolute inset-0 w-full h-full object-cover opacity-50 blur-sm\" 
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && showVideoPlayer && createPortal(
        <div className="fixed inset-0 z-[80] w-full h-full min-h-[100dvh] overflow-hidden bg-black" style={{ height: '100dvh' }}>
          <SamsungUltraVideoPlayer
            src={videoPlayerSrc}
            title={currentPost?.content?.slice(0, 50) || 'Video'}
            onClose={() => setShowVideoPlayer(false)}
            startInFullscreen={true}
          />

        </div>,
        document.body
      )}

      {storyViewerOpen && storyViewerGroups.length > 0 &&
      <StoryViewer
        storyGroups={storyViewerGroups}
        initialGroupIndex={0}
        onClose={() => setStoryViewerOpen(false)} />

      }
    </>);"""

if start_idx != -1 and end_idx != -1:
    final_content = content[:start_idx] + new_return + content[end_idx:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    print("Successfully Refactored Return Statement")
else:
    print(f"FAILED: start={start_idx}, end={end_idx}")
    
# Manual Animation Strip in render functions (Surgical replaces)
# (Done via string replace to avoid large regex)
# ... actually I'll do those via replace_file_content in the next turn to be safer.
