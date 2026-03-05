import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface FinItem { status_financeiro: string; inadimplencia: string; total: number; receita: number; }
interface PlanoItem { plano: string; total: number; ativos: number; cancelados: number; receita: number; media_alunos: number; }

const INAD_COLORS: Record<string, string> = { 'Adimplente': '#22c55e', 'Inadimplente': '#ef4444', 'Sem info': '#6b7280' };

export default function BIFinanceiroPage({ csEmail }: { csEmail?: string }) {
  const { data: finData, loading: l1 } = useDashboardBI<FinItem[]>('financeiro', csEmail);
  const { data: planosData, loading: l2 } = useDashboardBI<PlanoItem[]>('planos', csEmail);
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

  return (
    <div className="space-y-6">
      {/* Stacked Bar: Financeiro */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Distribuição Financeira</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
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
