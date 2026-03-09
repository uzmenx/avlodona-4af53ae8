import { useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { NotificationsTab } from '@/components/notifications/NotificationsTab';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationsSheet = ({ open, onOpenChange }: NotificationsSheetProps) => {
  const { unreadCount, markAllAsRead } = useNotifications();

  useEffect(() => {
    if (!open) return;
    if (unreadCount <= 0) return;
    void markAllAsRead();
  }, [open, unreadCount, markAllAsRead]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col rounded-t-3xl border border-white/10 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="px-6 pt-2 pb-3 border-b border-white/10">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-base font-semibold">Bildirishnomalar</h2>
            {unreadCount > 0 && (
              <span className="bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <NotificationsTab />
        </div>
      </DrawerContent>
    </Drawer>
  );
};
