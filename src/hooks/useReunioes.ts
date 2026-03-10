import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const FUNCTION_NAME = 'proxy-hub-reunioes';

export interface CalendarEvent {
  event_id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  hangout_link: string;
  location: string;
  html_link: string;
  attendees: { email: string; responseStatus: string }[];
}

interface CreateEventPayload {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timezone?: string;
}

interface UpdateEventPayload {
  event_id: string;
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  timezone?: string;
}

async function apiCall<T = any>(
  action: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, any>,
  extraParams?: Record<string, string>,
): Promise<T> {
  const session = (await supabase.auth.getSession()).data.session;
  const params = new URLSearchParams({ action, ...(extraParams || {}) });
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${FUNCTION_NAME}?${params.toString()}`;

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${session?.access_token || ''}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
  };

  if (method === 'POST' && body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json as T;
}

export function useReunioes() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async (maxResults = 50) => {
    setSyncing(true);
    try {
      const data = await apiCall<{ count: number; events: CalendarEvent[] }>(
        'list',
        'GET',
        undefined,
        { max_results: String(maxResults) },
      );
      setEvents(data.events || []);
      return data.events || [];
    } catch (err: any) {
      toast.error('Erro ao sincronizar reuniões: ' + err.message);
      return [];
    } finally {
      setSyncing(false);
    }
  }, []);

  const createEvent = useCallback(async (payload: CreateEventPayload) => {
    setLoading(true);
    try {
      const data = await apiCall<{ message: string; event_id: string; html_link: string }>(
        'create',
        'POST',
        { ...payload, timezone: payload.timezone || 'America/Sao_Paulo' },
      );
      toast.success('Reunião criada no Google Calendar!');
      await sync();
      return data;
    } catch (err: any) {
      toast.error('Erro ao criar reunião: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sync]);

  const updateEvent = useCallback(async (payload: UpdateEventPayload) => {
    setLoading(true);
    try {
      const data = await apiCall<{ message: string; event_id: string; html_link: string }>(
        'update',
        'POST',
        payload,
      );
      toast.success('Reunião atualizada no Google Calendar!');
      await sync();
      return data;
    } catch (err: any) {
      toast.error('Erro ao atualizar reunião: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sync]);

  const deleteEvent = useCallback(async (eventId: string) => {
    setLoading(true);
    try {
      const data = await apiCall<{ message: string; event_id: string }>(
        'delete',
        'POST',
        { event_id: eventId },
      );
      toast.success('Reunião removida do Google Calendar!');
      await sync();
      return data;
    } catch (err: any) {
      toast.error('Erro ao deletar reunião: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sync]);

  return {
    events,
    loading,
    syncing,
    sync,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
