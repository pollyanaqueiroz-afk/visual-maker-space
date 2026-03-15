import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Search, Loader2, TableIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TABLE_NAMES = [
  'app_ajustes',
  'app_assets',
  'app_checklist_historico',
  'app_checklist_items',
  'app_clientes',
  'app_conversas',
  'app_fases',
  'app_formulario',
  'app_notificacoes',
  'app_prerequisitos',
  'brand_assets',
  'briefing_adjustment_items',
  'briefing_adjustments',
  'briefing_deliveries',
  'briefing_images',
  'briefing_reference_images',
  'briefing_requests',
  'briefing_reviews',
  'carteirizacao_cs',
  'carteirizacao_etapas',
  'carteirizacao_ferias',
  'carteirizacao_planos',
  'client_field_definitions',
  'client_interactions',
  'client_projects',
  'cliente_churn',
  'cliente_financeiro',
  'clientes_inativos',
  'clients',
  'email_logs',
  'inconsistencias',
  'kanban_boards',
  'kanban_card_positions',
  'kanban_columns',
  'meeting_csat',
  'meeting_minutes',
  'meeting_reschedules',
  'meetings',
  'migration_clubs',
  'migration_form_submissions',
  'migration_projects',
  'migration_status_history',
  'migration_validations',
  'profiles',
  'role_permissions',
  'user_roles',
  'cliente_engajamento_produto',
] as const;

type TableData = {
  rows: Record<string, any>[];
  count: number;
  loading: boolean;
  error: string | null;
};

export default function DatabaseExplorerPage() {
  const [activeTable, setActiveTable] = useState<string>(TABLE_NAMES[0]);
  const [tableData, setTableData] = useState<Record<string, TableData>>({});
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Fetch counts for all tables on mount
  useEffect(() => {
    const fetchCounts = async () => {
      setLoadingCounts(true);
      const counts: Record<string, number> = {};
      await Promise.all(
        TABLE_NAMES.map(async (name) => {
          try {
            const { count } = await (supabase.from(name as any).select('*', { count: 'exact', head: true }) as any);
            counts[name] = count ?? 0;
          } catch {
            counts[name] = 0;
          }
        })
      );
      setTableCounts(counts);
      setLoadingCounts(false);
    };
    fetchCounts();
  }, []);

  // Fetch data for active table
  useEffect(() => {
    if (tableData[activeTable]?.rows.length) return; // already loaded
    fetchTableData(activeTable);
  }, [activeTable]);

  const fetchTableData = async (tableName: string) => {
    setTableData(prev => ({
      ...prev,
      [tableName]: { rows: [], count: 0, loading: true, error: null },
    }));

    try {
      const { data, error, count } = await (supabase
        .from(tableName as any)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100) as any);

      if (error) {
        // Try without ordering by created_at
        const { data: data2, error: error2, count: count2 } = await (supabase
          .from(tableName as any)
          .select('*', { count: 'exact' })
          .limit(100) as any);

        if (error2) {
          setTableData(prev => ({
            ...prev,
            [tableName]: { rows: [], count: 0, loading: false, error: error2.message },
          }));
          return;
        }

        setTableData(prev => ({
          ...prev,
          [tableName]: { rows: data2 || [], count: count2 ?? 0, loading: false, error: null },
        }));
        return;
      }

      setTableData(prev => ({
        ...prev,
        [tableName]: { rows: data || [], count: count ?? 0, loading: false, error: null },
      }));
    } catch (err: any) {
      setTableData(prev => ({
        ...prev,
        [tableName]: { rows: [], count: 0, loading: false, error: err.message },
      }));
    }
  };

  const currentData = tableData[activeTable];
  const columns = currentData?.rows?.[0] ? Object.keys(currentData.rows[0]) : [];

  const filteredRows = currentData?.rows?.filter(row => {
    if (!searchFilter) return true;
    const lower = searchFilter.toLowerCase();
    return Object.values(row).some(v =>
      v !== null && String(v).toLowerCase().includes(lower)
    );
  }) ?? [];

  const filteredTables = TABLE_NAMES.filter(t =>
    !tableSearch || t.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0);

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
    const str = String(value);
    return str.length > 60 ? str.slice(0, 57) + '...' : str;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Explorador de Banco de Dados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualização das tabelas e dados do sistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="outline" className="text-sm px-3 py-1">
                {TABLE_NAMES.length} tabelas
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Total de tabelas no banco de dados</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {loadingCounts ? '...' : totalRecords.toLocaleString('pt-BR')} registros
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Total de registros em todas as tabelas</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Left: Table list */}
        <Card className="w-72 shrink-0 flex flex-col">
          <CardHeader className="pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tabela..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-0.5 p-2">
                {filteredTables.map(name => (
                  <button
                    key={name}
                    onClick={() => setActiveTable(name)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2 ${
                      activeTable === name
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <TableIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="truncate">{name}</span>
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 min-w-8 justify-center shrink-0">
                      {loadingCounts ? '…' : (tableCounts[name] ?? 0)}
                    </Badge>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Table data */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" />
                  {activeTable}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {currentData?.loading ? 'Carregando...' : (
                    <>
                      Exibindo {filteredRows.length} de {tableCounts[activeTable] ?? 0} registros
                      {searchFilter && ` (filtrados)`}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar dados..."
                    value={searchFilter}
                    onChange={e => setSearchFilter(e.target.value)}
                    className="pl-9 h-9 w-56 text-sm"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => {
                        setTableData(prev => {
                          const copy = { ...prev };
                          delete copy[activeTable];
                          return copy;
                        });
                        fetchTableData(activeTable);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Recarregar dados da tabela</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            {currentData?.loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : currentData?.error ? (
              <div className="flex items-center justify-center h-full text-destructive text-sm">
                Erro: {currentData.error}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <Database className="h-10 w-10 opacity-30" />
                <span className="text-sm">Nenhum registro encontrado</span>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="min-w-max">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center text-xs">#</TableHead>
                        {columns.map(col => (
                          <TableHead key={col} className="text-xs whitespace-nowrap font-semibold">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row, i) => (
                        <TableRow key={i} className="hover:bg-muted/30">
                          <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {i + 1}
                          </TableCell>
                          {columns.map(col => (
                            <TableCell key={col} className="text-xs max-w-[200px] truncate font-mono">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default">{formatCellValue(row[col])}</span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm break-all">
                                  <p className="text-xs font-mono">
                                    <strong>{col}:</strong> {row[col] === null ? 'NULL' : String(row[col])}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
