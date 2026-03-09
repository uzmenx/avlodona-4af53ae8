import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStories, StoryGroup } from "@/hooks/useStories";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getStoryRingGradient } from "./storyRings";

interface StoriesRowProps {
  onStoryClick: (groupIndex: number, storyIndex?: number) => void;
}

export const StoriesRow = ({ onStoryClick }: StoriesRowProps) => {
  const { storyGroups, isLoading } = useStories();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Check if current user has stories
  const myStoryGroup = storyGroups.find((g) => g.user_id === user?.id);
  const otherGroups = storyGroups.filter((g) => g.user_id !== user?.id);

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <div className="flex gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
              <div className="w-12 h-3 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (storyGroups.length === 0 && !user) {
    return null;
  }

  return (
    <div className="relative border-b border-border">
      {/* Scroll buttons */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm hidden sm:flex"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 bg-background/80 backdrop-blur-sm shadow-sm hidden sm:flex"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Stories scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide px-4 gap-[3px] py-[3px] flex items-start justify-start"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Add story / My story button */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative overflow-visible">
            {myStoryGroup ? (
              <StoryAvatar
                group={myStoryGroup}
                onClick={() => {
                  const index = storyGroups.findIndex((g) => g.user_id === user?.id);
                  onStoryClick(index);
                }}
                isOwn
              />
            ) : (
              <motion.button
                onClick={() => navigate("/create-story")}
                className="w-16 h-16 rounded-full bg-muted/80 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-muted-foreground/30 hover:border-primary transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="You"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Plus className="h-6 w-6 text-muted-foreground" />
                )}
              </motion.button>
            )}

            <motion.button
              onClick={() => navigate("/create-story")}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white/85 flex items-center justify-center border-2 border-white/60 shadow-md"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="h-3.5 w-3.5 text-black/80" />
            </motion.button>
          </div>
          <span className="text-xs text-muted-foreground truncate w-16 text-center">
            {myStoryGroup ? "Hikoyangiz" : "Qo'shish"}
          </span>
        </div>

        {/* Other users' stories */}
        {otherGroups.map((group) => {
          const groupIndex = storyGroups.findIndex((g) => g.user_id === group.user_id);
          return <StoryAvatar key={group.user_id} group={group} onClick={() => onStoryClick(groupIndex)} />;
        })}

      </div>
    </div>
  );
};

interface StoryAvatarProps {
  group: StoryGroup;
  onClick: () => void;
  isOwn?: boolean;
}

const StoryAvatar = ({ group, onClick, isOwn }: StoryAvatarProps) => {
  const displayName = group.user.name || group.user.username || "Foydalanuvchi";
  const avatarEl = group.user.avatar_url ? (
    <img src={group.user.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
  ) : (
    <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-medium">
      {displayName.charAt(0).toUpperCase()}
    </div>
  );

  // Get the ring gradient from the latest story's ring_id
  const latestRingId = group.stories[group.stories.length - 1]?.ring_id || 'default';
  const ringGradient = getStoryRingGradient(latestRingId);

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <motion.button
        onClick={onClick}
        className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        {group.has_unviewed ? (
          <>
            <span
              className="absolute inset-0 rounded-full p-[3px] ring-2 ring-white/20 dark:ring-black/20 shadow-sm"
              style={{ background: ringGradient }}
              aria-hidden
            >
              <span className="block w-full h-full rounded-full bg-background" />
            </span>
            <span className="relative z-10 w-[58px] h-[58px] rounded-full overflow-hidden bg-background ring-1 ring-black/5">
              {avatarEl}
            </span>
          </>
        ) : (
          <span className="w-full h-full rounded-full bg-muted-foreground/30 p-[3px] block ring-2 ring-white/10 dark:ring-black/10">
            <span className="w-full h-full rounded-full bg-background overflow-hidden block">
              {avatarEl}
            </span>
          </span>
        )}
      </motion.button>
      <span className="text-xs text-foreground truncate w-16 text-center">
        {isOwn ? "" : displayName.substring(0, 10)}
      </span>
    </div>
  );
};
