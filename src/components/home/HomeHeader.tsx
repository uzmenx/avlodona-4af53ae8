import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, LayoutList, Grid2X2 } from "lucide-react";
import { motion } from "framer-motion";

interface HomeHeaderProps {
  title: string;
  unreadCount: number;
  gridLayout: 1 | 2;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onToggleLayout: () => void;
}

export const HomeHeader = ({
  title,
  unreadCount,
  gridLayout,
  onSearchClick,
  onNotificationsClick,
  onToggleLayout
}: HomeHeaderProps) => {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="sticky top-[env(safe-area-inset-top,0px)] z-40 px-4 flex items-center justify-between rounded-2xl mx-3 mt-2 mb-0 border border-white/10 bg-background/40 backdrop-blur-xl shadow-lg my-[6px] py-0"
    >
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onSearchClick} className="h-9 w-9 rounded-xl">
          <Search className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNotificationsClick}
          className="relative h-9 w-9 rounded-xl"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleLayout} className="h-9 w-9 rounded-xl">
          {gridLayout === 1 ? <LayoutList className="h-5 w-5" /> : <Grid2X2 className="h-5 w-5" />}
        </Button>
      </div>
    </motion.header>
  );
};
