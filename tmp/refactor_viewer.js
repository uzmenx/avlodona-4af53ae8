const fs = require('fs');
const file = 'src/components/feed/UnifiedFullScreenViewer.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the top container to add scroll-snap and remove gesture handlers
content = content.replace(
  /className="fixed inset-0 z-\[60\] flex flex-col overflow-hidden touch-none"([\s\S]*?)onMouseDown={handleMouseDown}[\s\S]*?onTouchEnd=\{\(e\) => \{[\s\S]*?\}\}>/,
  `className="fixed inset-0 z-[60] flex flex-col overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth touch-pan-y"
        style={{
          backgroundColor: '#000',
          ...bgStyle
        }}
        onScroll={(e) => {
          const target = e.target;
          const index = Math.round(target.scrollTop / target.clientHeight);
          if (activeTab === 'posts' && index !== postIndex && index >= 0 && index < posts.length) {
            setPostIndex(index);
          } else if (activeTab === 'shorts' && index !== shortIndex && index >= 0 && index < shorts.length) {
            setShortIndex(index);
          }
        }}>`
);

// 2. Fix ambient video so it doesn't scroll away (make it fixed)
content = content.replace(
  /<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">/g,
  `<div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">`
);

// Fix dominant color background so it doesn't scroll away
content = content.replace(
  /<div className="absolute inset-0 z-0" style=\{\{/g,
  `<div className="fixed inset-0 z-0" style={{`
);

// 3. Keep the top bar fixed
content = content.replace(
  /<div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between /g,
  `<div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between `
);

// 4. Modify renderShort to accept current items
content = content.replace(
  /const renderShort = \(\) => \{/g,
  `const renderShort = (currentShort: Short, isCurrentInner: boolean, shortIdx: number) => {`
);

// 5. Modify renderPost to accept current items
content = content.replace(
  /const renderPost = \(\) => \{/g,
  `const renderPost = (currentPost: Post, isCurrentInner: boolean, postIdx: number) => {`
);

// Replace slide animations in renderPost and renderShort with snap-start class
content = content.replace(
  /className=\{cn\([\s\S]*?"flex-1 flex items-center justify-center relative overflow-hidden z-\[1\] transition-all duration-300 ease-out",[\s\S]*?slideDirection === 'down' && "animate-slide-out-up",[\s\S]*?slideDirection === 'up' && "animate-slide-out-down",[\s\S]*?!slideDirection && "animate-slide-in"[\s\S]*?\)\}/g,
  `className="w-full h-[100dvh] shrink-0 snap-start snap-always border-b-[2px] border-white flex-1 flex flex-col items-center justify-center relative overflow-hidden z-[1]"`
);

content = content.replace(
  /className=\{cn\([\s\S]*?"flex-1 flex items-center justify-center relative overflow-hidden z-\[1\] transition-all duration-200 ease-out",[\s\S]*?slideDirection === 'down' && "animate-slide-out-up",[\s\S]*?slideDirection === 'up' && "animate-slide-out-down",[\s\S]*?!slideDirection && "animate-slide-in"[\s\S]*?\)\}/g,
  `className="w-full h-[100dvh] shrink-0 snap-start snap-always border-b-[2px] border-white flex-1 flex flex-col items-center justify-center relative overflow-hidden z-[1]"`
);


// Rewrite the mapped array logic
content = content.replace(
  /\{activeTab === 'shorts' \? renderShort\(\) : renderPost\(\)\}/g,
  `{activeTab === 'shorts' ? (
           shorts.map((s, i) => renderShort(s, i === shortIndex, i))
        ) : (
           posts.map((p, i) => renderPost(p, i === postIndex, i))
        )}`
);

// We must handle videoRef and audioRef inside renderPost mapping
content = content.replace(
  /ref=\{videoRef\}/g,
  `ref={isCurrentInner ? videoRef : undefined}`
);
content = content.replace(
  /ref=\{audioRef\}/g,
  `ref={isCurrentInner ? audioRef : undefined}`
);
content = content.replace(
  /autoPlay \/>/g,
  `autoPlay={isCurrentInner} muted={!isCurrentInner} />`
);

// Update renderShort internal uses
content = content.replace(
  /const isCurrent = idx === shortIndex;/g,
  `const isCurrentLocal = idx === shortIndex;`
);

content = content.replace(
  /ref=\{isCurrent \? shortsIframeRef : undefined\}/g,
  `ref={isCurrentLocal && isCurrentInner ? shortsIframeRef : undefined}`
);

content = content.replace(
  /isCurrent \? '1' : '0'/g,
  `(isCurrentLocal && isCurrentInner) ? '1' : '0'`
);

content = content.replace(
  /onLoad=\{isCurrent \? \(\) => setIsShortIframeReady\(true\) : undefined\}/g,
  `onLoad={(isCurrentLocal && isCurrentInner) ? () => setIsShortIframeReady(true) : undefined}`
);

// Overwrite mediaUrls calculation
content = content.replace(
  /const renderPost = \(currentPost: Post, isCurrentInner: boolean, postIdx: number\) => \{\n\s*if \(!currentPost\) return null;/g,
  `const renderPost = (currentPost: Post, isCurrentInner: boolean, postIdx: number) => {
    if (!currentPost) return null;
    const mediaUrls = currentPost?.media_urls || (currentPost?.image_url ? [currentPost.image_url] : []);
    const currentMediaUrl = isCurrentInner ? mediaUrls[currentMediaIndex] : mediaUrls[0];
`
);

fs.writeFileSync(file, content);
console.log('Patch complete.');
