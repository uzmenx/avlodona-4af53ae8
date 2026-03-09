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
  owner_name?: string;
}

export const useFamilyCalendar = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [networkUserIds, setNetworkUserIds] = useState<string[]>([]);

  // Fetch family network user IDs (all users sharing the same family_network_id)
  const fetchNetworkUsers = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Get current user's family_network_id
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('family_network_id')
        .eq('id', user.id)
        .single();

      if (myProfile?.family_network_id) {
        // Get all users in the same network
        const { data: networkProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('family_network_id', myProfile.family_network_id);

        const ids = (networkProfiles || []).map(p => p.id);
        if (!ids.includes(user.id)) ids.push(user.id);
        setNetworkUserIds(ids);
        return ids;
      } else {
        setNetworkUserIds([user.id]);
        return [user.id];
      }
    } catch {
      setNetworkUserIds([user.id]);
      return [user.id];
    }
  }, [user?.id]);

  const fetchEvents = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const userIds = await fetchNetworkUsers() || [user.id];

      const { data } = await supabase
        .from('family_events')
        .select('*')
        .in('owner_id', userIds)
        .order('event_date', { ascending: true });

      if (data && data.length > 0) {
        // Fetch member names
        const memberIds = data.filter(d => d.member_id).map(d => d.member_id!);
        let memberMap = new Map<string, string>();
        if (memberIds.length > 0) {
          const { data: members } = await supabase
            .from('family_tree_members')
            .select('id, member_name')
            .in('id', memberIds);
          memberMap = new Map((members || []).map(m => [m.id, m.member_name]));
        }

        // Fetch owner names
        const ownerIds = [...new Set(data.map(d => d.owner_id))];
        let ownerMap = new Map<string, string>();
        if (ownerIds.length > 0) {
          const { data: owners } = await supabase
            .from('profiles')
            .select('id, name, username')
            .in('id', ownerIds);
          ownerMap = new Map((owners || []).map(o => [o.id, o.name || o.username || '']));
        }

        setEvents(data.map(d => ({
          ...d,
          member_name: d.member_id ? memberMap.get(d.member_id) : undefined,
          owner_name: d.owner_id !== user.id ? ownerMap.get(d.owner_id) : undefined,
        })));
      } else {
        setEvents([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, fetchNetworkUsers]);

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
