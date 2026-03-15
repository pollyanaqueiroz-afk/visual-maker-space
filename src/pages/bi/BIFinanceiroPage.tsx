import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

interface FinItem { status_financeiro: string; inadimplencia: string; total: number; receita: number; }
interface PlanoItem { plano: string; total: number; ativos: number; cancelados: number; receita: number; media_alunos: number; }
interface RecorrenciaItem { recorrencia: string; total: number; receita: number; }
interface MeioItem { meio: string; total: number; receita: number; }
interface PlanoVsUpsellItem { tipo: string; total: number; receita: number; }
interface UpsellItem { upsell: string; total: number; receita: number; }

const INAD_COLORS: Record<string, string> = { 'Adimplente': '#22c55e', 'Inadimplente': '#ef4444', 'Sem info': '#6b7280' };
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4', '#6b7280'];
const PLANO_UPSELL_COLORS = ['hsl(var(--primary))', '#f97316'];

export default function BIFinanceiroPage({ csEmail }: { csEmail?: string }) {
  const { data: finData, loading: l1 } = useDashboardBI<FinItem[]>('financeiro', csEmail);
  const { data: planosData, loading: l2 } = useDashboardBI<PlanoItem[]>('planos', csEmail);
  const { data: recorrenciaData, loading: l3 } = useDashboardBI<RecorrenciaItem[]>('financeiro_recorrencia', csEmail);
  const { data: meioData, loading: l4 } = useDashboardBI<MeioItem[]>('financeiro_meio_pagamento', csEmail);
  const { data: planoVsUpsell, loading: l5 } = useDashboardBI<PlanoVsUpsellItem[]>('financeiro_plano_vs_upsell', csEmail);
  const { data: topUpsells, loading: l6 } = useDashboardBI<UpsellItem[]>('financeiro_top_upsells', csEmail);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof PlanoItem>('receita');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 20;

  if (l1 || l2) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Group financeiro data by status_financeiro
  const grouped = (finData || []).reduce((acc, item) => {
    if (!acc[item.status_financeiro]) acc[item.status_financeiro] = [];
    acc[item.status_financeiro].push(item);
    return acc;
  }, {} as Record<string, FinItem[]>);

  const stackedData = Object.entries(grouped).map(([status, items]) => {
    const row: any = { status_financeiro: status };
    for (const it of items) { row[it.inadimplencia] = it.total; row[`receita_${it.inadimplencia}`] = it.receita; }
    return row;
  });

  // Planos
  const top15 = (planosData || []).slice(0, 15);
  const filteredPlanos = (planosData || []).filter(p => p.plano.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filteredPlanos].sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const toggleSort = (key: keyof PlanoItem) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: keyof PlanoItem }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-1" /> : <ChevronDown className="h-3 w-3 inline ml-1" />) : null;

  // Plano vs Upsell pie data
  const pvuData = (planoVsUpsell || []).map((d, i) => ({ ...d, fill: PLANO_UPSELL_COLORS[i] || PIE_COLORS[i] }));
  const pvuTotal = pvuData.reduce((s, d) => s + d.receita, 0);

  // Recorrencia pie data
  const recData = (recorrenciaData || []).map((d, i) => ({ name: d.recorrencia, value: d.receita, total: d.total, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  // Meio pagamento pie data
  const meioChartData = (meioData || []).map((d, i) => ({ name: d.meio, value: d.receita, total: d.total, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  // Top upsells
  const top15Upsells = (topUpsells || []).slice(0, 15);

  return (
    <div className="space-y-6">
      {/* Row 1: Plano vs Upsell + Recorrência */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Plano vs Upsell (Receita Ativa)</CardTitle></CardHeader>
          <CardContent>
            {pvuData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pvuData} dataKey="receita" nameKey="tipo" cx="50%" cy="50%" outerRadius={100} innerRadius={50}
                    label={({ tipo, receita }) => `${tipo} ${((receita / pvuTotal) * 100).toFixed(0)}%`}>
                    {pvuData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend formatter={(value) => {
                    const item = pvuData.find(d => d.tipo === value);
                    return `${value} (${item?.total || 0} assinaturas)`;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Receita por Recorrência</CardTitle></CardHeader>
          <CardContent>
            {recData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={recData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {recData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend formatter={(value) => {
                    const item = recData.find(d => d.name === value);
                    return `${value} (${item?.total || 0})`;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">{l3 ? 'Carregando...' : 'Sem dados'}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Meio Pagamento + Distribuição Financeira */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Receita por Meio de Pagamento</CardTitle></CardHeader>
          <CardContent>
            {meioChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={meioChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {meioChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend formatter={(value) => {
                    const item = meioChartData.find(d => d.name === value);
                    return `${value} (${item?.total || 0})`;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">{l4 ? 'Carregando...' : 'Sem dados'}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Distribuição Financeira</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="status_financeiro" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                {['Adimplente', 'Inadimplente', 'Sem info'].map(key => (
                  <Bar key={key} dataKey={key} name={key} stackId="a" fill={INAD_COLORS[key]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 15 Planos Chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Top 15 Planos por Receita</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top15} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="plano" width={220} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 15 Upsells Chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Top 15 Upsells por Receita</CardTitle></CardHeader>
        <CardContent>
          {top15Upsells.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={top15Upsells} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="upsell" width={220} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="receita" name="Receita" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">{l6 ? 'Carregando...' : 'Sem dados de upsell'}</p>}
        </CardContent>
      </Card>

      {/* Full Planos Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-semibold">Todos os Planos ({(planosData || []).length})</CardTitle>
          <Input placeholder="Buscar plano..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-xs h-8 text-sm" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('plano')}>Plano<SortIcon col="plano" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('total')}>Total<SortIcon col="total" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('ativos')}>Ativos<SortIcon col="ativos" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>Receita<SortIcon col="receita" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('media_alunos')}>Média Alunos<SortIcon col="media_alunos" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm max-w-[300px] truncate">{p.plano}</TableCell>
                  <TableCell className="text-right">{p.total}</TableCell>
                  <TableCell className="text-right">{p.ativos}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.receita)}</TableCell>
                  <TableCell className="text-right">{p.media_alunos?.toFixed(1) ?? '—'}</TableCell>
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
