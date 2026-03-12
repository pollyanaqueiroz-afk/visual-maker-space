import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Globe, Users, Search, Loader2, DollarSign, RefreshCw, Info,
  Wallet, Package, Activity, Trash2, Filter, CheckCircle, AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import ClientDetailSheet from '@/components/carteira/ClientDetailSheet';
import TablePagination from '@/components/carteira/TablePagination';
import CadastroTab from '@/components/carteira/CadastroTab';
import { usePermissions } from '@/hooks/usePermissions';
import { ClipboardList } from 'lucide-react';

interface ClientRecord {
  [key: string]: any;
}

type ViewType = 'cadastro' | 'financeiro' | 'produtos' | 'engajamento';

const VIEW_COLUMNS: Record<ViewType, { key: string; label: string }[]> = {
  cadastro: [],
  financeiro: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'status_financeiro', label: 'Assinatura' },
    { key: 'status_financeiro_inadimplencia', label: 'Inadimplência' },
    { key: 'status_curseduca', label: 'Status Curseduca' },
    { key: 'fatura_total', label: 'Fatura' },
    { key: 'plano_base_consolidada', label: 'Plano' },
    { key: 'cs_atual', label: 'CS Atual' },
    { key: 'cs_nome', label: 'CS Original (Base)' },
    { key: 'etapa_do_cs', label: 'Etapa' },
  ],
  produtos: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'cs_atual', label: 'CS Atual' },
    { key: 'cs_nome', label: 'CS Original (Base)' },
    { key: 'plataforma_nome', label: 'Plataforma' },
    { key: 'player_banda_utilizada_gb', label: 'Banda (GB)' },
    { key: 'player_armazenamento_utilizado_gb', label: 'Armaz. (GB)' },
    { key: 'ia_tokens_utilizados', label: 'Tokens IA' },
    { key: 'certificados_mec_utilizados', label: 'Cert. MEC' },
  ],
  engajamento: [
    { key: 'id_curseduca', label: 'ID' },
    { key: 'cliente_nome', label: 'Cliente' },
    { key: 'cs_atual', label: 'CS Atual' },
    { key: 'cs_nome', label: 'CS Original (Base)' },
    { key: 'data_ultimo_login', label: 'Último Login' },
    { key: 'tempo_medio_uso_web_minutos', label: 'Tempo Uso (min)' },
    { key: 'numero_alunos', label: 'Alunos' },
    { key: 'variacao_vs_mes_anterior', label: 'Variação' },
    { key: 'mm_2_meses', label: 'MM 2 Meses' },
    { key: 'mm_3_meses', label: 'MM 3 Meses' },
    { key: 'dias_desde_ultimo_login', label: 'Dias s/ Login' },
  ],
};

const VIEW_TABS: { value: ViewType; label: string; icon: typeof Wallet }[] = [
  { value: 'cadastro', label: 'Cadastro', icon: ClipboardList },
  { value: 'financeiro', label: 'Financeiro', icon: Wallet },
  { value: 'produtos', label: 'Produtos', icon: Package },
  { value: 'engajamento', label: 'Engajamento', icon: Activity },
];

const NUMERIC_KEYS = new Set([
  'ia_tokens_utilizados', 'ia_tokens_contratados',
  'certificados_mec_utilizados', 'certificados_mec_contratados',
  'numero_alunos', 'tempo_medio_uso_web_minutos', 'dias_desde_ultimo_login',
  'mm_2_meses', 'mm_3_meses',
]);

