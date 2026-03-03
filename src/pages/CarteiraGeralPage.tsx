import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Globe, Users, Search, Loader2, DollarSign, Filter, X, Trash2, RefreshCw, Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

import ClientDetailSheet from '@/components/carteira/ClientDetailSheet';
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
  
  const { hasPermission } = usePermissions();
  const canImport = hasPermission('carteira.import');
  
  const canDelete = hasPermission('carteira.delete');
  const { visibleFields, isLoading: fieldsLoading } = useFieldDefinitions();
  const displayFields = useMemo(() => 
    visibleFields.length > 0 ? visibleFields : FALLBACK_COLUMNS.map(c => ({ ...c, field_type: 'texto', is_required: false, is_hidden: false, sort_order: 0, enum_options: [] } as FieldDefinition)),
    [visibleFields]
  );
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [apiTotal, setApiTotal] = useState(0);
  const PER_PAGE = 10;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [summaryTotal, setSummaryTotal] = useState<number | null>(null);
  const [summaryReceita, setSummaryReceita] = useState<number | null>(null);

  // Determine which fields can be used as filters (enum + booleano)
  const filterableFields = useMemo(
    () => displayFields.filter(f => f.field_type === 'enum' || f.field_type === 'booleano'),
    [displayFields]
  );

  const loadData = useCallback(async (page = 1, searchTerm = '') => {
    const isInitial = clientRecords.length === 0;
    if (isInitial) setInitialLoading(true);
    setPageLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      let fetchUrl = `${supabaseUrl}/functions/v1/fetch-visao360?page=${page}&per_page=${PER_PAGE}`;
      if (searchTerm) {
        fetchUrl += `&search=${encodeURIComponent(searchTerm)}`;
      }
      
      const res = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      });
      
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
      setInitialLoading(false);
      setPageLoading(false);
    }
  }, [clientRecords.length]);

  // Debounce search: when user types, wait 400ms then reset to page 1 and search server-side
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setApiPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  useEffect(() => { loadData(apiPage, debouncedSearch); }, [apiPage, debouncedSearch]);

  const loadSummary = useCallback(async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/fetch-hub-summary`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.total_clientes != null) setSummaryTotal(data.total_clientes);
        if (data.receita_total != null) setSummaryReceita(data.receita_total);
      }
    } catch (err) {
      console.error('Erro ao carregar summary:', err);
    }
  }, []);

  // Load summary data from hub-summary endpoint
  useEffect(() => { loadSummary(); }, [loadSummary]);

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

  // Filter (only dynamic filters — search is now server-side)
  const filtered = useMemo(() => {
    let result = clientRecords;
    for (const [key, val] of Object.entries(dynamicFilters)) {
      if (val && val !== '__all__') {
        result = result.filter(c => String(c[key] || '') === val);
      }
    }
    return result;
  }, [clientRecords, dynamicFilters]);

  const stats = useMemo(() => ({
    total: summaryTotal ?? apiTotal,
    totalRevenue: summaryReceita ?? 0,
  }), [summaryTotal, summaryReceita, clientRecords, apiTotal]);

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

  if (initialLoading || fieldsLoading) return (
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
          {canImport && (
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
                   loadData(1, debouncedSearch);
                   loadSummary();
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
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Globe className="h-5 w-5 text-foreground" />
            <span className="text-2xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR').format(stats.total)}</span>
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
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              Receita Total
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    Soma dos valores de fatura de todos os clientes adimplentes da base. Considera apenas clientes com status financeiro "Adimplente" e valor de fatura válido. Atualizado em tempo real.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente por nome, email, URL..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && pageLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
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
            <div className="relative w-full">
              {pageLoading && (
                <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
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
                      onClick={() => row.id_curseduca && setDetailId(row.id_curseduca)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{(apiPage - 1) * PER_PAGE + i + 1}</TableCell>
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
                  disabled={apiPage <= 1 || pageLoading}
                  onClick={() => setApiPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={apiPage >= apiTotalPages || pageLoading}
                  onClick={() => setApiPage(p => p + 1)}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientDetailSheet
        idCurseduca={detailId}
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
      />

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
