import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useDashboardBI, formatBRL, formatNumber, nullDash } from '@/hooks/useDashboardBI';
import { RefreshCw, X, TrendingDown, TableIcon, BarChart3, Search, Loader2, ChevronUp, ChevronDown, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CSItem { cs_nome: string; cs_email: string; total: number; }

// Reuse types from BIChurnPage
interface ChurnDetalhe {
  id_curseduca: string; nome: string; contrato_status: string; plano: string; receita: number | null;
  status_financeiro: string | null; valor_inadimplente: number | null; falha_cobranca: boolean;
  dias_desde_ultimo_login: number | null; alerta_inatividade: boolean;
  membros_mes_atual: number | null; membros_mes_m1: number | null; variacao_membros: number | null;
  risco_churn: string | null; previsao_churn: string | null; motivo_churn_cs: string | null;
  cs_nome: string | null; cs_email: string | null; ultimo_nps: number | null; ultimo_csat: number | null;
  funil_renovacao_etapa: string | null;
  data_cancelamento?: string | null;
}
interface ChurnMotivo { motivo_cs: string; motivo_cliente: string; total: number; receita_perdida: number; }
interface ChurnCohort {
  status: string; total: number;
  media_m0: number | null; media_m1: number | null; media_m2: number | null; media_m3: number | null; media_m4: number | null;
  media_var_m0_m1: number | null; media_var_m1_m2: number | null; media_taxa_retencao: number | null;
}
interface ChurnOverview {
  total_ativos: number; churn_executado: number; com_falha_cobranca: number;
  inadimplentes_vindi: number; com_risco_churn: number; com_alerta_inatividade: number;
  com_stop_billing: number; com_bloqueio: number;
  inativos_30d: number; inativos_60d: number; inativos_90d: number;
  receita_em_risco: number; receita_total_ativos: number; total_inadimplente: number;
  media_dias_sem_login: number; media_variacao_membros: number;
}

const STATUS_LINE_COLORS: Record<string, string> = {
  ativo: '#22c55e', encerrado: '#ef4444', suspenso: '#f97316', sem_contrato: '#6b7280',
  ACTIVE: '#22c55e', BLOCK: '#ef4444', SUSPENDED: '#f97316', NO_CONTRACT: '#6b7280',
};

const extractName = (csNome: string, csEmail: string): string => {
  if (csNome && csNome !== 'CS') return csNome;
  if (!csEmail) return 'Sem CS';
  return csEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export default function ChurnPage() {
  const [csFilter, setCsFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: csOptions } = useDashboardBI<CSItem[]>('cs');
  const csEmail = csFilter || undefined;

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-destructive" />
            Churn
          </h1>
          <p className="text-sm text-muted-foreground">Análise de cancelamentos e risco de churn</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={csFilter} onValueChange={v => setCsFilter(v === '__clear__' ? '' : v)}>
            <SelectTrigger className="w-[220px] h-8 text-sm">
              <SelectValue placeholder="Filtrar por CS..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Todos os CSs</SelectItem>
              {(csOptions || []).filter(c => c.cs_email).map(cs => (
                <SelectItem key={cs.cs_email} value={cs.cs_email}>
                  {extractName(cs.cs_nome, cs.cs_email)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {csFilter && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs cursor-pointer" onClick={() => setCsFilter('')}>
              Filtro: {csFilter.split('@')[0]} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="tabela" className="text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />Tabela</TabsTrigger>
          <TabsTrigger value="graficos" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela"><ChurnTabelaTab csEmail={csEmail} /></TabsContent>
        <TabsContent value="graficos"><ChurnGraficosTab csEmail={csEmail} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tabela Tab ──
function ChurnTabelaTab({ csEmail }: { csEmail?: string }) {
  const { data: overview, loading: loadingOverview } = useDashboardBI<ChurnOverview>('churn_overview', csEmail);
  const { data, loading } = useDashboardBI<ChurnDetalhe[]>('churn_detalhe', csEmail);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof ChurnDetalhe>('receita');
  const [sortAsc, setSortAsc] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const perPage = 20;

  if (loading || loadingOverview) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  // KPI summary cards
  const kpis = [
    { label: 'Total Cancelados', value: overview?.churn_executado ?? 0, color: 'border-destructive/30 bg-destructive/5' },
    { label: 'Receita em Risco', value: formatBRL(overview?.receita_em_risco ?? 0), color: 'border-destructive/30 bg-destructive/5' },
    { label: 'Inadimplentes', value: overview?.inadimplentes_vindi ?? 0, color: 'border-orange-500/30 bg-orange-500/5' },
    { label: 'Com Risco de Churn', value: overview?.com_risco_churn ?? 0, color: 'border-orange-500/30 bg-orange-500/5' },
  ];

  const filtered = data.filter(r =>
    r.nome?.toLowerCase().includes(search.toLowerCase()) ||
    r.id_curseduca?.toLowerCase().includes(search.toLowerCase()) ||
    r.plano?.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
    if (va === '' && vb === '') return 0;
    if (va === '') return 1;
    if (vb === '') return -1;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);

  const toggleSort = (key: keyof ChurnDetalhe) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: keyof ChurnDetalhe }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className={cn('border', k.color)}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{typeof k.value === 'number' ? formatNumber(k.value) : k.value}</p>
              <span className="text-xs text-muted-foreground">{k.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Detalhamento de Churn ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowExtra(!showExtra)}>
              {showExtra ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {showExtra ? 'Menos colunas' : 'Mais colunas'}
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-8 max-w-xs h-8 text-sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>Cliente<SortIcon col="nome" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('plano')}>Plano<SortIcon col="plano" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>Receita<SortIcon col="receita" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('motivo_churn_cs')}>Motivo<SortIcon col="motivo_churn_cs" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('risco_churn')}>Risco<SortIcon col="risco_churn" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('dias_desde_ultimo_login')}>Dias s/ Login<SortIcon col="dias_desde_ultimo_login" /></TableHead>
                <TableHead>CS</TableHead>
                {showExtra && (
                  <>
                    <TableHead>Status Financeiro</TableHead>
                    <TableHead className="text-right">Vlr Inadimpl.</TableHead>
                    <TableHead className="text-right">Variação Membros</TableHead>
                    <TableHead>NPS</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm max-w-[200px] truncate" title={r.nome}>
                    <div className="flex items-center gap-1">
                      {r.alerta_inatividade && <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                      {r.nome || r.id_curseduca}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.plano || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{formatBRL(r.receita)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{r.motivo_churn_cs || '—'}</TableCell>
                  <TableCell>
                    {r.risco_churn ? <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px]" variant="outline">{r.risco_churn}</Badge> : '—'}
                  </TableCell>
                  <TableCell className={cn('text-right', r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login > 60 ? 'text-destructive font-medium' : '')}>
                    {r.dias_desde_ultimo_login ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{nullDash(r.cs_nome)}</TableCell>
                  {showExtra && (
                    <>
                      <TableCell>
                        {r.status_financeiro === 'inadimplente'
                          ? <Badge variant="destructive" className="text-[10px]">Inadimplente</Badge>
                          : <span className="text-xs">{r.status_financeiro || '—'}</span>}
                      </TableCell>
                      <TableCell className="text-right">{formatBRL(r.valor_inadimplente)}</TableCell>
                      <TableCell className="text-right">
                        {r.variacao_membros != null ? `${(r.variacao_membros * 100).toFixed(0)}%` : '—'}
                      </TableCell>
                      <TableCell>{r.ultimo_nps ?? '—'}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Anterior</button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Próxima</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Gráficos Tab ──
function ChurnGraficosTab({ csEmail }: { csEmail?: string }) {
  return (
    <div className="space-y-6">
      <ChurnKPIsSection csEmail={csEmail} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChurnMotivosChart csEmail={csEmail} />
        <ChurnCohortChart csEmail={csEmail} />
      </div>
    </div>
  );
}

function ChurnKPIsSection({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnOverview>('churn_overview', csEmail);
  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const riskPct = data.receita_total_ativos > 0 ? (data.receita_em_risco / data.receita_total_ativos) * 100 : 0;

  const cards = [
    { label: 'Receita em Risco', value: formatBRL(data.receita_em_risco), color: 'border-destructive/30 bg-destructive/5' },
    { label: 'Inadimplentes', value: formatNumber(data.inadimplentes_vindi), color: 'border-destructive/30 bg-destructive/5' },
    { label: 'Falha Cobrança', value: formatNumber(data.com_falha_cobranca), color: 'border-orange-500/30 bg-orange-500/5' },
    { label: 'Inativos 30d+', value: formatNumber(data.inativos_30d), color: 'border-orange-500/30 bg-orange-500/5' },
    { label: 'Inativos 60d+', value: formatNumber(data.inativos_60d), color: 'border-destructive/30 bg-destructive/5' },
    { label: 'Inativos 90d+', value: formatNumber(data.inativos_90d), color: 'border-destructive/30 bg-destructive/5' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <Card key={c.label} className={cn('border', c.color)}>
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-foreground">{c.value}</p>
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Receita em Risco / Receita Total</span>
            <span className="text-sm font-bold text-destructive">{riskPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-destructive" style={{ width: `${Math.min(riskPct, 100)}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{formatBRL(data.receita_em_risco)}</span>
            <span>{formatBRL(data.receita_total_ativos)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChurnMotivosChart({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnMotivo[]>('churn_motivos', csEmail);
  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data || data.length === 0) return null;

  const chartData = data.filter(d => d.motivo_cs !== 'Sem motivo CS').sort((a, b) => b.total - a.total);
  if (chartData.length === 0) return (
    <Card><CardHeader><CardTitle className="text-sm">Motivos de Churn</CardTitle></CardHeader>
      <CardContent><p className="text-muted-foreground text-sm">Nenhum motivo registrado.</p></CardContent></Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Motivos de Churn</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 40, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 120, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="motivo_cs" tick={{ fontSize: 11 }} width={110} />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Motivo CS</TableHead>
            <TableHead>Motivo Cliente</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Receita Perdida</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm">{r.motivo_cs}</TableCell>
                <TableCell className="text-sm">{r.motivo_cliente}</TableCell>
                <TableCell className="text-right">{formatNumber(r.total)}</TableCell>
                <TableCell className="text-right">{formatBRL(r.receita_perdida)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ChurnCohortChart({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnCohort[]>('churn_cohort', csEmail);
  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data || data.length === 0) return null;

  const periods = ['M4', 'M3', 'M2', 'M1', 'M0'];
  const chartData = periods.map((p, i) => {
    const key = `media_m${4 - i}` as keyof ChurnCohort;
    const point: Record<string, any> = { name: p };
    data.forEach(d => { point[d.status] = d[key]; });
    return point;
  });

  const retBadgeColor = (r: number | null) => {
    if (r == null) return 'bg-muted/50 text-muted-foreground border-muted';
    return r > 0.7 ? 'bg-green-500/10 text-green-600 border-green-500/30' : r > 0.4 ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-destructive/10 text-destructive border-destructive/30';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Evolução de Membros por Status</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.map(d => (
            <Badge key={d.status} variant="outline" className={cn('text-[10px]', retBadgeColor(d.media_taxa_retencao))}>
              {d.status}: {d.media_taxa_retencao != null ? `${(d.media_taxa_retencao * 100).toFixed(0)}% retenção` : 'N/A'}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {data.map(d => (
              <Line key={d.status} type="monotone" dataKey={d.status} stroke={STATUS_LINE_COLORS[d.status] || '#9ca3af'} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
