import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface ClientRow {
  id: string;
  id_curseduca: string | null;
  nome: string | null;
  cs_atual: string | null;
  cs_anterior: string | null;
  plano: string | null;
  email: string | null;
  status_financeiro: string | null;
  status_curseduca: string | null;
  status_financeiro_inadimplencia: string | null;
}

const PAGE_SIZE = 30;

function statusBadge(value: string | null, colorMap: Record<string, string>) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;
  const cls = colorMap[value] || '';
  return <Badge variant="outline" className={`text-[11px] ${cls}`}>{value}</Badge>;
}

const FIN_COLORS: Record<string, string> = {
  'Ativa': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  'Cancelada': 'bg-destructive/10 text-destructive border-destructive/20',
};
const STATUS_COLORS: Record<string, string> = {
  'Ativo': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  'Cancelado': 'bg-destructive/10 text-destructive border-destructive/20',
  'Implantacao': 'bg-blue-500/10 text-blue-700 border-blue-200',
  'Risco por Engajamento': 'bg-amber-500/10 text-amber-700 border-amber-200',
};
const INAD_COLORS: Record<string, string> = {
  'Adimplente': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  'Inadimplente': 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function BIValidacaoPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ClientRow[]>([]);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let all: ClientRow[] = [];
    let from = 0;
    const batch = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, id_curseduca, nome, cs_atual, cs_anterior, plano, email, status_financeiro, status_curseduca, status_financeiro_inadimplencia')
        .order('nome', { ascending: true })
        .range(from, from + batch - 1);
      if (error) { console.error(error); break; }
      if (data && data.length > 0) {
        all = all.concat(data as ClientRow[]);
        from += batch;
        hasMore = data.length === batch;
      } else { hasMore = false; }
    }
    setRecords(all);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(r =>
      (r.nome || '').toLowerCase().includes(q) ||
      (r.id_curseduca || '').toLowerCase().includes(q) ||
      (r.email || '').toLowerCase().includes(q) ||
      (r.cs_atual || '').toLowerCase().includes(q) ||
      (r.plano || '').toLowerCase().includes(q)
    );
  }, [records, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, ID, e-mail, CS ou plano..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <span className="text-sm text-muted-foreground">{loading ? '...' : `${filtered.length} clientes`}</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <TableSkeleton rows={12} columns={9} /> : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold text-xs">ID Curseduca</TableHead>
                      <TableHead className="font-semibold text-xs">Nome</TableHead>
                      <TableHead className="font-semibold text-xs">CS Atual</TableHead>
                      <TableHead className="font-semibold text-xs">CS Anterior</TableHead>
                      <TableHead className="font-semibold text-xs">Plano</TableHead>
                      <TableHead className="font-semibold text-xs">E-mail</TableHead>
                      <TableHead className="font-semibold text-xs">Status Financeiro</TableHead>
                      <TableHead className="font-semibold text-xs">Status Curseduca</TableHead>
                      <TableHead className="font-semibold text-xs">Inadimplência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id_curseduca || '—'}</TableCell>
                        <TableCell className="text-sm font-medium max-w-[180px] truncate">{r.nome || '—'}</TableCell>
                        <TableCell className="text-xs">{r.cs_atual || '—'}</TableCell>
                        <TableCell className="text-xs">{r.cs_anterior || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[140px] truncate">{r.plano || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{r.email || '—'}</TableCell>
                        <TableCell>{statusBadge(r.status_financeiro, FIN_COLORS)}</TableCell>
                        <TableCell>{statusBadge(r.status_curseduca, STATUS_COLORS)}</TableCell>
                        <TableCell>{statusBadge(r.status_financeiro_inadimplencia, INAD_COLORS)}</TableCell>
                      </TableRow>
                    ))}
                    {paged.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-sm text-muted-foreground">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
