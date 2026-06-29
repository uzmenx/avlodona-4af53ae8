import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationItem } from './NotificationItem';
import { GroupedNotificationItem } from './GroupedNotificationItem';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { PullToRefresh } from '@/components/feed/PullToRefresh';
import { isToday, isYesterday } from 'date-fns';
import { groupNotifications, type GroupedNotification } from './groupNotifications';

const partitionByDate = (notifications: Notification[]) => {
  const groups: Record<string, Notification[]> = { today: [], yesterday: [], earlier: [] };
  for (const n of notifications) {
    const d = new Date(n.created_at);
    if (isToday(d)) groups.today.push(n);
    else if (isYesterday(d)) groups.yesterday.push(n);
    else groups.earlier.push(n);
  }
  const result: { label: string; items: GroupedNotification[] }[] = [];
  if (groups.today.length)     result.push({ label: 'Bugun',    items: groupNotifications(groups.today) });
  if (groups.yesterday.length) result.push({ label: 'Kecha',    items: groupNotifications(groups.yesterday) });
  if (groups.earlier.length)   result.push({ label: 'Avvalroq', items: groupNotifications(groups.earlier) });
  return result;
};

export const NotificationsTab = () => {
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAsRead,
    markManyAsRead,
    markAllAsRead,
    deleteNotifications,
    unreadCount,
  } = useNotifications();

  const sections = partitionByDate(notifications);

  return (
    <div className="min-h-[50vh]">
      {unreadCount > 0 && (
        <div className="px-4 py-2 border-b border-border/10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{unreadCount}</span> ta yangi
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-foreground rounded-full px-3"
          >
            <Check className="h-3.5 w-3.5" />
            Barchasini o'qilgan deb belgilash
          </Button>
        </div>
      )}

      <PullToRefresh onRefresh={fetchNotifications}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 gap-4">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center border border-border/20">
              <Bell className="h-9 w-9 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Bildirishnomalar yo'q</p>
              <p className="text-sm text-muted-foreground mt-1">
                Yangi bildirishnomalar shu yerda ko'rinadi
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-3">
                💡 Maslahat: o'ng tomonga sursangiz o'qildi, chap tomonga sursangiz o'chiriladi
              </p>
            </div>
          </div>
        ) : (
          <div>
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-4 py-2 sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/10">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {section.label}
                  </span>
                </div>
                <div className="divide-y divide-border/10">
                  {section.items.map((item) =>
                    item.kind === 'single' ? (
                      <NotificationItem
                        key={item.notification.id}
                        notification={item.notification}
                        onRead={markAsRead}
                        onDelete={(id) => deleteNotifications([id])}
                      />
                    ) : (
                      <GroupedNotificationItem
                        key={item.key}
                        group={item}
                        onMarkRead={markManyAsRead}
                        onDelete={deleteNotifications}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
};
