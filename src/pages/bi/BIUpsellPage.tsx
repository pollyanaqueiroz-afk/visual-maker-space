import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBI, formatBRL, formatNumber, formatPct, nullDash } from '@/hooks/useDashboardBI';
import { Loader2, ChevronUp, ChevronDown, ArrowUp, ArrowDown, Rocket, DollarSign, BarChart3, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { Button } from '@/components/ui/button';

// ── Types ──
interface UpsellOverview {
  total_ativos: number; com_potencial_upsell: number;
  elegivel_banda: number; elegivel_tokens: number; elegivel_alunos: number; elegivel_produtos: number;
  total_elegiveis: number; score_medio: number; upsell_total_realizado: number;
  media_uso_banda_pct: number; media_uso_tokens_pct: number; media_uso_storage_pct: number;
  receita_base_elegiveis: number;
}
interface UpsellTipo { tipo: string; elegiveis: number; media_uso_pct: number | null; receita_elegiveis: number; }
interface UpsellOportunidade {
  id_curseduca: string; nome: string; plano: string; receita: number | null;
  score_potencial_upsell: number; elegivel_upsell_banda: boolean; elegivel_upsell_tokens: boolean;
  elegivel_upsell_alunos: boolean; elegivel_upsell_produtos: boolean;
  upsell_total_realizado: number | null; data_ultimo_upsell: string | null;
  uso_banda_pct: number | null; uso_tokens_pct: number | null; uso_storage_pct: number | null;
  alunos_atual: number | null; crescimento_membros: number | null;
  cs_nome: string | null; cs_email: string | null;
}

const TIPO_COLORS: Record<string, string> = { Banda: '#3b82f6', 'Tokens IA': '#8b5cf6', Alunos: '#f97316', Produtos: '#22c55e' };

export default function BIUpsellPage({ csEmail }: { csEmail?: string }) {
  return (
    <div className="space-y-6">
      <UpsellKPIs csEmail={csEmail} />
      <UpsellPorTipo csEmail={csEmail} />
      <UpsellOportunidadesTable csEmail={csEmail} />
    </div>
  );
}

// ── Gauge component ──
function GaugeCard({ label, value }: { label: string; value: number }) {
  // value already comes as absolute percentage (1.40 = 1.40%)
  const pct = Math.min(value, 100);
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f97316' : '#22c55e';
  const gaugeData = [{ value: pct, fill: color }];

  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center">
        <span className="text-xs text-muted-foreground mb-2">{label}</span>
        <ResponsiveContainer width={140} height={140}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={12}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <span className="text-2xl font-bold -mt-8" style={{ color }}>{value.toFixed(1)}%</span>
      </CardContent>
    </Card>
  );
}

