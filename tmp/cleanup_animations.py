import os
import re

file_path = r'c:\Users\otabek\Desktop\avlodona\src\components\feed\UnifiedFullScreenViewer.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clean up slideDirection / isTransitioning logic in render functions
# Simplified removal of animation classes in classNames
content = re.sub(r'transition-all duration-200 ease-out",\s*slideDirection === \'down\' && "animate-slide-out-up",\s*slideDirection === \'up\' && "animate-slide-out-down",\s*!slideDirection && "animate-slide-in"', '', content, flags=re.DOTALL)
content = re.sub(r'transition-all duration-300 ease-out",\s*slideDirection === \'down\' && "animate-slide-out-up",\s*slideDirection === \'up\' && "animate-slide-out-down",\s*!slideDirection && "animate-slide-in"', '', content, flags=re.DOTALL)

# 2. Add scrollContainerRef and handleScroll properly if they are duplicated or missing
# (Handled by previous turns mostly)

# 3. Last check for isTransitioning and slideDirection
content = content.replace(" if (isScrolling || isTransitioning) return;", " if (isScrolling) return;")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully Cleaned Animations")
