import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const BASE_URL = 'https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-reunioes';
const AUTH_HEADER = import.meta.env.VITE_HUB_API_AUTH || 'Basic Y3Vyc2VkdWNhOnZpc2FvMzYwQGN1cnNlZHVjYTIwMjYh';

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
  const url = new URL(BASE_URL);
  url.searchParams.set('action', action);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
  }

  const options: RequestInit = {
    method,
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json',
    },
  };

  if (method === 'POST' && body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url.toString(), options);
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
