import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Globe, Users, Search, Loader2, Upload, DollarSign, Filter, X, Download, Trash2, RefreshCw,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ImportWizard from '@/components/carteira/importer/ImportWizard';
import { usePermissions } from '@/hooks/usePermissions';
import { useFieldDefinitions, type FieldDefinition } from '@/hooks/useFieldDefinitions';

interface ClientRecord {
  [key: string]: any;
}

const HIDDEN_COLS = ['id', 'created_at', 'updated_at', 'kanban_column_id'];

const FALLBACK_COLUMNS: { db_key: string; label: string }[] = [
  { db_key: 'client_name', label: 'Nome do Cliente' },
  { db_key: 'client_url', label: 'URL da Plataforma' },
  { db_key: 'id_curseduca', label: 'ID Curseduca' },
  { db_key: 'email_do_cliente', label: 'Email' },
  { db_key: 'status_financeiro', label: 'Status Financeiro' },
  { db_key: 'valor_mensal', label: 'Valor Mensal' },
  { db_key: 'plano_contratado', label: 'Plano Contratado' },
  { db_key: 'plano_detalhado', label: 'Plano Detalhado' },
  { db_key: 'nome_do_cs_atual', label: 'CS Atual' },
  { db_key: 'email_do_cs_atual', label: 'Email CS' },
  { db_key: 'etapa_antiga_sensedata', label: 'Etapa CS' },
  { db_key: 'origem_do_dado', label: 'Origem' },
  { db_key: 'nome_da_plataforma', label: 'Nome da Plataforma' },
  { db_key: 'banda_contratada', label: 'Banda Contratada' },
  { db_key: 'banda_utilizada', label: 'Banda Utilizada' },
  { db_key: 'armazenamento_contratado', label: 'Armaz. Contratado' },
  { db_key: 'armazenamento_utilizado', label: 'Armaz. Utilizado' },
  { db_key: 'token_de_ia_contratado', label: 'Tokens IA Contratados' },
  { db_key: 'token_de_ia_utilizado', label: 'Tokens IA Utilizados' },
  { db_key: 'dias_desde_o_ultimo_login', label: 'Dias Desde Último Login' },
  { db_key: 'tempo_medio_de_uso_em_min', label: 'Tempo Médio Uso (min)' },
  { db_key: 'membros_do_mes_atual', label: 'Membros Mês Atual' },
  { db_key: 'data_do_ultimo_login', label: 'Último Login' },
  { db_key: 'data_do_fechamento_do_contrato', label: 'Fechamento Contrato' },
  { db_key: 'desconto_concedido', label: 'Desconto Concedido' },
];

