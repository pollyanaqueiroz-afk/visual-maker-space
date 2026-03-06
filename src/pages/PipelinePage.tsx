import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, TrendingUp, CheckCircle, XCircle, AlertTriangle, ChevronLeft, ChevronRight, Play, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import {
  usePipelineResumo, usePipelineRuns, usePipelineErros, usePipelineTimeline,
  usePipelineStepsHealth, usePipelineRunDetalhe,
  formatDuration, timeAgo, cleanStepName,
  type PipelineRun, type PipelineStep,
} from '@/hooks/usePipeline';

// ── Layer badge colors ──
const LAYER_COLORS: Record<string, { bg: string; text: string }> = {
  RAW: { bg: '#EFF6FF', text: '#3B82F6' },
  BRONZE: { bg: '#FFFBEB', text: '#F59E0B' },
  SILVER: { bg: '#F3F4F6', text: '#6B7280' },
  'SILVER DDL': { bg: '#F3F4F6', text: '#6B7280' },
  GOLD: { bg: '#FEF9C3', text: '#EAB308' },
  'GOLD DDL': { bg: '#FEF9C3', text: '#EAB308' },
  PIPELINE: { bg: '#F5F3FF', text: '#8B5CF6' },
  TEST: { bg: '#FDF2F8', text: '#EC4899' },
};

function LayerBadge({ layer }: { layer: string }) {
  const c = LAYER_COLORS[layer] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <Badge variant="outline" className="border-0 font-medium text-xs" style={{ backgroundColor: c.bg, color: c.text }}>
      {layer}
    </Badge>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    SUCCESS: { bg: '#F0FDF4', text: '#22C55E', label: '✅ OK' },
    PARTIAL: { bg: '#FFFBEB', text: '#F59E0B', label: '⚠️ Parcial' },
    FAILED: { bg: '#FEF2F2', text: '#EF4444', label: '❌ Falha' },
  };
  const c = map[status] || map.FAILED;
  return (
    <Badge variant="outline" className="border-0 font-medium text-xs" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.label}
    </Badge>
  );
}

