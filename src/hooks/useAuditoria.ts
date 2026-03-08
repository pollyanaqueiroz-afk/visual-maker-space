import { useState, useEffect, useCallback, useRef } from 'react';

const BASE_URL = 'https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-auditoria';
const AUTH_HEADER = import.meta.env.VITE_HUB_API_AUTH || '';

export interface AuditoriaResumo {
  total_plataformas: number;
  id_curseduca_vazio: number;
  id_curseduca_ok: number;
  com_email: number;
  com_vindi_id: number;
  com_origem: number;
}

export interface AuditoriaRow {
  id_curseduca: string | null;
  criado_em: string | null;
  criado_origem: string | null;
  nome_plataforma: string | null;
  nome_cliente: string | null;
  email: string | null;
  vindi_customer_id: string | null;
  billing_origin: string | null;
  status_plataforma: string | null;
  plano: string | null;
  platform_uuid: string | null;
}

export interface AuditoriaListData {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  rows: AuditoriaRow[];
}

export function useAuditoriaResumo() {
  const [data, setData] = useState<AuditoriaResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}?metric=resumo`, { headers: { Authorization: AUTH_HEADER } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { data, loading, error };
}

export function useAuditoriaList(search: string, page: number, perPage = 100) {
  const [data, setData] = useState<AuditoriaListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchData = useCallback(async (s: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      let url = `${BASE_URL}?metric=id_curseduca_vazio&page=${p}&per_page=${perPage}`;
      if (s) url += `&search=${encodeURIComponent(s)}`;
      const res = await fetch(url, { headers: { Authorization: AUTH_HEADER } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchData(search, page), search ? 400 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, page, fetchData]);

  return { data, loading, error };
}
