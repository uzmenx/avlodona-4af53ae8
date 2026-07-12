import { useEffect } from 'react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { NotificationsTab } from '@/components/notifications/NotificationsTab';
import { useNotifications } from '@/hooks/useNotifications';
import { useLanguage } from '@/contexts/LanguageContext';

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationsSheet = ({ open, onOpenChange }: NotificationsSheetProps) => {
  const { unreadCount, markAllAsRead } = useNotifications();
  const { t } = useLanguage();

  useEffect(() => {
    if (!open) return;
    if (unreadCount <= 0) return;
    void markAllAsRead();
  }, [open, unreadCount, markAllAsRead]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh] flex flex-col rounded-t-[32px] border-t border-white/20 dark:border-white/5 bg-background/80 dark:bg-slate-950/80 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)] overflow-hidden">
        {/* Ambient glow backgrounds */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-violet-500/15 dark:bg-violet-500/10 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-sky-500/15 dark:bg-sky-500/10 blur-[80px] pointer-events-none" />

        <div className="px-6 pt-3 pb-3 border-b border-foreground/5 relative z-10">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-base font-bold tracking-wide">{t('notifications')}</h2>
            {unreadCount > 0 && (
              <span className="bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
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
