import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBI, formatBRL, nullDash } from '@/hooks/useDashboardBI';
import { Loader2, ChevronUp, ChevronDown, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChurnItem {
  id_curseduca: string; cliente_nome: string; plano: string; status: string;
  inadimplencia: string; fatura: number | null; dias_sem_login: number | null;
  alunos: number | null; variacao_membros: number | null;
  cs_nome: string | null; etapa_do_cs: string | null;
}

export default function BIChurnRiskPage({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<ChurnItem[]>('churn_risk', csEmail);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof ChurnItem>('fatura');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const filtered = (data || []).filter(r =>
    r.cliente_nome?.toLowerCase().includes(search.toLowerCase()) ||
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

  const paged = sorted.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const toggleSort = (key: keyof ChurnItem) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: keyof ChurnItem }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  const getDiasClass = (dias: number | null) => {
    if (dias == null) return 'bg-muted/50';
    if (dias > 60) return 'bg-destructive/10';
    if (dias > 30) return 'bg-warning/10';
    return '';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-semibold">Risco de Churn ({(data || []).length} clientes)</CardTitle>
        <Input placeholder="Buscar cliente ou plano..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="max-w-xs h-8 text-sm" />
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('cliente_nome')}>Cliente<SortIcon col="cliente_nome" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('plano')}>Plano<SortIcon col="plano" /></TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('inadimplencia')}>Inadimplência<SortIcon col="inadimplencia" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('fatura')}>Fatura<SortIcon col="fatura" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('dias_sem_login')}>Dias s/ Login<SortIcon col="dias_sem_login" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('alunos')}>Alunos<SortIcon col="alunos" /></TableHead>
              <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('variacao_membros')}>Variação<SortIcon col="variacao_membros" /></TableHead>
              <TableHead>Etapa CS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium text-sm max-w-[200px] truncate" title={r.cliente_nome}>{r.cliente_nome || r.id_curseduca}</TableCell>
                <TableCell className="text-sm max-w-[160px] truncate" title={r.plano}>{r.plano || '—'}</TableCell>
                <TableCell>
                  {r.inadimplencia === 'Inadimplente' ? (
                    <Badge variant="destructive" className="text-[10px]">Inadimplente</Badge>
                  ) : r.inadimplencia === 'Adimplente' ? (
                    <Badge className="bg-success/10 text-success border-success/30 text-[10px]" variant="outline">Adimplente</Badge>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell className="text-right">{formatBRL(r.fatura)}</TableCell>
                <TableCell className={cn('text-right', getDiasClass(r.dias_sem_login))}>
                  {r.dias_sem_login != null ? r.dias_sem_login : '—'}
                </TableCell>
                <TableCell className="text-right">{r.alunos != null ? r.alunos : '—'}</TableCell>
                <TableCell className="text-right">
                  {r.variacao_membros != null ? (
                    <span className={cn('text-sm', r.variacao_membros < -0.3 ? 'text-destructive font-medium' : '')}>
                      {r.variacao_membros < 0 && <ArrowDown className="h-3 w-3 inline mr-0.5" />}
                      {(r.variacao_membros * 100).toFixed(0)}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{nullDash(r.etapa_do_cs)}</TableCell>
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
