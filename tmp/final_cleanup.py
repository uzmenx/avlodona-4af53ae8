import os
import re

file_path = r'c:\Users\otabek\Desktop\avlodona\src\components\feed\UnifiedFullScreenViewer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Redefine smoothNavigate to use native container scrolling
smooth_nav_pattern = re.compile(r'const smoothNavigate = useCallback\(\(direction: \'up\' \| \'down\'\) => \{.*?\}, \[ activeTab, postIndex, shortIndex, posts\.length, shorts\.length\]\);', re.DOTALL)
new_smooth_nav = """const smoothNavigate = useCallback((direction: 'up' | 'down') => {
    if (scrollContainerRef.current) {
      const h = scrollContainerRef.current.clientHeight;
      if (h === 0) return;
      const targetScroll = (direction === 'down' ? 1 : -1) * h;
      scrollContainerRef.current.scrollBy({ top: targetScroll, behavior: 'smooth' });
    }
  }, []);"""

content = re.sub(smooth_nav_pattern, new_smooth_nav, content)

# 2. Cleanup renderShort touch/wheel logic (Surgical search and destroy)
# (Actually, I previously missed chunks because of spacing. I'll just remove isTransitioning logic)
content = content.replace("setIsTransitioning(true);", "")
content = content.replace("setSlideDirection(direction);", "")
content = content.replace("setSlideDirection(null);", "")
content = content.replace("setIsTransitioning(false);", "")

# 3. Last check for isScrolling useEffect which uses isTransitioning
content = content.replace(", isTransitioning", "")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully Cleaned smoothNavigate and dependencies")
