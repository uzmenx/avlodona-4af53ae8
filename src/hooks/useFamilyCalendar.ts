import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface FamilyEvent {
  id: string;
  owner_id: string;
  member_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  recurring: boolean;
  notify: boolean;
  created_at: string;
  member_name?: string;
}

export const useFamilyCalendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('family_events')
        .select('*')
        .eq('owner_id', user.id)
        .order('event_date', { ascending: true });

      if (data && data.length > 0) {
        const memberIds = data.filter(d => d.member_id).map(d => d.member_id!);
        let memberMap = new Map<string, string>();
        if (memberIds.length > 0) {
          const { data: members } = await supabase
            .from('family_tree_members')
            .select('id, member_name')
            .in('id', memberIds);
          memberMap = new Map((members || []).map(m => [m.id, m.member_name]));
        }
        setEvents(data.map(d => ({ ...d, member_name: d.member_id ? memberMap.get(d.member_id) : undefined })));
      } else {
        setEvents([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const addEvent = useCallback(async (event: {
    title: string; description?: string; event_date: string;
    event_type: string; member_id?: string; recurring?: boolean; notify?: boolean;
  }) => {
    if (!user?.id) return;
    await supabase.from('family_events').insert({
      owner_id: user.id,
      title: event.title,
      description: event.description || null,
      event_date: event.event_date,
      event_type: event.event_type,
      member_id: event.member_id || null,
      recurring: event.recurring ?? true,
      notify: event.notify ?? true,
    });
    fetchEvents();
  }, [user?.id, fetchEvents]);

  const deleteEvent = useCallback(async (id: string) => {
    await supabase.from('family_events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const getTodayEvents = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => {
      if (e.event_date === today) return true;
      if (e.recurring) {
        const eventDate = new Date(e.event_date);
        const now = new Date();
        return eventDate.getMonth() === now.getMonth() && eventDate.getDate() === now.getDate();
      }
      return false;
    });
  }, [events]);

  const getUpcomingEvents = useCallback((days = 30) => {
    const now = new Date();
    const end = new Date(now.getTime() + days * 86400000);
    return events.filter(e => {
      const d = new Date(e.event_date);
      if (e.recurring) {
        const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        return thisYear >= now && thisYear <= end;
      }
      return d >= now && d <= end;
    });
  }, [events]);

  return { events, isLoading, addEvent, deleteEvent, getTodayEvents, getUpcomingEvents, refetch: fetchEvents };
};
