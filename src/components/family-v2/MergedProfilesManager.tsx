import { useState, useCallback } from 'react';
import { GripVertical, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface MergedProfile {
  id: string;
  name: string;
  photoUrl?: string;
  gender: 'male' | 'female';
}

interface MergedProfilesManagerProps {
  profiles: MergedProfile[];
  onReorder: (profiles: MergedProfile[]) => void;
}

export const MergedProfilesManager = ({
  profiles,
  onReorder,
}: MergedProfilesManagerProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newProfiles = [...profiles];
    const [removed] = newProfiles.splice(draggedIndex, 1);
    newProfiles.splice(dropIndex, 0, removed);
    
    onReorder(newProfiles);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, profiles, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  if (profiles.length <= 1) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center">
        Birlashgan profillar (birinchisi asosiy)
      </p>
      
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 pb-2 px-1">
          {profiles.map((profile, index) => {
            const isMale = profile.gender === 'male';
            const isFirst = index === 0;
            const isDragging = draggedIndex === index;
            const isDropTarget = dragOverIndex === index;
            
            return (
              <div
                key={profile.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing",
                  "border-2 transition-all duration-200",
                  isFirst 
                    ? "bg-primary/10 border-primary" 
                    : "bg-muted/50 border-transparent hover:border-muted-foreground/30",
                  isDragging && "opacity-50 scale-95",
                  isDropTarget && !isDragging && "border-primary border-dashed scale-105"
                )}
              >
                <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                
                {/* Avatar */}
                <div 
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    isMale ? "bg-sky-500" : "bg-pink-500"
                  )}
                >
                  {profile.photoUrl ? (
                    <img 
                      src={profile.photoUrl} 
                      alt={profile.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-white">
                      {profile.name?.[0]?.toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                
                {/* Name */}
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate max-w-[80px]",
                    isFirst && "text-primary"
                  )}>
                    {profile.name || "Noma'lum"}
                  </p>
                  {isFirst && (
                    <p className="text-[10px] text-muted-foreground">Asosiy</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
