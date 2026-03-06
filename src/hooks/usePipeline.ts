import { useState, useEffect, useCallback } from 'react';

const BASE_URL = 'https://us-central1-curseduca-inc-ia.cloudfunctions.net/hub-pipeline';
const AUTH_HEADER = 'Basic ' + btoa('curseduca:visao360@curseduca2026!');

async function pipelineFetch<T>(params: string): Promise<T> {
  const res = await fetch(`${BASE_URL}?${params}`, { headers: { Authorization: AUTH_HEADER } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ---- Types ----

export interface PipelineResumo {
  total_steps: number;
  total_runs: number;
  steps_sucesso: number;
  steps_erro: number;
  taxa_sucesso_pct: number;
  total_layers: number;
  total_steps_unicos: number;
  duracao_media_seg: number;
  duracao_max_seg: number;
  primeira_execucao: string;
  ultima_execucao: string;
  ultima_run_id: string;
  ultimo_step_status: string;
  erros_24h: number;
  erros_7d: number;
}

export interface PipelineRun {
  run_id: string;
  inicio: string;
  fim: string;
  duracao_total_seg: number;
  total_steps: number;
  ok: number;
  erros: number;
  status_run: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  layers: string;
}

export interface PipelineRunsData {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  rows: PipelineRun[];
}

export interface PipelineStep {
  layer: string;
  step: string;
  status: string;
  started_at: string;
  finished_at: string;
  duracao_seg: number;
  error_message: string | null;
}

export interface PipelineRunDetalhe {
  run_id: string;
  summary: {
    inicio: string;
    fim: string;
    duracao_total_seg: number;
    total_steps: number;
    ok: number;
    erros: number;
  };
  steps: PipelineStep[];
}

export interface PipelineErro {
  run_id: string;
  layer: string;
  step: string;
  started_at: string;
  finished_at: string;
  duracao_seg: number;
  error_message: string;
}

export interface PipelineErrosData {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  rows: PipelineErro[];
}

export interface PipelineTimelineDay {
  dia: string;
  runs: number;
  total_steps: number;
  ok: number;
  erros: number;
  duracao_media_seg: number;
  duracao_total_seg: number;
}

export interface PipelineStepHealth {
  step: string;
  layer: string;
  execucoes: number;
  ok: number;
  erros: number;
  taxa_sucesso_pct: number;
  duracao_media_seg: number;
  duracao_max_seg: number;
  ultima_execucao: string;
  ultimo_status: string;
  ultimo_erro: string | null;
}

// ---- Generic hook ----

function usePipelineData<T>(params: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await pipelineFetch<T>(params);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { refetch(); }, [refetch, ...deps]);

  return { data, loading, error, refetch };
}

// ---- Exported hooks ----

export function usePipelineResumo() {
  return usePipelineData<PipelineResumo>('metric=resumo');
}

export function usePipelineRuns(page = 1, perPage = 20) {
  return usePipelineData<PipelineRunsData>(`metric=runs&page=${page}&per_page=${perPage}`, [page]);
}

export function usePipelineRunDetalhe(runId: string | null) {
  const [data, setData] = useState<PipelineRunDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) { setData(null); return; }
    setLoading(true);
    setError(null);
    pipelineFetch<PipelineRunDetalhe>(`metric=run_detalhe&run_id=${runId}`)
      .then(setData)
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  return { data, loading, error };
}

export function usePipelineErros(page = 1, perPage = 50) {
  return usePipelineData<PipelineErrosData>(`metric=erros&page=${page}&per_page=${perPage}`, [page]);
}

export function usePipelineTimeline() {
  return usePipelineData<PipelineTimelineDay[]>('metric=timeline');
}

export function usePipelineStepsHealth() {
  return usePipelineData<PipelineStepHealth[]>('metric=steps_health');
}

// ---- Helpers ----

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

export function timeAgo(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `há ${Math.max(1, Math.floor(diff / 60000))}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function cleanStepName(step: string): string {
  return step.replace(/^[A-Z_ ]+ - /, '');
}
