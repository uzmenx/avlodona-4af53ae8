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
import { usePresence } from '@/hooks/usePresence';

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
    readOnly = false
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
  const isOnline = usePresence(member.linkedUserId);

  // Long press detection
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const pointerStartRef = useRef<{x: number;y: number;} | null>(null);
  const didMoveRef = useRef(false);

  const LONG_PRESS_MS = 500;
  const MOVE_CANCEL_THRESHOLD_PX = 12;

  const yearDisplay = member.birthYear ?
  `${member.birthYear}${member.deathYear ? ` - ${member.deathYear}` : ''}` :
  '';

  const isMale = member.gender === 'male';

  // Floating physics and trail refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const movingRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef({
    x: 0, y: 0,
    vx: 0, vy: 0,
    trail: [] as { x: number; y: number; age: number }[],
    lastTime: performance.now(),
    baseTargetX: 0,
    baseTargetY: 0,
    angle: Math.random() * Math.PI * 2
  });

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const movingDiv = movingRef.current;
    if (!canvas || !movingDiv) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxRadius = 15;
    const springK = 0.03;
    const friction = 0.90;
    const maxTrailAge = 60;

    const renderLoop = (time: number) => {
      const state = physicsRef.current;
      const dt = Math.min((time - state.lastTime) / 16, 2);
      state.lastTime = time;

      // Target orbit
      state.angle += 0.02 * dt;
      state.baseTargetX = Math.cos(state.angle) * (maxRadius * 0.6);
      state.baseTargetY = Math.sin(state.angle * 0.7) * (maxRadius * 0.6);

      // Forces
      state.vx += (Math.random() - 0.5) * 1.5;
      state.vy += (Math.random() - 0.5) * 1.5;
      
      state.vx += (state.baseTargetX - state.x) * springK;
      state.vy += (state.baseTargetY - state.y) * springK;
      
      state.vx *= friction;
      state.vy *= friction;
      
      state.x += state.vx * dt;
      state.y += state.vy * dt;

      // Clamp
      const dist = Math.sqrt(state.x * state.x + state.y * state.y);
      if (dist > maxRadius) {
        state.x = (state.x / dist) * maxRadius;
        state.y = (state.y / dist) * maxRadius;
      }

      movingDiv.style.transform = `translate3d(${state.x}px, ${state.y}px, 0)`;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      state.trail.push({ x: state.x, y: state.y, age: 0 });
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (state.trail.length > 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const baseColor = isMale ? '14, 165, 233' : '236, 72, 153'; // sky-500 and pink-500

        ctx.beginPath();
        for (let i = 0; i < state.trail.length; i++) {
          const pt = state.trail[i];
          const px = centerX + pt.x;
          const py = centerY + pt.y;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          
          pt.age += dt;
        }

        state.trail = state.trail.filter(pt => pt.age < maxTrailAge);

        if (state.trail.length > 1) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = `rgb(${baseColor})`;
          
          ctx.lineWidth = 6;
          ctx.strokeStyle = `rgba(${baseColor}, 0.2)`;
          ctx.stroke();

          ctx.lineWidth = 3;
          ctx.strokeStyle = `rgba(${baseColor}, 0.5)`;
          ctx.stroke();

          ctx.lineWidth = 1;
          ctx.strokeStyle = `rgba(255, 255, 255, 0.8)`;
          ctx.shadowBlur = 4;
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMale]);

  // Check if linked user has active story
  useEffect(() => {
    if (!member.linkedUserId || !storyGroups.length) {
      setStoryStatus({ hasStory: false, hasUnviewed: false, storyGroupIndex: -1, ringGradient: undefined });
      return;
    }

    const groupIndex = storyGroups.findIndex((g) => g.user_id === member.linkedUserId);
    if (groupIndex >= 0) {
      const group = storyGroups[groupIndex];
      const latestRingId = group.stories[group.stories.length - 1]?.ring_id || 'default';
      setStoryStatus({
        hasStory: true,
        hasUnviewed: group.has_unviewed,
        storyGroupIndex: groupIndex,
        ringGradient: getStoryRingGradient(latestRingId)
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
    if (dx * dx + dy * dy > MOVE_CANCEL_THRESHOLD_PX * MOVE_CANCEL_THRESHOLD_PX) {
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

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      onOpenProfile?.(member);
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
        onPointerLeave={handlePointerLeave}>
        
        {/* Top handle for parent connections */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-top-1" />
        
        <canvas 
          ref={canvasRef}
          className="absolute pointer-events-none z-0"
          style={{
            width: '160px',
            height: '160px',
            left: '50%',
            top: '40px',
            transform: 'translate(-50%, -50%)'
          }}
          width={160}
          height={160}
        />

        <div ref={movingRef} className="relative flex flex-col items-center z-10 will-change-transform">
        
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
            isMale ?
            "bg-sky-500 border-sky-400" :
            "bg-pink-500 border-pink-400"
          )}
          onClick={handleAvatarClick}>
          
           {/* Selection checkmark */}
           {isSelected &&
          <div className={cn(
            "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center z-10",
            isPrimary ? "bg-green-500" : "bg-yellow-500"
          )}>
               <Check className="w-4 h-4 text-white" />
             </div>
          }
           
          {/* Spouse connection handles */}
          {isMale &&
          <Handle
            type="source"
            position={Position.Right}
            id="spouse-right"
            isConnectable={false}
            className="!bg-red-500 !w-2 !h-2 !border-2 !border-background" />

          }
          {!isMale &&
          <Handle
            type="target"
            position={Position.Left}
            id="spouse-left"
            isConnectable={false}
            className="!bg-red-500 !w-2 !h-2 !border-2 !border-background" />

          }

          {!readOnly &&
          <button
            onClick={(e) => {
              e.stopPropagation();
              const effectiveMemberId = member.supabaseId || member.id;
              navigate(`/create?memberId=${effectiveMemberId}`);
            }}
            className="absolute -bottom-1 -right-1 w-7 h-7 bg-background rounded-full z-20 shadow-md border border-border group/btn flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity"
            title="Xotira qoldirish">
            
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center group-hover/btn:bg-primary transition-colors">
                <Plus className="w-3.5 h-3.5 text-primary group-hover/btn:text-primary-foreground transition-colors" />
              </div>
            </button>
          }

          {storyStatus.hasStory && storyStatus.hasUnviewed && storyStatus.ringGradient ?
          <span
            className="absolute inset-0 rounded-full p-[3px] ring-2 ring-white/20 shadow-sm"
            style={{ background: storyStatus.ringGradient }}
            aria-hidden>
            
              <span className="block w-full h-full rounded-full bg-background" />
            </span> :
          null}

          <span className={cn(
            "relative z-10 w-full h-full rounded-full overflow-hidden",
            storyStatus.hasStory && storyStatus.hasUnviewed ? "p-[6px]" : "p-0"
          )}>
            <span className="block w-full h-full rounded-full overflow-hidden">
              {resolvedAvatarUrl ?
              <img
                src={resolvedAvatarUrl}
                alt={member.name}
                className="w-full h-full rounded-full object-cover" /> :

              member.name ?
              <span className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-white">
                  {member.name[0]?.toUpperCase()}
                </span> :

              <span className="w-full h-full rounded-full flex items-center justify-center">
                  <ImagePlus className="w-8 h-8 text-white/70" />
                </span>
              }
            </span>
          </span>
           
           {/* Merged profiles badges */}
           {mergedNames.length > 0 &&
          <MergedBadges mergedNames={mergedNames} gender={member.gender} />
          }
        </div>
        
        <div
          className="text-center mt-2 cursor-pointer relative flex flex-col items-center gap-1"
          onClick={handleNameClick}>
          
          <div className={cn(
            "font-medium text-[13px] px-3 py-0.5 rounded-full inline-flex items-center gap-2 max-w-[120px] justify-center",
            member.linkedUserId ? 
              "bg-emerald-100 dark:bg-green-900/40 border border-emerald-300 dark:border-green-500/50 text-emerald-950 dark:text-green-50 backdrop-blur-sm shadow-[0_0_10px_rgba(34,197,94,0.2)] dark:shadow-[0_0_15px_rgba(34,197,94,0.15)]" :
              isMale ? "bg-sky-900/80 text-sky-100" : "bg-pink-900/80 text-pink-100"
          )}>
            {member.linkedUserId && (
              <span className="relative flex h-2 w-2 flex-shrink-0">
                {isOnline && (
                  <span className="animate-pulse-green absolute inline-flex h-full w-full rounded-full bg-green-500 dark:bg-green-400 opacity-75"></span>
                )}
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isOnline ? "bg-green-600 dark:bg-green-500" : "bg-emerald-300 dark:bg-white/60"
                )}></span>
              </span>
            )}
            <span className="truncate">{member.name || 'Ism kiriting'}</span>
          </div>
          {yearDisplay &&
          <span className={cn(
            "text-[10px] inline-flex px-2 py-0.5 rounded-md font-medium tracking-tight whitespace-nowrap",
            isMale ?
            "bg-sky-800/80 text-sky-100" :
            "bg-pink-800/80 text-pink-100"
          )}>
              {yearDisplay}
            </span>
          }
        </div>
        </div>
        
        {/* Bottom handle for children connections */}
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          className="!bg-sky-500 !w-2.5 !h-2.5 !border-2 !border-background !-bottom-1" />
        
      </div>

      {/* Story Viewer */}
      {showStoryViewer && storyStatus.storyGroupIndex >= 0 &&
      <StoryViewer
        storyGroups={storyGroups}
        initialGroupIndex={storyStatus.storyGroupIndex}
        onClose={() => setShowStoryViewer(false)} />

      }
    </>);

});

FamilyMemberNode.displayName = 'FamilyMemberNode';

export default FamilyMemberNode;
export type { FamilyMemberNodeData };