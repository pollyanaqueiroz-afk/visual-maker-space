import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useDashboardBI, formatBRL, formatNumber, formatPct, nullDash } from '@/hooks/useDashboardBI';
import { Loader2, ChevronUp, ChevronDown, ArrowDown, ArrowUp, AlertTriangle, DollarSign, UserMinus, Clock, Users, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { Button } from '@/components/ui/button';

// ── Types ──
interface ChurnOverview {
  total_ativos: number; churn_executado: number; com_falha_cobranca: number;
  inadimplentes_vindi: number; com_risco_churn: number; com_alerta_inatividade: number;
  com_stop_billing: number; com_bloqueio: number;
  inativos_30d: number; inativos_60d: number; inativos_90d: number;
  receita_em_risco: number; receita_total_ativos: number; total_inadimplente: number;
  media_dias_sem_login: number; media_variacao_membros: number;
}
interface ChurnMotivo { motivo_cs: string; motivo_cliente: string; total: number; receita_perdida: number; }
interface ChurnCohort {
  status: string; total: number;
  media_m0: number; media_m1: number; media_m2: number; media_m3: number; media_m4: number;
  media_var_m0_m1: number; media_var_m1_m2: number; media_taxa_retencao: number;
}
interface ChurnDetalhe {
  id_curseduca: string; nome: string; contrato_status: string; plano: string; receita: number | null;
  status_financeiro: string | null; valor_inadimplente: number | null; falha_cobranca: boolean;
  dias_desde_ultimo_login: number | null; alerta_inatividade: boolean;
  membros_mes_atual: number | null; membros_mes_m1: number | null; variacao_membros: number | null;
  risco_churn: string | null; previsao_churn: string | null; motivo_churn_cs: string | null;
  cs_nome: string | null; cs_email: string | null; ultimo_nps: number | null; ultimo_csat: number | null;
  funil_renovacao_etapa: string | null;
}

const STATUS_LINE_COLORS: Record<string, string> = {
  ativo: '#22c55e', encerrado: '#ef4444', suspenso: '#f97316', sem_contrato: '#6b7280',
};

export default function BIChurnPage({ csEmail }: { csEmail?: string }) {
  return (
    <div className="space-y-6">
      <ChurnKPIs csEmail={csEmail} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChurnMotivos csEmail={csEmail} />
        <ChurnCohortChart csEmail={csEmail} />
      </div>
      <ChurnDetalheTable csEmail={csEmail} />
    </div>
  );
}

// ── 7.1 KPI Cards ──
function ChurnKPIs({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnOverview>('churn_overview', csEmail);
  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const riskPct = data.receita_total_ativos > 0 ? (data.receita_em_risco / data.receita_total_ativos) * 100 : 0;
  const varColor = data.media_variacao_membros >= 0 ? 'text-green-500' : 'text-destructive';

  const row1 = [
    { label: 'Receita em Risco', value: formatBRL(data.receita_em_risco), color: 'border-destructive/30 bg-destructive/5', icon: DollarSign },
    { label: 'Inadimplentes', value: formatNumber(data.inadimplentes_vindi), color: 'border-destructive/30 bg-destructive/5', icon: ShieldAlert },
    { label: 'Falha Cobrança', value: formatNumber(data.com_falha_cobranca), color: 'border-orange-500/30 bg-orange-500/5', icon: AlertTriangle },
    { label: 'Inativos 30d+', value: formatNumber(data.inativos_30d), color: 'border-orange-500/30 bg-orange-500/5', icon: Clock },
    { label: 'Alerta Inatividade', value: formatNumber(data.com_alerta_inatividade), color: 'border-orange-500/30 bg-orange-500/5', icon: AlertTriangle },
  ];
  const row2 = [
    { label: 'Inativos 60d+', value: formatNumber(data.inativos_60d), color: 'border-destructive/30 bg-destructive/5', icon: Clock },
    { label: 'Inativos 90d+', value: formatNumber(data.inativos_90d), color: 'border-destructive/30 bg-destructive/5', icon: UserMinus },
    { label: 'Média dias s/ login', value: data.media_dias_sem_login != null ? `${data.media_dias_sem_login.toFixed(1)} dias` : '—', color: 'border-muted bg-muted/30', icon: Clock },
    { label: 'Variação membros', value: data.media_variacao_membros != null ? `${(data.media_variacao_membros * 100).toFixed(1)}%` : '—', color: 'border-muted bg-muted/30', icon: Users, extraClass: varColor },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {row1.map(c => (
          <Card key={c.label} className={cn('border', c.color)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className="text-xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {row2.map(c => (
          <Card key={c.label} className={cn('border', c.color)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{c.label}</span>
              </div>
              <p className={cn('text-xl font-bold', c.extraClass)}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Risk ratio bar */}
      <Card className="border-destructive/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Receita em Risco / Receita Total</span>
            <span className="text-sm font-bold text-destructive">{riskPct.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(riskPct, 100)} className="h-3 [&>div]:bg-destructive" />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{formatBRL(data.receita_em_risco)}</span>
            <span>{formatBRL(data.receita_total_ativos)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 7.2 Motivos ──
function ChurnMotivos({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnMotivo[]>('churn_motivos', csEmail);
  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data || data.length === 0) return null;

  const allEmpty = data.every(d => d.motivo_cs === 'Sem motivo CS');
  if (allEmpty) {
    return (
      <Card className="border-muted">
        <CardHeader><CardTitle className="text-sm">Motivos de Churn</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm">Nenhum motivo de churn registrado pelo CS.</p></CardContent>
      </Card>
    );
  }

  const chartData = data.filter(d => d.motivo_cs !== 'Sem motivo CS').sort((a, b) => b.total - a.total);

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
            <Bar dataKey="total" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motivo CS</TableHead>
              <TableHead>Motivo Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Receita Perdida</TableHead>
            </TableRow>
          </TableHeader>
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

// ── 7.3 Cohort ──
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

  const retBadgeColor = (r: number) => r > 0.7 ? 'bg-green-500/10 text-green-600 border-green-500/30' : r > 0.4 ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' : 'bg-destructive/10 text-destructive border-destructive/30';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Evolução de Membros por Status</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          {data.map(d => (
            <Badge key={d.status} variant="outline" className={cn('text-[10px]', retBadgeColor(d.media_taxa_retencao))}>
              {d.status}: {formatPct(d.media_taxa_retencao, true)} retenção
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

// ── 7.4 Detalhe Table ──
function ChurnDetalheTable({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnDetalhe[]>('churn_detalhe', csEmail);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof ChurnDetalhe>('receita');
  const [sortAsc, setSortAsc] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const perPage = 20;

  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data) return null;

  const filtered = data.filter(r =>
    r.nome?.toLowerCase().includes(search.toLowerCase()) ||
    r.id_curseduca?.toLowerCase().includes(search.toLowerCase())
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

  const getDiasClass = (d: number | null) => {
    if (d == null) return 'bg-muted/50';
    if (d > 60) return 'bg-destructive/10';
    if (d > 30) return 'bg-orange-500/10';
    return '';
  };

  const npsBadge = (nps: number | null) => {
    if (nps == null) return <span className="text-muted-foreground text-xs">—</span>;
    if (nps >= 9) return <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]" variant="outline">NPS Promotor</Badge>;
    if (nps <= 6) return <Badge variant="destructive" className="text-[10px]">NPS Detrator</Badge>;
    return <Badge variant="outline" className="text-[10px]">{nps}</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm">Clientes em Risco ({filtered.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowExtra(!showExtra)}>
            {showExtra ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
            {showExtra ? 'Menos colunas' : 'Mais colunas'}
          </Button>
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-xs h-8 text-sm" />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>Nome<SortIcon col="nome" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>Receita<SortIcon col="receita" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('status_financeiro')}>Financeiro<SortIcon col="status_financeiro" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('dias_desde_ultimo_login')}>Dias s/ Login<SortIcon col="dias_desde_ultimo_login" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('variacao_membros')}>Variação<SortIcon col="variacao_membros" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('risco_churn')}>Risco<SortIcon col="risco_churn" /></TableHead>
              <TableHead>CS</TableHead>
              {showExtra && (
                <>
                  <TableHead className="text-right">Vlr Inadimpl.</TableHead>
                  <TableHead>Falha Cobr.</TableHead>
                  <TableHead className="text-right">Membros M0</TableHead>
                  <TableHead className="text-right">Membros M1</TableHead>
                  <TableHead>NPS</TableHead>
                  <TableHead className="text-right">CSAT</TableHead>
                  <TableHead>Funil</TableHead>
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
                <TableCell className="text-right">{formatBRL(r.receita)}</TableCell>
                <TableCell>
                  {r.status_financeiro === 'inadimplente' ? <Badge variant="destructive" className="text-[10px]">Inadimplente</Badge>
                    : r.status_financeiro ? <Badge variant="outline" className="text-[10px]">{r.status_financeiro}</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                  {r.falha_cobranca && <Badge className="ml-1 bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px]" variant="outline">Falha</Badge>}
                </TableCell>
                <TableCell className={cn('text-right', getDiasClass(r.dias_desde_ultimo_login))}>
                  {r.dias_desde_ultimo_login != null ? r.dias_desde_ultimo_login : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {r.variacao_membros != null ? (
                    <span className={cn('text-sm', r.variacao_membros < -0.3 ? 'text-destructive font-medium' : '')}>
                      {r.variacao_membros < 0 && <ArrowDown className="h-3 w-3 inline mr-0.5" />}
                      {r.variacao_membros > 0 && <ArrowUp className="h-3 w-3 inline mr-0.5 text-green-500" />}
                      {(r.variacao_membros * 100).toFixed(0)}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {r.risco_churn ? <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[10px]" variant="outline">{r.risco_churn}</Badge> : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{nullDash(r.cs_nome)}</TableCell>
                {showExtra && (
                  <>
                    <TableCell className="text-right">{formatBRL(r.valor_inadimplente)}</TableCell>
                    <TableCell>{r.falha_cobranca ? <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-600">Sim</Badge> : '—'}</TableCell>
                    <TableCell className="text-right">{r.membros_mes_atual != null ? r.membros_mes_atual : '—'}</TableCell>
                    <TableCell className="text-right">{r.membros_mes_m1 != null ? r.membros_mes_m1 : '—'}</TableCell>
                    <TableCell>{npsBadge(r.ultimo_nps)}</TableCell>
                    <TableCell className="text-right">{r.ultimo_csat != null ? r.ultimo_csat : '—'}</TableCell>
                    <TableCell className="text-sm">{nullDash(r.funil_renovacao_etapa)}</TableCell>
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
  );
}