function formatCellValue(value: any, key?: string): string {
  if (value == null || value === '') return '—';
  if (key === 'fatura_total') {
    const num = Number(value);
    if (!isNaN(num)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  }
  if (key === 'variacao_vs_mes_anterior' || key === 'mm_2_meses' || key === 'mm_3_meses') {
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
  const { user } = useAuth();
  const { hasPermission, hasRole } = usePermissions();
  const canImport = hasPermission('carteira.import');
  const canDelete = hasPermission('carteira.delete');
  const isAdmin = hasRole('admin');
  const isCs = hasRole('cs') && !isAdmin;
  const userEmail = user?.email || '';
  const [csFilter, setCsFilter] = useState<string>('');
  const [availableCs, setAvailableCs] = useState<string[]>([]);
  const [csNames, setCsNames] = useState<Record<string, string>>({});

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
  const [summaryAdimplentes, setSummaryAdimplentes] = useState<number | null>(null);
  const [summaryInadimplentes, setSummaryInadimplentes] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeKPI, setActiveKPI] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
      if (isCs && userEmail) {
        fetchUrl += `&cs_email_atual=${encodeURIComponent(userEmail)}`;
      } else if (isAdmin && csFilter) {
        fetchUrl += `&cs_email_atual=${encodeURIComponent(csFilter)}`;
      }
      // KPI filter
      if (activeKPI === 'adimplentes') {
        fetchUrl += `&status_inadimplencia=Adimplente`;
      } else if (activeKPI === 'inadimplentes') {
        fetchUrl += `&status_inadimplencia=Inadimplente`;
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
      setLoadError(null);
    } catch (err: any) {
      console.error('Erro ao carregar dados da API:', err);
      setLoadError(err.message);
      setClientRecords([]);
      setApiTotal(0);
      setApiTotalPages(1);
      toast.error(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setInitialLoading(false);
      setPageLoading(false);
    }
  }, [clientRecords.length, isCs, isAdmin, userEmail, csFilter, activeKPI]);

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
  }, [apiPage, debouncedSearch, activeView, csFilter, activeKPI]);

  // When switching tabs, reset to page 1
  const handleViewChange = (view: string) => {
    setActiveView(view as ViewType);
    setApiPage(1);
  };

  const loadSummary = useCallback(async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let summaryUrl = `${supabaseUrl}/functions/v1/fetch-hub-summary`;
      if (isCs && userEmail) {
        summaryUrl += `?cs_email_atual=${encodeURIComponent(userEmail)}`;
      } else if (isAdmin && csFilter) {
        summaryUrl += `?cs_email_atual=${encodeURIComponent(csFilter)}`;
      }
      const res = await fetch(summaryUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.total_clientes != null) setSummaryTotal(data.total_clientes);
        if (data.receita_total != null) setSummaryReceita(data.receita_total);
        if (data.total_adimplentes != null) setSummaryAdimplentes(data.total_adimplentes);
        if (data.total_inadimplentes != null) setSummaryInadimplentes(data.total_inadimplentes);
      }
    } catch (err) {
      console.error('Erro ao carregar summary:', err);
    }
  }, [isCs, isAdmin, userEmail, csFilter]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Load available CS list for admin filter
  useEffect(() => {
    if (!isAdmin) return;
    const loadCsList = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/fetch-hub-summary?endpoint=clientes&view=financeiro&page=1&per_page=1000`,
          { headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } }
        );
        if (res.ok) {
          const result = await res.json();
          const csMap = new Map<string, string>();
          (result.data || []).forEach((c: any) => {
            if (c.cs_email_atual && c.cs_atual) {
              csMap.set(c.cs_email_atual, c.cs_atual);
            }
          });
          const entries = Array.from(csMap.entries())
            .sort((a, b) => a[1].localeCompare(b[1]));
          setAvailableCs(entries.map(([email]) => email));
          setCsNames(Object.fromEntries(entries));
        }
      } catch (err) {
        console.error('Erro ao carregar lista de CS:', err);
      }
    };
    loadCsList();
  }, [isAdmin]);

  // Filter records locally for KPI filters
  const filteredRecords = useMemo(() => {
    if (!activeKPI || activeKPI === 'total') return clientRecords;
    return clientRecords.filter(row => {
      if (activeKPI === 'adimplentes') return row.status_financeiro_inadimplencia === 'Adimplente';
      if (activeKPI === 'inadimplentes') return row.status_financeiro_inadimplencia === 'Inadimplente';
      if (activeKPI === 'receita') return row.fatura_total && Number(row.fatura_total) > 0;
      return true;
    });
  }, [clientRecords, activeKPI]);

  const stats = useMemo(() => ({
    total: summaryTotal ?? apiTotal,
    totalRevenue: summaryReceita ?? 0,
  }), [summaryTotal, summaryReceita, apiTotal]);

  const toggleKPI = (kpi: string) => {
    setActiveKPI(prev => prev === kpi ? null : kpi);
    setApiPage(1);
  };

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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === 'total' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => toggleKPI('total')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Globe className="h-5 w-5 text-foreground" />
            <span className="text-2xl font-bold text-foreground">{new Intl.NumberFormat('pt-BR').format(stats.total)}</span>
            <span className="text-[11px] text-muted-foreground">Total de Clientes</span>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === 'receita' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => toggleKPI('receita')}
        >
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
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === 'adimplentes' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => toggleKPI('adimplentes')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <span className="text-2xl font-bold text-emerald-600">{summaryAdimplentes != null ? new Intl.NumberFormat('pt-BR').format(summaryAdimplentes) : '—'}</span>
            <span className="text-[11px] text-muted-foreground">Adimplentes</span>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === 'inadimplentes' ? 'ring-2 ring-destructive' : ''}`}
          onClick={() => toggleKPI('inadimplentes')}
        >
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-destructive">{summaryInadimplentes != null ? new Intl.NumberFormat('pt-BR').format(summaryInadimplentes) : '—'}</span>
            <span className="text-[11px] text-muted-foreground">Inadimplentes</span>
          </CardContent>
        </Card>
      </div>

      {/* Active KPI filter indicator */}
      {activeKPI && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">
            Filtrando por: <span className="font-semibold text-foreground">
              {activeKPI === 'total' ? 'Todos os clientes' :
               activeKPI === 'receita' ? 'Clientes com receita' :
               activeKPI === 'adimplentes' ? 'Adimplentes' :
               'Inadimplentes'}
            </span>
          </span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setActiveKPI(null); setApiPage(1); }}>
            Limpar filtro ✕
          </Button>
        </div>
      )}

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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isAdmin && availableCs.length > 0 && (
              <Select value={csFilter} onValueChange={(val) => { setCsFilter(val === '__all__' ? '' : val); setApiPage(1); }}>
                <SelectTrigger className="h-9 w-[200px] text-sm">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Todos os CSs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os CSs</SelectItem>
                  {availableCs.map(email => (
                    <SelectItem key={email} value={email}>
                      {csNames[email] || email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
        </div>
      </Tabs>

      {activeView === 'cadastro' ? (
        <CadastroTab />
      ) : (
      /* Client Table */
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes ({activeKPI ? filteredRecords.length : apiTotal})
            {activeKPI && (
              <Badge variant="outline" className="text-[10px] ml-1">
                {activeKPI === 'adimplentes' ? 'Adimplentes' :
                 activeKPI === 'inadimplentes' ? 'Inadimplentes' :
                 activeKPI === 'receita' ? 'Com receita' : 'Todos'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Pagination top */}
          <TablePagination
            currentPage={apiPage}
            totalPages={apiTotalPages}
            totalRecords={activeKPI ? filteredRecords.length : apiTotal}
            perPage={PER_PAGE}
            loading={pageLoading}
            onPageChange={setApiPage}
          />

          {filteredRecords.length === 0 ? (
            loadError ? (
              <div className="text-center py-8 space-y-2">
                <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
                <p className="text-sm text-destructive font-medium">Erro ao carregar clientes</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => loadData(1, '', activeView)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Tentar novamente
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
            )
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
                    
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((row, i) => (
                    <TableRow
                      key={row.id_curseduca || i}
                      className="cursor-pointer"
                      onClick={() => row.id_curseduca && setDetailId(row.id_curseduca)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{(apiPage - 1) * PER_PAGE + i + 1}</TableCell>
                       {columns.map(col => (
                        <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[250px] truncate">
                          {col.key === 'cliente_nome' ? (
                            <div className="flex items-center gap-2">
                              {(() => {
                                const dias = Number(row.dias_desde_ultimo_login);
                                const inadimplente = row.status_financeiro_inadimplencia === 'Inadimplente';
                                const dotColor = inadimplente || dias > 30
                                  ? 'bg-destructive'
                                  : dias > 14
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500';
                                return <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${dotColor}`} />;
                              })()}
                              <span>{row[col.key] || '—'}</span>
                            </div>
                          ) : col.key === 'status_financeiro' ? (
                            row[col.key] === 'ATIVA' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[11px]">Ativa</Badge>
                            ) : row[col.key] === 'INATIVA' ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[11px]">Inativa</Badge>
                            ) : <span className="text-xs">{row[col.key] || '—'}</span>
                          ) : col.key === 'status_financeiro_inadimplencia' ? (
                            row[col.key] === 'Adimplente' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[11px]">Adimplente</Badge>
                            ) : row[col.key] === 'Inadimplente' ? (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[11px]">Inadimplente</Badge>
                            ) : <span className="text-xs">{row[col.key] || '—'}</span>
                          ) : col.key === 'status_curseduca' ? (
                            (() => {
                              const val = row[col.key];
                              if (!val) return <span className="text-xs">—</span>;
                              const colorMap: Record<string, string> = {
                                'Ativo': 'bg-emerald-100 text-emerald-700',
                                'Risco por Engajamento': 'bg-amber-100 text-amber-700',
                                'Implantacao': 'bg-blue-100 text-blue-700',
                              };
                              const cls = colorMap[val] || 'bg-gray-100 text-gray-700';
                              return <Badge className={`${cls} hover:${cls.split(' ')[0]} border-0 text-[11px]`}>{val}</Badge>;
                            })()
                          ) : col.key === 'url_plataforma' && row[col.key] ? (
                            <a href={row[col.key]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={e => e.stopPropagation()}>
                              {row[col.key]}
                            </a>
                          ) : (
                            formatCellValue(row[col.key], col.key)
                          )}
                        </TableCell>
                      ))}
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
            totalRecords={activeKPI ? filteredRecords.length : apiTotal}
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

    </div>
  );
}