// ── 8.1 KPIs ──
function UpsellKPIs({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<UpsellOverview>('upsell_overview', csEmail);
  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const row1 = [
    { label: 'Total Elegíveis', value: formatNumber(data.total_elegiveis), color: 'border-blue-500/30 bg-blue-500/5', icon: Rocket },
    { label: 'Score Médio', value: data.score_medio != null ? data.score_medio.toFixed(1) : '—', color: 'border-blue-500/30 bg-blue-500/5', icon: BarChart3 },
    { label: 'Upsell Realizado', value: formatBRL(data.upsell_total_realizado), color: 'border-green-500/30 bg-green-500/5', icon: DollarSign },
    { label: 'Receita Base Elegíveis', value: formatBRL(data.receita_base_elegiveis), color: 'border-muted bg-muted/30', icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GaugeCard label="Uso Banda" value={data.media_uso_banda_pct ?? 0} />
        <GaugeCard label="Uso Tokens IA" value={data.media_uso_tokens_pct ?? 0} />
        <GaugeCard label="Uso Storage" value={data.media_uso_storage_pct ?? 0} />
      </div>
    </div>
  );
}

// ── 8.2 Por Tipo ──
function UpsellPorTipo({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<UpsellTipo[]>('upsell_por_tipo', csEmail);
  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data || data.length === 0) return null;

  const chartData = data.map(d => ({ ...d, fill: TIPO_COLORS[d.tipo] || '#9ca3af' }));

  const usoBadge = (pct: number | null) => {
    if (pct == null) return <span className="text-xs text-muted-foreground">N/A</span>;
    // pct already comes as absolute percentage (196.61 = 196.61%)
    if (pct > 80) return <Badge variant="destructive" className="text-[10px]">Saturado ({pct.toFixed(0)}%)</Badge>;
    if (pct >= 50) return <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[10px]" variant="outline">Alto uso ({pct.toFixed(0)}%)</Badge>;
    return <span className="text-sm">{pct.toFixed(0)}%</span>;
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Oportunidades por Tipo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(data.length * 50, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            {data.map(d => null)}
            <Bar dataKey="elegiveis" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Elegíveis</TableHead>
              <TableHead>Uso Médio</TableHead>
              <TableHead className="text-right">Receita Elegíveis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[r.tipo] || '#9ca3af' }} />
                    <span className="text-sm font-medium">{r.tipo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(r.elegiveis)}</TableCell>
                <TableCell>{usoBadge(r.media_uso_pct)}</TableCell>
                <TableCell className="text-right">{formatBRL(r.receita_elegiveis)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── 8.3 Oportunidades Table ──
function UpsellOportunidadesTable({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<UpsellOportunidade[]>('upsell_oportunidades', csEmail);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof UpsellOportunidade>('score_potencial_upsell');
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

  const toggleSort = (key: keyof UpsellOportunidade) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: keyof UpsellOportunidade }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  const scoreBadge = (s: number) => {
    if (s >= 20) return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]" variant="outline">Alto potencial</Badge>;
    if (s >= 10) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px]" variant="outline">Médio</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">Baixo</Badge>;
  };

  const usoPctBar = (pct: number | null) => {
    if (pct == null) return <span className="text-xs text-muted-foreground">—</span>;
    const v = pct * 100;
    const color = pct > 0.8 ? 'bg-destructive' : pct > 0.5 ? 'bg-orange-500' : 'bg-green-500';
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(v, 100)}%` }} />
        </div>
        <span className="text-xs">{v.toFixed(0)}%</span>
      </div>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`;
    } catch { return '—'; }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm">Oportunidades de Upsell ({filtered.length})</CardTitle>
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
              <TableHead className="cursor-pointer" onClick={() => toggleSort('score_potencial_upsell')}>Score<SortIcon col="score_potencial_upsell" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>Receita<SortIcon col="receita" /></TableHead>
              <TableHead>Elegibilidade</TableHead>
              <TableHead>Uso Banda</TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('alunos_atual')}>Alunos<SortIcon col="alunos_atual" /></TableHead>
              {showExtra && (
                <>
                  <TableHead className="text-right">Upsell Realizado</TableHead>
                  <TableHead>Último Upsell</TableHead>
                  <TableHead>Uso Tokens</TableHead>
                  <TableHead>Uso Storage</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('crescimento_membros')}>Crescimento<SortIcon col="crescimento_membros" /></TableHead>
                  <TableHead>CS</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate" title={r.nome}>{r.nome || r.id_curseduca}</TableCell>
                <TableCell>{scoreBadge(r.score_potencial_upsell)}</TableCell>
                <TableCell className="text-right">{formatBRL(r.receita)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.elegivel_upsell_banda && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[9px]" variant="outline">Banda</Badge>}
                    {r.elegivel_upsell_tokens && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-[9px]" variant="outline">Tokens</Badge>}
                    {r.elegivel_upsell_alunos && <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-[9px]" variant="outline">Alunos</Badge>}
                    {r.elegivel_upsell_produtos && <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[9px]" variant="outline">Produtos</Badge>}
                  </div>
                </TableCell>
                <TableCell>{usoPctBar(r.uso_banda_pct)}</TableCell>
                <TableCell className="text-right">{r.alunos_atual != null ? formatNumber(r.alunos_atual) : '—'}</TableCell>
                {showExtra && (
                  <>
                    <TableCell className="text-right">{formatBRL(r.upsell_total_realizado)}</TableCell>
                    <TableCell className="text-sm">{formatDate(r.data_ultimo_upsell)}</TableCell>
                    <TableCell>{usoPctBar(r.uso_tokens_pct)}</TableCell>
                    <TableCell>{usoPctBar(r.uso_storage_pct)}</TableCell>
                    <TableCell className="text-right">
                      {r.crescimento_membros != null ? (
                        <span className={cn('text-sm', r.crescimento_membros > 0.1 ? 'text-green-500' : r.crescimento_membros < -0.1 ? 'text-destructive' : '')}>
                          {r.crescimento_membros > 0 && <ArrowUp className="h-3 w-3 inline mr-0.5" />}
                          {r.crescimento_membros < 0 && <ArrowDown className="h-3 w-3 inline mr-0.5" />}
                          {(r.crescimento_membros * 100).toFixed(0)}%
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{nullDash(r.cs_nome)}</TableCell>
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
