import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2, Gift, Heart, Star, Bell, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useFamilyCalendar, type FamilyEvent } from '@/hooks/useFamilyCalendar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const EVENT_TYPES = [
  { value: 'birthday', label: "Tug'ilgan kun", icon: Gift, color: 'text-pink-500' },
  { value: 'anniversary', label: 'Yubiley', icon: Star, color: 'text-amber-500' },
  { value: 'memorial', label: 'Xotira kuni', icon: Heart, color: 'text-blue-500' },
  { value: 'custom', label: 'Boshqa', icon: CalendarDays, color: 'text-emerald-500' },
];

const EventCard = ({ event, onDelete, canDelete }: { event: FamilyEvent; onDelete: () => void; canDelete: boolean }) => {
  const { t } = useLanguage();
  const EVENT_TYPES_LOCAL = [
    { value: 'birthday', label: t('bornYear'), icon: Gift, color: 'text-pink-500' },
    { value: 'anniversary', label: t('relative'), icon: Star, color: 'text-amber-500' }, // Use existing translations where needed or mapping
    { value: 'memorial', label: t('memorialTab'), icon: Heart, color: 'text-blue-500' },
    { value: 'custom', label: t('other', { defaultValue: 'Boshqa' }), icon: CalendarDays, color: 'text-emerald-500' },
  ];
  const type = EVENT_TYPES_LOCAL.find(t => t.value === event.event_type) || EVENT_TYPES_LOCAL[3];
  const Icon = type.icon;
  const d = new Date(event.event_date);
  const dateStr = `${d.getDate()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-card/50 border border-border/30 backdrop-blur-sm">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-muted/50', type.color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{event.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{dateStr}</span>
          {event.member_name && <span className="text-xs text-primary">• {event.member_name}</span>}
          {event.recurring && <Badge variant="secondary" className="text-[9px] px-1 py-0">{t('everyYear')}</Badge>}
          {event.owner_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
               <User className="h-2.5 w-2.5" /> {event.owner_name}
            </span>
          )}
        </div>
        {event.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.description}</p>}
      </div>
      {canDelete && (
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export const FamilyCalendarSheet = () => {
  const { user } = useAuth();
  const { events, addEvent, deleteEvent, getTodayEvents, getUpcomingEvents } = useFamilyCalendar();
  const { t } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventType, setEventType] = useState('birthday');
  const [recurring, setRecurring] = useState(true);

  const EVENT_TYPES_FORM = [
    { value: 'birthday', label: t('bornYear'), icon: Gift },
    { value: 'anniversary', label: t('relative') },
    { value: 'memorial', label: t('memorialTab') },
    { value: 'custom', label: t('other', { defaultValue: 'Boshqa' }) },
  ];

  const todayEvents = getTodayEvents();
  const upcomingEvents = getUpcomingEvents(30);

  useEffect(() => {
    if (!user?.id) return;
    if (todayEvents.length === 0) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const storageKey = `avlodona:calendar-reminded:${todayKey}`;

    const run = async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        const sent = new Set<string>(raw ? JSON.parse(raw) : []);

        const toSend = todayEvents.filter(e => e.notify !== false && !sent.has(e.id));
        if (toSend.length === 0) return;

        const rows = toSend.map(e => ({
          user_id: user.id,
          actor_id: user.id,
          type: 'calendar_event',
          post_id: null,
          comment_id: null,
          message_id: null,
          is_read: false,
        }));

        await supabase.from('notifications').insert(rows as any);

        toSend.forEach(e => sent.add(e.id));
        localStorage.setItem(storageKey, JSON.stringify(Array.from(sent)));
      } catch {
        // ignore
      }
    };

    void run();
  }, [todayEvents, user?.id]);

  const handleAdd = async () => {
    if (!title.trim() || !eventDate) return;
    await addEvent({ title: title.trim(), description: description.trim() || undefined, event_date: eventDate, event_type: eventType, recurring });
    setTitle(''); setDescription(''); setEventDate(''); setShowAdd(false);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl bg-card/50 backdrop-blur-sm border border-border/30">
          <CalendarDays className="h-4 w-4" />
          {todayEvents.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center text-[9px] text-destructive-foreground font-bold">
              {todayEvents.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-3">
          <SheetTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t('familyCalendar')}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-full pb-20">
          <div className="space-y-4">
            {/* Today */}
            {todayEvents.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Bell className="h-3 w-3" /> {t('today')}
                </h3>
                <div className="space-y-2">
                  {todayEvents.map(e => <EventCard key={e.id} event={e} canDelete={e.owner_id === user?.id} onDelete={() => deleteEvent(e.id)} />)}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcomingEvents.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('next30days')}</h3>
                <div className="space-y-2">
                  {upcomingEvents.map(e => <EventCard key={e.id} event={e} canDelete={e.owner_id === user?.id} onDelete={() => deleteEvent(e.id)} />)}
                </div>
              </div>
            )}

            {/* All events */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="px-3 h-7 inline-flex items-center rounded-full bg-muted/40 border border-border/40 backdrop-blur-sm">
                  <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {t('allEvents')} ({events.length})
                  </h3>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAdd(!showAdd)}
                  className="rounded-full h-8 px-4 text-xs gap-1.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-300/40 dark:shadow-emerald-500/20 hover:brightness-105 active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t('addEvent')}
                </Button>
              </div>

              {showAdd && (
                <div className="p-3 rounded-2xl bg-card border border-border/50 space-y-3 mb-3">
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('eventTitle')} className="rounded-xl" />
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('eventNote')} rows={2} className="rounded-xl resize-none" />
                  <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="rounded-xl" />
                  <div className="flex gap-2 flex-wrap">
                    {EVENT_TYPES_FORM.map(t_item => {
                      const baseType = EVENT_TYPES.find(o => o.value === t_item.value) || EVENT_TYPES[3];
                      const IconComponent = baseType.icon;
                      return (
                        <button key={t_item.value} onClick={() => setEventType(t_item.value)}
                          className={cn('flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            eventType === t_item.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}>
                          <IconComponent className="h-3 w-3" /> {t_item.label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="rounded" />
                    {t('repeatYearly')}
                  </label>
                  <Button onClick={handleAdd} disabled={!title.trim() || !eventDate} className="w-full rounded-xl">
                    {t('save')}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {events.map(e => <EventCard key={e.id} event={e} canDelete={e.owner_id === user?.id} onDelete={() => deleteEvent(e.id)} />)}
                {events.length === 0 && !showAdd && (
                  <p className="text-center text-sm text-muted-foreground py-8">{t('noEventsYet')}</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