function formatCellValue(value: any): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export default function CarteiraGeralPage() {
  const navigate = useNavigate();
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = usePermissions();
  const canImport = hasPermission('carteira.import');
  const canExport = hasPermission('carteira.export');
  const canDelete = hasPermission('carteira.delete');
  const { visibleFields, isLoading: fieldsLoading } = useFieldDefinitions();
  const displayFields = useMemo(() => 
    visibleFields.length > 0 ? visibleFields : FALLBACK_COLUMNS.map(c => ({ ...c, field_type: 'texto', is_required: false, is_hidden: false, sort_order: 0, enum_options: [] } as FieldDefinition)),
    [visibleFields]
  );
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [apiTotal, setApiTotal] = useState(0);
  const PER_PAGE = 10;

  // Determine which fields can be used as filters (enum + booleano)
  const filterableFields = useMemo(
    () => displayFields.filter(f => f.field_type === 'enum' || f.field_type === 'booleano'),
    [displayFields]
  );

  const loadData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const res = await fetch(
        `${supabaseUrl}/functions/v1/fetch-visao360?page=${page}&per_page=${PER_PAGE}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
        }
      );
      
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
      setClientRecords(result.data || []);
      setApiPage(result.page || 1);
      setApiTotalPages(result.total_pages || 1);
      setApiTotal(result.total || 0);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao carregar dados da API: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(apiPage); }, [apiPage]);


  useEffect(() => {
    if (!tableScrollRef.current || !topScrollInnerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (tableScrollRef.current && topScrollInnerRef.current)
        topScrollInnerRef.current.style.width = tableScrollRef.current.scrollWidth + 'px';
    });
    observer.observe(tableScrollRef.current);
    return () => observer.disconnect();
  }, [loading, clientRecords, displayFields]);

  // Extract unique filter options dynamically
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const field of filterableFields) {
      const values = new Set<string>();
      for (const c of clientRecords) {
        if (c[field.db_key]) values.add(String(c[field.db_key]));
      }
      opts[field.db_key] = [...values].sort();
    }
    return opts;
  }, [clientRecords, filterableFields]);

  const activeFilterCount = Object.values(dynamicFilters).filter(v => v !== '__all__').length;

  // Filter
  const filtered = useMemo(() => {
    let result = clientRecords;
    for (const [key, val] of Object.entries(dynamicFilters)) {
      if (val && val !== '__all__') {
        result = result.filter(c => String(c[key] || '') === val);
      }
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(cr =>
        Object.values(cr).some(v => v != null && String(v).toLowerCase().includes(q))
      );
    }
    return result;
  }, [clientRecords, search, dynamicFilters]);

  const stats = useMemo(() => ({
    total: apiTotal,
    totalRevenue: clientRecords.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
  }), [clientRecords, apiTotal]);

  const buildExportData = useCallback(() => {
    return filtered.map(row => {
      const out: Record<string, string> = {};
      for (const col of displayFields) {
        out[col.label] = row[col.db_key] != null && row[col.db_key] !== '' ? String(row[col.db_key]) : '';
      }
      return out;
    });
  }, [filtered, displayFields]);

  const handleExportCSV = useCallback(() => {
    const data = buildExportData();
    if (data.length === 0) { toast.error('Nenhum dado para exportar'); return; }
    const headers = displayFields.map(c => c.label);
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(h => {
        const v = row[h] || '';
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','));
    }
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carteira_clientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length} registros exportados em CSV`);
  }, [buildExportData, displayFields]);

  const handleExportExcel = useCallback(() => {
    const data = buildExportData();
    if (data.length === 0) { toast.error('Nenhum dado para exportar'); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `carteira_clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${data.length} registros exportados em Excel`);
  }, [buildExportData]);

  const handleDeleteClient = useCallback(async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    const { error } = await (supabase.from('clients' as any).delete().eq('id', deleteTarget.id) as any);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      console.error(error);
      toast.error('Erro ao excluir cliente');
    } else {
      setClientRecords(prev => prev.filter(c => c.id !== deleteTarget.id));
      toast.success(`Cliente "${deleteTarget.client_name || ''}" excluído com sucesso`);
    }
  }, [deleteTarget]);

  if (loading || fieldsLoading) return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira Geral</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todos os clientes importados</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-1.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <Download className="h-4 w-4 mr-1.5" />
                Excel
              </Button>
            </>
          )}
          {canImport && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('sync-visao360');
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);
                    toast.success(
                      `Sincronização concluída: ${data.synced} registros sincronizados${data.errors > 0 ? `, ${data.errors} erros` : ''}`
                    );
                    loadData();
                  } catch (err: any) {
                    console.error(err);
                    toast.error(`Erro na sincronização: ${err.message}`);
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar API'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-1.5" />
                Importar
              </Button>
            </>
          )}
        </div>
      </div>

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} onSuccess={loadData} />

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
            <Users className="h-5 w-5 text-primary" />
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

      {/* Search & Filters */}
      <div className="space-y-3">
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
          {filterableFields.length > 0 && (
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="h-9"
            >
              <Filter className="h-4 w-4 mr-1.5" />
              Filtros
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          )}
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDynamicFilters({})}
              className="h-9 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFilters && filterableFields.length > 0 && (
          <div className="flex items-end gap-3 flex-wrap p-3 rounded-lg border bg-muted/30">
            {filterableFields.map(field => (
              <div key={field.db_key} className="space-y-1.5 min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                <Select
                  value={dynamicFilters[field.db_key] || '__all__'}
                  onValueChange={v => setDynamicFilters(prev => ({ ...prev, [field.db_key]: v }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {(filterOptions[field.db_key] || []).map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
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
            <div className="w-full border rounded-md flex flex-col">
              {/* Top scrollbar */}
              <div
                ref={topScrollRef}
                className="w-full overflow-x-auto"
                onScroll={() => { if (tableScrollRef.current) tableScrollRef.current.scrollLeft = topScrollRef.current!.scrollLeft; }}
              >
                <div ref={topScrollInnerRef} className="h-[1px]" />
              </div>
              <div
                ref={tableScrollRef}
                className="w-full overflow-x-auto"
                onScroll={() => { if (topScrollRef.current) topScrollRef.current.scrollLeft = tableScrollRef.current!.scrollLeft; }}
              >
                <div style={{ minWidth: `${Math.max(displayFields.length * 180, 2000)}px` }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                        {displayFields.map(col => (
                          <TableHead key={col.db_key} className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                            {col.label}
                          </TableHead>
                        ))}
                        {canDelete && <TableHead className="text-[11px] uppercase tracking-wider w-[50px]" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row, i) => (
                        <TableRow
                          key={row.id || i}
                          className="cursor-pointer"
                          onClick={() => row.id && navigate(`/hub/carteira/${row.id}`)}
                        >
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {displayFields.map(col => (
                            <TableCell key={col.db_key} className="text-xs whitespace-nowrap max-w-[250px] truncate">
                              {(col.field_type === 'url' || col.db_key === 'client_url') && row[col.db_key] ? (
                                <a href={row[col.db_key]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                                  {row[col.db_key]}
                                </a>
                              ) : (
                                formatCellValue(row[col.db_key])
                              )}
                            </TableCell>
                          ))}
                          {canDelete && (
                            <TableCell className="text-xs">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={e => { e.stopPropagation(); setDeleteTarget(row); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          {/* Pagination */}
          {apiTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-muted-foreground">
                Página {apiPage} de {apiTotalPages} ({apiTotal} registros)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={apiPage <= 1 || loading}
                  onClick={() => setApiPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={apiPage >= apiTotalPages || loading}
                  onClick={() => setApiPage(p => p + 1)}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.client_name || 'este cliente'}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
