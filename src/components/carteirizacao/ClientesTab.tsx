import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import TablePagination from '@/components/carteira/TablePagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Search } from 'lucide-react';

type Client = {
  id: string;
  id_curseduca: string | null;
  cliente: string | null;
  cs_atual: string | null;
  cs_anterior: string | null;
  fatura: string | null;
  plano: string | null;
  data_da_carga: string | null;
};

const PER_PAGE = 50;

export default function ClientesTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('__all__');
  const [filterCsAtual, setFilterCsAtual] = useState('__all__');
  const [filterCsAnterior, setFilterCsAnterior] = useState('__all__');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      // Fetch all clients (table should be manageable size)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('cliente', { ascending: true });
      if (!error && data) {
        setClients(data as Client[]);
      }
      setLoading(false);
    };
    fetchClients();
  }, []);

  // Extract unique values for filters
  const planos = useMemo(() => [...new Set(clients.map(c => c.plano).filter(Boolean))].sort() as string[], [clients]);
  const csAtuais = useMemo(() => [...new Set(clients.map(c => c.cs_atual).filter(Boolean))].sort() as string[], [clients]);
  const csAnteriores = useMemo(() => [...new Set(clients.map(c => c.cs_anterior).filter(Boolean))].sort() as string[], [clients]);

  // Filter
  const filtered = useMemo(() => {
    let result = clients;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.cliente?.toLowerCase().includes(q) ||
        c.id_curseduca?.toLowerCase().includes(q) ||
        c.cs_atual?.toLowerCase().includes(q)
      );
    }
    if (filterPlano !== '__all__') result = result.filter(c => c.plano === filterPlano);
    if (filterCsAtual !== '__all__') result = result.filter(c => c.cs_atual === filterCsAtual);
    if (filterCsAnterior !== '__all__') result = result.filter(c => c.cs_anterior === filterCsAnterior);
    return result;
  }, [clients, search, filterPlano, filterCsAtual, filterCsAnterior]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, filterPlano, filterCsAtual, filterCsAnterior]);

  const formatFatura = (v: string | null) => {
    if (!v) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) return <TableSkeleton rows={10} columns={7} />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou ID..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os planos</SelectItem>
            {planos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCsAtual} onValueChange={setFilterCsAtual}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="CS Atual" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos CS Atual</SelectItem>
            {csAtuais.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCsAnterior} onValueChange={setFilterCsAnterior}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="CS Anterior" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos CS Anterior</SelectItem>
            {csAnteriores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4 p-0">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
            className="px-4 py-2 border-b border-border/40"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Curseduca</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>CS Atual</TableHead>
                <TableHead>CS Anterior</TableHead>
                <TableHead className="text-right">Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id_curseduca || '—'}</TableCell>
                    <TableCell className="font-medium">{c.cliente || '—'}</TableCell>
                    <TableCell>{c.plano || '—'}</TableCell>
                    <TableCell>{c.cs_atual || '—'}</TableCell>
                    <TableCell>{c.cs_anterior || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFatura(c.fatura)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
            className="px-4 py-2 border-t border-border/40"
          />
        </CardContent>
      </Card>
    </div>
  );
}
