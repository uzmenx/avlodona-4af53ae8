import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, X, User, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useStories, type StoryGroup } from "@/hooks/useStories";
import { getStoryRingGradient } from "@/components/stories/storyRings";
import { useLanguage } from "@/contexts/LanguageContext";

interface HomeHeaderProps {
  unreadCount: number;
  messageCount: number;
  onSearchSubmit: (query: string) => void;
  onSearchFocus: () => void;
  onNotificationsClick: () => void;
  onStoryClick: (groupIndex: number) => void;
  gridLayout: 1 | 2;
  onToggleLayout: () => void;
}

export const HomeHeader = ({
  unreadCount,
  messageCount,
  onSearchSubmit,
  onSearchFocus,
  onNotificationsClick,
  onStoryClick,
  gridLayout,
  onToggleLayout,
}: HomeHeaderProps) => {
  const { user, profile } = useAuth();
  const { storyGroups, isLoading } = useStories();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Long-press logic for profile circle
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleProfilePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowProfileMenu(true);
    }, 500);
  }, []);

  const handleProfilePointerUp = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleProfilePointerLeave = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleProfileTap = useCallback(() => {
    if (showProfileMenu) return;
    navigate("/profile");
  }, [navigate, showProfileMenu]);

  // Inline search state
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSubmit(searchQuery.trim());
    }
  };

  const initials = (profile?.name || profile?.username || "?")[0]?.toUpperCase();
  const myStoryGroup = storyGroups.find((g) => g.user_id === user?.id);
  const otherGroups = storyGroups.filter((g) => g.user_id !== user?.id);

  const showSkeleton = isLoading && storyGroups.length === 0;

  // Scroll to hide logic
  const headerRef = useRef<HTMLDivElement>(null);
  const headerHeightRef = useRef(150);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    // Cache header height to avoid layout thrashing
    const updateHeight = () => {
      if (headerRef.current) {
        headerHeightRef.current = headerRef.current.offsetHeight;
      }
    };
    
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  useEffect(() => {
    let headerY = 0;

    const handleScroll = (e: Event) => {
      if (!ticking.current) {
        const target = e.target as HTMLElement | Document;
        
        // Fast ignore for horizontal story scrolling
        if (target !== document && target !== window) {
          const el = target as HTMLElement;
          if (el.classList && (el.classList.contains('overflow-x-auto') || el.classList.contains('scrollbar-hide'))) {
            return;
          }
        }

        window.requestAnimationFrame(() => {
          let currentScrollY = 0;
          let maxScroll = 0;
          
          if (target === document || target === window) {
            const se = document.scrollingElement;
            currentScrollY = (se && se.scrollTop) || window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
            maxScroll = Math.max(
              document.body.scrollHeight, 
              document.documentElement.scrollHeight
            ) - window.innerHeight;
          } else {
            const el = target as HTMLElement;
            currentScrollY = el.scrollTop || 0;
            maxScroll = el.scrollHeight - el.clientHeight;
          }
          
          // iOS / Android rubber-banding & overscroll protection (top and bottom)
          if (currentScrollY < 0 || currentScrollY > maxScroll) {
            // Update lastScrollY but don't move the header during a bounce
            lastScrollY.current = Math.max(0, Math.min(currentScrollY, maxScroll));
            ticking.current = false;
            return;
          }
          
          const diff = currentScrollY - lastScrollY.current;
          const headerHeight = headerHeightRef.current;
          
          if (currentScrollY <= 0) {
            headerY = 0; // Reset to fully visible at the top
          } else {
            // Track finger movement: subtract diff, clamp between -headerHeight and 0
            headerY = Math.max(-headerHeight, Math.min(0, headerY - diff));
          }
          
          if (headerRef.current) {
            headerRef.current.style.transform = `translate3d(0, ${headerY}px, 0)`;
          }
          
          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", handleScroll, { capture: true });
  }, []);

  return (
    <div 
      ref={headerRef}
      style={{ willChange: 'transform' }}
      className="sticky top-[env(safe-area-inset-top,0px)] z-[60] mx-0 bg-transparent backdrop-blur-xl"
    >
      {/* ─── Row 1: Stories / Profile circles ─────────────── */}
      <div
        ref={scrollRef}
        className="flex items-start gap-3 overflow-x-auto scrollbar-hide px-3 pt-3 pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* ── My Profile Circle (always first) ── */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <motion.button
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.94 }}
            onPointerDown={handleProfilePointerDown}
            onPointerUp={handleProfilePointerUp}
            onPointerLeave={handleProfilePointerLeave}
            onClick={handleProfileTap}
            className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center p-[2px]"
            style={{
              background: myStoryGroup?.has_unviewed
                ? getStoryRingGradient(myStoryGroup.stories[myStoryGroup.stories.length - 1]?.ring_id || "default")
                : "rgba(255,255,255,0.15)"
            }}
          >
            <div className="w-full h-full rounded-full border-[2.5px] border-background overflow-hidden relative">
              <Avatar className="h-full w-full rounded-full">
                <AvatarImage src={profile?.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-violet-500 to-indigo-500 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
            {/* + badge */}
            <motion.div
              whileHover={{ scale: 1.15 }}
              onClick={(e) => { e.stopPropagation(); navigate("/create-story"); }}
              className="absolute bottom-0 right-0 z-20 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md ring-2 ring-background cursor-pointer"
            >
              <span className="text-white text-[11px] font-bold leading-none">+</span>
            </motion.div>
          </motion.button>
          <span className="text-[10px] text-muted-foreground font-medium truncate w-[68px] text-center">
            {t("me")}
          </span>
        </div>

        {/* ── Other users' stories ── */}
        {showSkeleton
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-[68px] h-[68px] rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-2.5 bg-muted animate-pulse rounded" />
              </div>
            ))
          : otherGroups.map((group) => {
              const groupIndex = storyGroups.findIndex((g) => g.user_id === group.user_id);
              return (
                <StoryCircle
                  key={group.user_id}
                  group={group}
                  onClick={() => onStoryClick(groupIndex)}
                />
              );
            })}
      </div>

      {/* ─── Row 2: Search + Notifications + Chat ──────────── */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        {/* Search bar (inline input) */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative min-w-0">
          <div className="flex items-center h-9 rounded-full px-3 gap-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
            <Search className="h-4 w-4 text-foreground/50 shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={onSearchFocus}
              placeholder={t("searchChats")}
              className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-foreground/45 min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Layout toggle */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onToggleLayout}
          className="relative h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          {gridLayout === 1 ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/80"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/80"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
          )}
        </motion.button>

        {/* Notifications bell */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onNotificationsClick}
          className="relative h-9 w-9 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
        >
          <Bell className="h-[18px] w-[18px] text-foreground/80" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-[18px] min-w-[18px] px-1 py-0 flex items-center justify-center text-[9px] font-bold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </motion.button>

        {/* CHAT premium pill */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
          onClick={() => navigate("/messages")}
          className="relative h-9 px-3 sm:px-4 rounded-full flex items-center justify-center gap-1 sm:gap-1.5 shrink-0 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #0ea5e9 100%)",
            boxShadow: "0 4px 20px rgba(124,58,237,0.45), 0 1px 4px rgba(0,0,0,0.2)",
          }}
        >
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 opacity-30"
            style={{
              background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)",
            }}
            animate={{ x: ["−100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
          />
          {messageCount > 0 && (
            <span className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[9px] font-bold text-white">
              {messageCount > 9 ? "9+" : messageCount}
            </span>
          )}
          <span className="relative z-10 text-[13px] font-bold tracking-widest text-white drop-shadow-sm">
            CHAT
          </span>
        </motion.button>
      </div>

      {/* ─── Long-press profile menu ─────────────────────── */}
      <AnimatePresence>
        {showProfileMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileMenu(false)}
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="fixed top-20 left-4 z-[91] w-52 rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              style={{ background: "rgba(15,15,25,0.92)", backdropFilter: "blur(24px)" }}
            >
              {[
                { label: "Profilga kirish", icon: <User className="h-4 w-4 text-white/80" />, action: () => { navigate("/profile"); setShowProfileMenu(false); } },
                ...(myStoryGroup ? [{ label: "Hikoyamni ko'rish", icon: <Eye className="h-4 w-4 text-white/80" />, action: () => { const myIdx = storyGroups.findIndex(g => g.user_id === user?.id); if (myIdx >= 0) onStoryClick(myIdx); setShowProfileMenu(false); } }] : []),
              ].map((item, i, arr) => (
                <motion.button
                  key={i}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.07)" }}
                  onClick={item.action}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left transition-colors"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined }}
                >
                  <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 border border-white/10 shadow-sm">
                    {item.icon}
                  </div>
                  <span className="text-sm text-white/90 font-medium">{item.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────── Story Circle ──────────────────── */
interface StoryCircleProps {
  group: StoryGroup;
  onClick: () => void;
}

const StoryCircle = ({ group, onClick }: StoryCircleProps) => {
  const displayName = group.user.name || group.user.username || "Foydalanuvchi";
  const latestRingId = group.stories[group.stories.length - 1]?.ring_id || "default";
  const ringGradient = getStoryRingGradient(latestRingId);

  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center p-[2px]"
        style={{
          background: group.has_unviewed ? ringGradient : "rgba(255,255,255,0.15)"
        }}
      >
        <div className="w-full h-full rounded-full border-[2.5px] border-background overflow-hidden relative">
          {group.user.avatar_url ? (
            <img
              src={group.user.avatar_url}
              alt={displayName}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-semibold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </motion.button>
      <span className="text-[10px] text-foreground/70 font-medium truncate w-[68px] text-center leading-tight">
        {displayName.substring(0, 9)}
      </span>
    </div>
  );
};
