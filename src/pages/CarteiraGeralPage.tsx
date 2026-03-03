import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Globe, Users, Search, Loader2, DollarSign, RefreshCw, Info,
  Wallet, Package, Activity, Trash2,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import ClientDetailSheet from '@/components/carteira/ClientDetailSheet';
import TablePagination from '@/components/carteira/TablePagination';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientRecord {
  [key: string]: any;
}

type ViewType = 'financeiro' | 'produtos' | 'engajamento';

const VIEW_COLUMNS: Record<ViewType, { key: string; label: string }[]> = {
  financeiro: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'status_financeiro', label: 'Status Financeiro' },
    { key: 'fatura_total', label: 'Fatura' },
    { key: 'plano_base_consolidada', label: 'Plano' },
    { key: 'cs_nome', label: 'CS' },
    { key: 'etapa_do_cs', label: 'Etapa' },
  ],
  produtos: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'plataforma_nome', label: 'Plataforma' },
    { key: 'player_banda_utilizada_gb', label: 'Banda (GB)' },
    { key: 'player_armazenamento_utilizado_gb', label: 'Armaz. (GB)' },
    { key: 'ia_tokens_utilizados', label: 'Tokens IA' },
    { key: 'certificados_mec_utilizados', label: 'Cert. MEC' },
  ],
  engajamento: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'data_ultimo_login', label: 'Último Login' },
    { key: 'tempo_medio_uso_web_minutos', label: 'Tempo Uso (min)' },
    { key: 'membros_mes_atual', label: 'Membros' },
    { key: 'variacao_m0_vs_m1', label: 'Variação' },
    { key: 'dias_desde_ultimo_login', label: 'Dias s/ Login' },
  ],
};

const VIEW_TABS: { value: ViewType; label: string; icon: typeof Wallet }[] = [
  { value: 'financeiro', label: 'Financeiro', icon: Wallet },
  { value: 'produtos', label: 'Produtos', icon: Package },
  { value: 'engajamento', label: 'Engajamento', icon: Activity },
];

const NUMERIC_KEYS = new Set([
  'ia_tokens_utilizados', 'ia_tokens_contratados',
  'certificados_mec_utilizados', 'certificados_mec_contratados',
  'membros_mes_atual', 'tempo_medio_uso_web_minutos', 'dias_desde_ultimo_login',
]);

function formatCellValue(value: any, key?: string): string {
  if (value == null || value === '') return '—';
  if (key === 'fatura_total') {
    const num = Number(value);
    if (!isNaN(num)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  if (key === 'variacao_m0_vs_m1') {
    const num = Number(value);
    if (!isNaN(num)) {
      const sign = num > 0 ? '+' : '';
      return `${sign}${num.toFixed(1)}%`;
    }
  }
  if (key?.includes('_gb')) {
    const num = Number(value);
    if (!isNaN(num)) {
      if (num >= 1024) return `${(num / 1024).toFixed(2)} TB`;
      return `${num.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
    }
  }
  if (key && NUMERIC_KEYS.has(key)) {
    const num = Number(value);
    if (!isNaN(num)) return new Intl.NumberFormat('pt-BR').format(num);
  }
  return String(value);
}

export default function CarteiraGeralPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canImport = hasPermission('carteira.import');
  const canDelete = hasPermission('carteira.delete');

  const [activeView, setActiveView] = useState<ViewType>('financeiro');
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [apiTotal, setApiTotal] = useState(0);
  const PER_PAGE = 20;
  const [detailId, setDetailId] = useState<string | null>(null);
  const [summaryTotal, setSummaryTotal] = useState<number | null>(null);
  const [summaryReceita, setSummaryReceita] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns = VIEW_COLUMNS[activeView];

  const loadData = useCallback(async (page: number, searchTerm: string, view: ViewType) => {
    const isInitial = page === 1 && !searchTerm;
    if (isInitial && clientRecords.length === 0) setInitialLoading(true);
    setPageLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      let fetchUrl = `${supabaseUrl}/functions/v1/fetch-hub-summary?endpoint=clientes&view=${view}&page=${page}&per_page=${PER_PAGE}`;
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
      toast.error(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setInitialLoading(false);
      setPageLoading(false);
    }
  }, [clientRecords.length]);

  // Debounce search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setApiPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  useEffect(() => {
    loadData(apiPage, debouncedSearch, activeView);
  }, [apiPage, debouncedSearch, activeView]);

  // When switching tabs, reset to page 1
  const handleViewChange = (view: string) => {
    setActiveView(view as ViewType);
    setApiPage(1);
  };

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

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const stats = useMemo(() => ({
    total: summaryTotal ?? apiTotal,
    totalRevenue: summaryReceita ?? 0,
  }), [summaryTotal, summaryReceita, apiTotal]);

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
      toast.success(`Cliente "${deleteTarget.client_name || deleteTarget.cliente_nome || ''}" excluído`);
    }
  }, [deleteTarget]);

  if (initialLoading) return (
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
          <p className="text-sm text-muted-foreground">Visão geral de todos os clientes</p>
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
                  loadData(1, debouncedSearch, activeView);
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
            <span className="text-2xl font-bold text-foreground">0</span>
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
                    Soma dos valores de fatura de todos os clientes adimplentes da base.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </span>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={handleViewChange}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            {VIEW_TABS.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && pageLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </Tabs>

      {/* Client Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes ({apiTotal})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Pagination top */}
          <TablePagination
            currentPage={apiPage}
            totalPages={apiTotalPages}
            totalRecords={apiTotal}
            perPage={PER_PAGE}
            loading={pageLoading}
            onPageChange={setApiPage}
          />

          {clientRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
          ) : (
            <div className="relative w-full overflow-x-auto">
              {pageLoading && (
                <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center rounded-md">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                    {columns.map(col => (
                      <TableHead key={col.key} className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                        {col.label}
                      </TableHead>
                    ))}
                    {canDelete && <TableHead className="text-[11px] uppercase tracking-wider w-[50px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientRecords.map((row, i) => (
                    <TableRow
                      key={row.id_curseduca || i}
                      className="cursor-pointer"
                      onClick={() => row.id_curseduca && setDetailId(row.id_curseduca)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{(apiPage - 1) * PER_PAGE + i + 1}</TableCell>
                      {columns.map(col => (
                        <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[250px] truncate">
                          {col.key === 'url_plataforma' && row[col.key] ? (
                            <a href={row[col.key]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                              {row[col.key]}
                            </a>
                          ) : (
                            formatCellValue(row[col.key], col.key)
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

          {/* Pagination bottom */}
          <TablePagination
            currentPage={apiPage}
            totalPages={apiTotalPages}
            totalRecords={apiTotal}
            perPage={PER_PAGE}
            loading={pageLoading}
            onPageChange={setApiPage}
          />
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
              Tem certeza que deseja excluir <strong>{deleteTarget?.client_name || deleteTarget?.cliente_nome || 'este cliente'}</strong>? Esta ação não pode ser desfeita.
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