// ── KPI Card ──
function KpiCard({ icon: Icon, label, value, subtitle, bg, iconColor, loading }: {
  icon: React.ElementType; label: string; value: string | number;
  subtitle?: string; bg: string; iconColor: string; loading: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm" style={{ backgroundColor: bg }}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${iconColor}20` }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          )}
          {subtitle && !loading && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Timeline Chart ──
function TimelineChart({ loading }: { loading: boolean }) {
  const { data } = usePipelineTimeline();
  if (loading || !data) return <Skeleton className="h-64 w-full" />;

  const chartData = data.map(d => ({
    dia: format(new Date(d.dia), 'dd/MM'),
    OK: d.ok,
    Erros: d.erros,
    runs: d.runs,
    duracao: d.duracao_total_seg,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Timeline de Execuções</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
                    <p className="font-semibold">{label}</p>
                    <p className="text-green-600">{d.OK} steps OK</p>
                    <p className="text-red-500">{d.Erros} erros</p>
                    <p className="text-muted-foreground">{d.runs} runs · {formatDuration(d.duracao)} total</p>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="OK" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Erros" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Tab Execuções ──
function RunsTab() {
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data, loading } = usePipelineRuns(page);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>OK</TableHead>
                  <TableHead>Erros</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Layers</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : !data?.rows?.length ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma execução encontrada</TableCell></TableRow>
                ) : data.rows.map(run => (
                  <TableRow key={run.run_id}>
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(run.inicio), 'dd/MM HH:mm')}</TableCell>
                    <TableCell className="text-sm">{formatDuration(run.duracao_total_seg)}</TableCell>
                    <TableCell className="text-sm">{run.total_steps}</TableCell>
                    <TableCell className="text-sm text-green-600 font-medium">{run.ok}</TableCell>
                    <TableCell className="text-sm">{run.erros > 0 ? <span className="text-red-500 font-medium">{run.erros}</span> : '—'}</TableCell>
                    <TableCell><RunStatusBadge status={run.status_run} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {run.layers.split(',').map(l => <LayerBadge key={l} layer={l.trim()} />)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedRunId(run.run_id)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Página {data.page} de {data.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Próxima <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}

      <RunDetailModal runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </>
  );
}

// ── Run Detail Modal ──
function RunDetailModal({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { data, loading } = usePipelineRunDetalhe(runId);

  return (
    <Dialog open={!!runId} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhe da Execução</DialogTitle>
        </DialogHeader>

        {loading ? <Skeleton className="h-40 w-full" /> : data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div><p className="text-xs text-muted-foreground">Início</p><p className="text-sm font-medium">{format(new Date(data.summary.inicio), 'dd/MM HH:mm')}</p></div>
              <div><p className="text-xs text-muted-foreground">Duração</p><p className="text-sm font-medium">{formatDuration(data.summary.duracao_total_seg)}</p></div>
              <div><p className="text-xs text-muted-foreground">Steps OK</p><p className="text-sm font-medium text-green-600">{data.summary.ok}</p></div>
              <div><p className="text-xs text-muted-foreground">Erros</p><p className="text-sm font-medium text-red-500">{data.summary.erros}</p></div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Layer</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.steps.map((s, i) => (
                    <>
                      <TableRow key={i} className={s.status === 'ERROR' ? 'bg-red-50' : ''}>
                        <TableCell className="text-sm whitespace-nowrap">{format(new Date(s.started_at), 'HH:mm:ss')}</TableCell>
                        <TableCell><LayerBadge layer={s.layer} /></TableCell>
                        <TableCell className="text-sm">{cleanStepName(s.step)}</TableCell>
                        <TableCell className="text-sm">{s.status === 'SUCCESS' ? '✅' : '❌'}</TableCell>
                        <TableCell className="text-sm">{formatDuration(s.duracao_seg)}</TableCell>
                      </TableRow>
                      {s.error_message && (
                        <TableRow key={`${i}-err`} className="bg-red-50">
                          <TableCell colSpan={5} className="text-xs text-red-600 py-1 pl-8 font-mono break-all">
                            {s.error_message}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : <p className="text-muted-foreground py-8 text-center">Erro ao carregar detalhes</p>}
      </DialogContent>
    </Dialog>
  );
}

// ── Tab Erros ──
function ErrosTab() {
  const [page, setPage] = useState(1);
  const { data, loading } = usePipelineErros(page);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Layer</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : !data?.rows?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum erro encontrado 🎉</TableCell></TableRow>
                ) : data.rows.map((err, i) => (
                  <TableRow key={i} className="bg-red-50/50">
                    <TableCell className="whitespace-nowrap text-sm">{format(new Date(err.started_at), 'dd/MM HH:mm')}</TableCell>
                    <TableCell><LayerBadge layer={err.layer} /></TableCell>
                    <TableCell className="text-sm">{cleanStepName(err.step)}</TableCell>
                    <TableCell className="text-sm">{formatDuration(err.duracao_seg)}</TableCell>
                    <TableCell className="text-sm max-w-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate font-mono text-xs text-red-600 cursor-help">{err.error_message}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-md">
                          <p className="text-xs font-mono break-all">{err.error_message}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">Página {data.page} de {data.pages} · {data.total} erros</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Próxima <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab Saúde dos Steps ──
function StepsHealthTab() {
  const { data, loading } = usePipelineStepsHealth();

  const barColor = (pct: number) => pct >= 100 ? '#22C55E' : pct >= 80 ? '#F59E0B' : '#EF4444';

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Step</TableHead>
                <TableHead>Layer</TableHead>
                <TableHead>Execuções</TableHead>
                <TableHead>Taxa Sucesso</TableHead>
                <TableHead>Duração Média</TableHead>
                <TableHead>Último</TableHead>
                <TableHead>Último Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : !data?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Sem dados</TableCell></TableRow>
              ) : data.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{cleanStepName(s.step)}</TableCell>
                  <TableCell><LayerBadge layer={s.layer} /></TableCell>
                  <TableCell className="text-sm">{s.execucoes}</TableCell>
                  <TableCell className="min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.taxa_sucesso_pct, 100)}%`, backgroundColor: barColor(s.taxa_sucesso_pct) }} />
                      </div>
                      <span className="text-xs font-medium w-10 text-right" style={{ color: barColor(s.taxa_sucesso_pct) }}>
                        {s.taxa_sucesso_pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDuration(s.duracao_media_seg)}</TableCell>
                  <TableCell className="text-sm">{s.ultimo_status === 'SUCCESS' ? '✅' : '❌'}</TableCell>
                  <TableCell className="text-sm max-w-[200px]">
                    {s.ultimo_erro ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate font-mono text-xs text-red-600 cursor-help">{s.ultimo_erro}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-md">
                          <p className="text-xs font-mono break-all">{s.ultimo_erro}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function PipelinePage() {
  const { data: resumo, loading: loadingResumo, refetch } = usePipelineResumo();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refetch, 120_000);
    return () => clearInterval(id);
  }, [autoRefresh, refetch]);

  const taxaBg = (resumo?.taxa_sucesso_pct ?? 100) >= 90 ? '#F0FDF4' : '#FEF2F2';
  const taxaColor = (resumo?.taxa_sucesso_pct ?? 100) >= 90 ? '#16A34A' : '#DC2626';
  const erros24hBg = (resumo?.erros_24h ?? 0) > 0 ? '#FEF2F2' : '#F0FDF4';
  const erros24hColor = (resumo?.erros_24h ?? 0) > 0 ? '#DC2626' : '#16A34A';
  const erros24hSub = resumo ? (resumo.erros_24h === 0 ? 'Sem erros nas últimas 24h ✅' : `${resumo.erros_24h} erro(s) nas últimas 24h ⚠️`) : undefined;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-muted-foreground" /> Pipeline Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Última execução: {timeAgo(resumo?.ultima_execucao)} · Duração média: {formatDuration(resumo?.duracao_media_seg)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <KpiCard icon={Activity} label="Total Runs" value={resumo?.total_runs ?? 0} bg="#F1F5F9" iconColor="#334155" loading={loadingResumo} />
        <KpiCard icon={TrendingUp} label="Taxa Sucesso" value={`${resumo?.taxa_sucesso_pct?.toFixed(1) ?? 0}%`} subtitle={erros24hSub} bg={taxaBg} iconColor={taxaColor} loading={loadingResumo} />
        <KpiCard icon={CheckCircle} label="Steps OK" value={resumo?.steps_sucesso ?? 0} bg="#EFF6FF" iconColor="#2563EB" loading={loadingResumo} />
        <KpiCard icon={XCircle} label="Erros Total" value={resumo?.steps_erro ?? 0} bg="#FEF2F2" iconColor="#DC2626" loading={loadingResumo} />
        <KpiCard icon={AlertTriangle} label="Erros 24h" value={resumo?.erros_24h ?? 0} bg={erros24hBg} iconColor={erros24hColor} loading={loadingResumo} />
      </div>

      {/* Timeline Chart */}
      <TimelineChart loading={loadingResumo} />

      {/* Tabs */}
      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Execuções</TabsTrigger>
          <TabsTrigger value="erros">Erros</TabsTrigger>
          <TabsTrigger value="health">Saúde dos Steps</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="mt-4"><RunsTab /></TabsContent>
        <TabsContent value="erros" className="mt-4"><ErrosTab /></TabsContent>
        <TabsContent value="health" className="mt-4"><StepsHealthTab /></TabsContent>
      </Tabs>
    </div>
  );
}
