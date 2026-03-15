import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPct(value: number | null | undefined, fromDecimal = false): string {
  if (value == null) return '—';
  const v = fromDecimal ? value * 100 : value;
  return `${v.toFixed(1)}%`;
}

export function nullDash(value: any): string {
  if (value == null) return '—';
  return String(value);
}

export function useDashboardBI<T = any>(metric: string, csEmail?: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { metric };
      if (csEmail) params.cs_email_atual = csEmail;

      const { data: result, error: fnError } = await supabase.functions.invoke('bi-dashboard', {
        body: null,
        headers: {},
      });

      // supabase.functions.invoke doesn't support query params natively,
      // so we'll construct the URL manually
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bi-dashboard?metric=${metric}`;
      if (csEmail) url += `&cs_email_atual=${encodeURIComponent(csEmail)}`;

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data as T);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [metric, csEmail]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

// Status color mappings
export const STATUS_COLORS: Record<string, string> = {
  'Ativo': '#22c55e',
  'Cancelado': '#ef4444',
  'Risco por Engajamento': '#f97316',
  'Implantacao': '#3b82f6',
  'Sem status': '#6b7280',
};

export function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || '#9ca3af';
}
