import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationItem } from './NotificationItem';
import { useNotifications } from '@/hooks/useNotifications';
import { PullToRefresh } from '@/components/feed/PullToRefresh';

export const NotificationsTab = () => {
  const { 
    notifications, 
    isLoading, 
    fetchNotifications, 
    markAsRead, 
    markAllAsRead,
    unreadCount 
  } = useNotifications();

  return (
    <div className="min-h-[50vh]">
      {/* Header with mark all read */}
      {unreadCount > 0 && (
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {unreadCount} ta yangi bildirishnoma
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="gap-1"
          >
            <Check className="h-4 w-4" />
            Barchasini o'qilgan deb belgilash
          </Button>
        </div>
      )}

      <PullToRefresh onRefresh={fetchNotifications}>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Yuklanmoqda...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">Bildirishnomalar yo'q</p>
            <p className="text-sm text-muted-foreground mt-1">
              Yangi bildirishnomalar shu yerda ko'rinadi
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
              />
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
};
