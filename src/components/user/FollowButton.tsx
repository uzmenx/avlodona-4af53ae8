import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface FollowButtonProps {
  targetUserId: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** 'fullscreen' = always white text/border regardless of theme (used in video viewer) */
  variant?: "default" | "fullscreen";
}

export const FollowButton = ({ targetUserId, size = "default", className, variant = "default" }: FollowButtonProps) => {
  const { user } = useAuth();
  const { isFollowing, isRequested, isLoading, toggleFollow } = useFollow(targetUserId);
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (user?.id === targetUserId) return null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples((p) => [...p, { x, y, id }]);
      setTimeout(() => setRipples((p) => p.filter((r) => r.id !== id)), 600);
    }
    toggleFollow();
  };

  const isFullscreen = variant === "fullscreen";

  return (
    <Button
      ref={btnRef}
      variant="outline"
      size={size}
      onClick={handleClick}
      disabled={isLoading || !user}
      className={cn(
        "min-w-[90px] relative overflow-hidden transition-all duration-300 rounded-full backdrop-blur-xl",
        isFullscreen
          ? cn(
              // Fullscreen: transparent white bg and white text when not following, to be visible but not solid white
              isFollowing
                ? "border border-white/40 bg-white/10 !text-white hover:bg-white/20"
                : isRequested
                  ? "border border-white/40 bg-white/20 !text-white hover:bg-white/30"
                  : "border border-white bg-white/20 !text-white hover:bg-white/30 shadow-sm font-semibold",
            )
          : cn(
              // Normal: theme-aware
              "border border-white/15",
              isFollowing
                ? "bg-white/10 text-foreground hover:bg-white/15"
                : isRequested
                  ? "bg-white/20 text-foreground hover:bg-white/30 border-white/30"
                  : "bg-white/5 text-foreground hover:bg-white/10 border-white/20",
            ),
        className,
      )}
      style={isFullscreen ? { textShadow: '0 1px 3px rgba(0,0,0,0.6)' } : undefined}
    >
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          className="absolute rounded-full bg-white/40"
          style={{ left: r.x, top: r.y, width: 8, height: 8, marginLeft: -4, marginTop: -4 }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 25, opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowing ? "Kuzatasiz" : isRequested ? "So'rov yuborildi" : "Kuzatish"}
    </Button>
  );
};
