import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Globe, Users, Search, Loader2, Upload, DollarSign,
} from 'lucide-react';
import ImportClientsDialog from '@/components/carteira/ImportClientsDialog';

interface ClientRecord {
  [key: string]: any;
}

const HIDDEN_COLS = ['id', 'cs_user_id', 'created_at', 'updated_at'];

const COLUMN_LABELS: Record<string, string> = {
  client_url: 'URL do Cliente',
  client_name: 'Nome do Cliente',
  loyalty_index: 'Índice de Fidelidade',
  plan: 'Plano Contratado',
  monthly_value: 'Valor Mensal',
  client_status: 'Status',
};

function formatLabel(col: string): string {
  if (COLUMN_LABELS[col]) return COLUMN_LABELS[col];
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCellValue(col: string, value: any): string {
  if (value == null || value === '') return '—';
  if (col === 'monthly_value') {
    const num = Number(value);
    if (!isNaN(num)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  return String(value);
}

export default function CarteiraGeralPage() {
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('clients' as any).select('*').order('client_name', { ascending: true }) as any);

    if (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } else {
      setClientRecords((data || []) as ClientRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Detect all visible columns from data
  const allColumns = useMemo(() => {
    if (clientRecords.length === 0) return [];
    const allKeys = new Set<string>();
    clientRecords.forEach(cr => Object.keys(cr).forEach(k => allKeys.add(k)));
    // Put known columns first in order, then extras
    const priority = ['client_url', 'client_name', 'plan', 'monthly_value', 'client_status', 'loyalty_index'];
    const visible = Array.from(allKeys).filter(k => !HIDDEN_COLS.includes(k));
    const ordered: string[] = [];
    for (const p of priority) {
      if (visible.includes(p)) ordered.push(p);
    }
    for (const k of visible) {
      if (!ordered.includes(k)) ordered.push(k);
    }
    return ordered;
  }, [clientRecords]);

  // Unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    clientRecords.forEach(cr => {
      if (cr.client_status) set.add(cr.client_status);
    });
    return Array.from(set).sort();
  }, [clientRecords]);

  // Filter
  const filtered = useMemo(() => {
    let list = clientRecords;
    if (statusFilter !== 'all') {
      list = list.filter(cr => (cr.client_status || 'ativo') === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(cr =>
        Object.values(cr).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [clientRecords, search, statusFilter]);

  // KPIs
  const stats = useMemo(() => {
    const total = clientRecords.length;
    const totalRevenue = clientRecords.reduce((s, c) => s + (Number(c.monthly_value) || 0), 0);
    return { total, totalRevenue };
  }, [clientRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira Geral</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todos os clientes importados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Importar CSV
        </Button>
      </div>

      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={loadData} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Globe className="h-5 w-5 text-foreground" />
            <span className="text-2xl font-bold text-foreground">{stats.total}</span>
            <span className="text-[11px] text-muted-foreground">Total de Clientes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Users className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-foreground">{filtered.length}</span>
            <span className="text-[11px] text-muted-foreground">Exibindo</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}
            </span>
            <span className="text-[11px] text-muted-foreground">Receita Total</span>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em qualquer coluna..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        {uniqueStatuses.length > 0 && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {uniqueStatuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
          ) : (
            <div className="w-full overflow-x-auto border rounded-md">
              <div className="min-w-[1200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                      {allColumns.map(col => (
                        <TableHead key={col} className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                          {formatLabel(col)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row, i) => (
                      <TableRow key={row.id || i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        {allColumns.map(col => (
                          <TableCell key={col} className="text-xs whitespace-nowrap max-w-[250px] truncate">
                            {col === 'client_url' && row[col] ? (
                              <a href={row[col]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {row[col]}
                              </a>
                            ) : col === 'client_status' && row[col] ? (
                              <Badge variant="outline" className="text-[10px]">{row[col]}</Badge>
                            ) : (
                              formatCellValue(col, row[col])
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
