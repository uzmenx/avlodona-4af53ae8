 import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ImagePlus } from 'lucide-react';
import { FamilyMember } from '@/types/family';
import { cn } from '@/lib/utils';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { useStories, StoryGroup } from '@/hooks/useStories';
import { useAuth } from '@/contexts/AuthContext';
import { getStoryRingGradient } from '@/components/stories/storyRings';
import { MergedBadges } from './MergedBadges';
import { Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FamilyMemberNodeData {
  member: FamilyMember;
  onOpenProfile: (member: FamilyMember) => void;
   // Merge mode props
   isMergeMode?: boolean;
   isSelected?: boolean;
   isPrimary?: boolean;
   mergedNames?: string[];
   onLongPress?: (memberId: string) => void;
   onToggleSelect?: (memberId: string) => void;
   readOnly?: boolean;
}

interface FamilyMemberNodeProps {
  data: FamilyMemberNodeData;
}

interface StoryStatus {
  hasStory: boolean;
  hasUnviewed: boolean;
  storyGroupIndex: number;
  ringGradient?: string;
}

const FamilyMemberNode = memo(({ data }: FamilyMemberNodeProps) => {
   const { 
     member, 
     onOpenProfile,
     isMergeMode = false,
     isSelected = false,
     isPrimary = false,
     mergedNames = [],
     onLongPress,
     onToggleSelect,
     readOnly = false,
   } = data;
  const { storyGroups } = useStories();
  const { user, profile } = useAuth();
  const [storyStatus, setStoryStatus] = useState<StoryStatus>({ 
    hasStory: false, 
    hasUnviewed: false, 
    storyGroupIndex: -1 
  });
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const navigate = useNavigate();

  // Long press detection
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didMoveRef = useRef(false);

  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_THRESHOLD_PX = 12;

  const yearDisplay = member.birthYear 
    ? `${member.birthYear}${member.deathYear ? ` - ${member.deathYear}` : ''}`
    : '';

  const isMale = member.gender === 'male';

  // Check if linked user has active story
  useEffect(() => {
    if (!member.linkedUserId || !storyGroups.length) {
      setStoryStatus({ hasStory: false, hasUnviewed: false, storyGroupIndex: -1, ringGradient: undefined });
      return;
    }

    const groupIndex = storyGroups.findIndex(g => g.user_id === member.linkedUserId);
    if (groupIndex >= 0) {
      const group = storyGroups[groupIndex];
      const latestRingId = group.stories[group.stories.length - 1]?.ring_id || 'default';
      setStoryStatus({
        hasStory: true,
        hasUnviewed: group.has_unviewed,
        storyGroupIndex: groupIndex,
        ringGradient: getStoryRingGradient(latestRingId),
      });
    } else {
      setStoryStatus({ hasStory: false, hasUnviewed: false, storyGroupIndex: -1, ringGradient: undefined });
    }
  }, [member.linkedUserId, storyGroups]);

  const resolvedAvatarUrl = useMemo(() => {
    const linked = member.linkedUserId;
    if (linked && user?.id && linked === user.id) {
      return profile?.avatar_url || member.photoUrl;
    }

    if (linked && storyStatus.storyGroupIndex >= 0) {
      const group = storyGroups[storyStatus.storyGroupIndex];
      return group?.user?.avatar_url || member.photoUrl;
    }

    return member.photoUrl;
  }, [member.linkedUserId, member.photoUrl, profile?.avatar_url, storyGroups, storyStatus.storyGroupIndex, user?.id]);

   // Long press handlers
   const handlePointerDown = useCallback((e: React.PointerEvent) => {
     isLongPressRef.current = false;
     didMoveRef.current = false;
     pointerStartRef.current = { x: e.clientX, y: e.clientY };

     if (longPressTimerRef.current) {
       clearTimeout(longPressTimerRef.current);
       longPressTimerRef.current = null;
     }

     longPressTimerRef.current = setTimeout(() => {
       if (didMoveRef.current) return;
       isLongPressRef.current = true;
       if (onLongPress && !isMergeMode) {
         onLongPress(member.id);
       }
     }, LONG_PRESS_MS);
   }, [member.id, onLongPress, isMergeMode]);

   const handlePointerMove = useCallback((e: React.PointerEvent) => {
     if (!longPressTimerRef.current) return;
     const start = pointerStartRef.current;
     if (!start) return;
     const dx = e.clientX - start.x;
     const dy = e.clientY - start.y;
     if ((dx * dx + dy * dy) > (MOVE_CANCEL_THRESHOLD_PX * MOVE_CANCEL_THRESHOLD_PX)) {
       didMoveRef.current = true;
       clearTimeout(longPressTimerRef.current);
       longPressTimerRef.current = null;
     }
   }, []);
 
   const handlePointerUp = useCallback(() => {
     pointerStartRef.current = null;
     didMoveRef.current = false;
     if (longPressTimerRef.current) {
       clearTimeout(longPressTimerRef.current);
       longPressTimerRef.current = null;
     }
   }, []);
 
   const handlePointerLeave = useCallback(() => {
     pointerStartRef.current = null;
     didMoveRef.current = false;
     if (longPressTimerRef.current) {
       clearTimeout(longPressTimerRef.current);
       longPressTimerRef.current = null;
     }
   }, []);
 
  const handleAvatarClick = () => {
     // If long press just happened, ignore click
     if (isLongPressRef.current) {
       isLongPressRef.current = false;
       return;
     }
     
     // If in merge mode, toggle selection
     if (isMergeMode && onToggleSelect) {
       onToggleSelect(member.id);
       return;
     }
     
    // If has unviewed story, show story viewer
    if (storyStatus.hasStory && storyStatus.hasUnviewed && storyStatus.storyGroupIndex >= 0) {
      setShowStoryViewer(true);
    } else {
      // Otherwise open profile
      onOpenProfile(member);
    }
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenProfile(member);
  };

  return (
    <>
       <div 
         className="relative flex flex-col items-center"
         onPointerDown={handlePointerDown}
         onPointerMove={handlePointerMove}
         onPointerUp={handlePointerUp}
         onPointerLeave={handlePointerLeave}
       >
        {/* Top handle for parent connections */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-top-1"
        />
        
         {/* Avatar - clickable with selection indicator */}
        <div
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200",
            "cursor-pointer transition-transform duration-200 hover:scale-110 shadow-lg",
            // Merge mode selection styles
            isMergeMode && "ring-offset-2 ring-offset-background",
            isSelected && isPrimary && "ring-4 ring-green-500 scale-110",
            isSelected && !isPrimary && "ring-4 ring-yellow-500 scale-105",
            isMergeMode && !isSelected && "opacity-60",
            // Story ring (viewed)
            storyStatus.hasStory && !storyStatus.hasUnviewed && "ring-2 ring-offset-2 ring-offset-background ring-muted-foreground/30",
            // Default border when no story
            !storyStatus.hasStory && !isSelected && "border-3",
            isMale
              ? "bg-sky-500 border-sky-400"
              : "bg-pink-500 border-pink-400"
          )}
          onClick={handleAvatarClick}
        >
           {/* Selection checkmark */}
           {isSelected && (
             <div className={cn(
               "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center z-10",
               isPrimary ? "bg-green-500" : "bg-yellow-500"
             )}>
               <Check className="w-4 h-4 text-white" />
             </div>
           )}
           
          {/* Spouse connection handles */}
          {isMale && (
            <Handle
              type="source"
              position={Position.Right}
              id="spouse-right"
              isConnectable={false}
              className="!bg-red-500 !w-2 !h-2 !border-2 !border-background"
            />
          )}
          {!isMale && (
            <Handle
              type="target"
              position={Position.Left}
              id="spouse-left"
              isConnectable={false}
              className="!bg-red-500 !w-2 !h-2 !border-2 !border-background"
            />
          )}

          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/create-post?memberId=${member.id}`);
              }}
              className="absolute -top-1 -right-1 w-7 h-7 bg-background rounded-full flex items-center justify-center z-20 shadow-md border border-border group/btn"
              title="Xotira qoldirish"
            >
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center group-hover/btn:bg-primary transition-colors">
                <Plus className="w-3.5 h-3.5 text-primary group-hover/btn:text-primary-foreground transition-colors" />
              </div>
            </button>
          )}

          {storyStatus.hasStory && storyStatus.hasUnviewed && storyStatus.ringGradient ? (
            <span
              className="absolute inset-0 rounded-full p-[3px] ring-2 ring-white/20 shadow-sm"
              style={{ background: storyStatus.ringGradient }}
              aria-hidden
            >
              <span className="block w-full h-full rounded-full bg-background" />
            </span>
          ) : null}

          <span className={cn(
            "relative z-10 w-full h-full rounded-full overflow-hidden",
            storyStatus.hasStory && storyStatus.hasUnviewed ? "p-[6px]" : "p-0"
          )}>
            <span className="block w-full h-full rounded-full overflow-hidden">
              {resolvedAvatarUrl ? (
                <img
                  src={resolvedAvatarUrl}
                  alt={member.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : member.name ? (
                <span className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  {member.name[0]?.toUpperCase()}
                </span>
              ) : (
                <span className="w-full h-full rounded-full flex items-center justify-center">
                  <ImagePlus className="w-8 h-8 text-white/70" />
                </span>
              )}
            </span>
          </span>
           
           {/* Merged profiles badges */}
           {mergedNames.length > 0 && (
             <MergedBadges mergedNames={mergedNames} gender={member.gender} />
           )}
        </div>
        
        {/* Name and year display - clicking opens profile */}
        <div 
          className="text-center mt-2 cursor-pointer"
          onClick={handleNameClick}
        >
          <h3 className={cn(
            "font-medium text-sm px-3 py-1 rounded-full",
            isMale 
              ? "bg-sky-900/80 text-sky-100" 
              : "bg-pink-900/80 text-pink-100"
          )}>
            {member.name || 'Ism kiriting'}
          </h3>
          {yearDisplay && (
            <span className={cn(
              "text-xs mt-1 inline-block px-2 py-0.5 rounded-full",
              isMale 
                ? "bg-sky-800/60 text-sky-200" 
                : "bg-pink-800/60 text-pink-200"
            )}>
              {yearDisplay}
            </span>
          )}
        </div>
        
        {/* Bottom handle for children connections */}
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-bottom-1"
        />
      </div>

      {/* Story Viewer */}
      {showStoryViewer && storyStatus.storyGroupIndex >= 0 && (
        <StoryViewer
          storyGroups={storyGroups}
          initialGroupIndex={storyStatus.storyGroupIndex}
          onClose={() => setShowStoryViewer(false)}
        />
      )}
    </>
  );
});

FamilyMemberNode.displayName = 'FamilyMemberNode';

export default FamilyMemberNode;
export type { FamilyMemberNodeData };
