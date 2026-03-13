import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Search, CreditCard, DollarSign, Users, Filter, CheckCircle, TrendingUp, Hash, FileWarning } from 'lucide-react';
import { toast } from 'sonner';

type InconsistenciaRecord = {
  id: string;
  fonte: string;
  tipo: string;
  id_curseduca: string | null;
  nome: string | null;
  email: string | null;
  codigo_assinatura_meio_pagamento: string | null;
  codigo_cliente_meio_pagamento: string | null;
  plano: string | null;
  meio_de_pagamento: string | null;
  valor_contratado: number | null;
  numero_parcelas_pagas: number | null;
  numero_parcelas_inadimplentes: number | null;
  numero_parcelas_contrato: number | null;
  recorrencia_pagamento: string | null;
  is_plano: boolean | null;
  is_upsell: boolean | null;
  tipo_produto_master: string | null;
  nome_plano_master: string | null;
  status: string | null;
  vigencia_assinatura: string | null;
  data_criacao: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  resolvido_por: string | null;
  notas: string | null;
  created_at: string;
};

type InconsistencyType = 'sem_id_curseduca' | 'inadimplente_ativo' | 'sem_nome_email';

const inconsistencyLabels: Record<InconsistencyType, { label: string; description: string; icon: React.ElementType }> = {
  sem_id_curseduca: {
    label: 'Sem ID Curseduca',
    description: 'Assinaturas ativas sem vínculo com ID do Curseduca',
    icon: Users,
  },
  inadimplente_ativo: {
    label: 'Inadimplente Ativo',
    description: 'Assinaturas com vigência ativa mas status inadimplente',
    icon: DollarSign,
  },
  sem_nome_email: {
    label: 'Sem Nome/Email',
    description: 'Registros com ID Curseduca mas sem nome ou email',
    icon: AlertTriangle,
  },
};

function formatCurrency(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function cleanPaymentMethod(value: string | null) {
  if (!value) return '—';
  return value.replace('PaymentMethod::', '');
}

export default function InconsistenciasPage() {
  const [activeSource, setActiveSource] = useState('vindi');
  const [activeType, setActiveType] = useState<InconsistencyType>('sem_id_curseduca');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<InconsistenciaRecord[]>([]);
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('all');
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let allData: InconsistenciaRecord[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('inconsistencias' as any)
        .select('*')
        .eq('fonte', activeSource)
        .eq('tipo', activeType);

      if (!showResolved) {
        query = query.eq('resolvido', false);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('Error fetching inconsistencias:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as unknown as InconsistenciaRecord[]);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    setRecords(allData);
    setLoading(false);
  }, [activeSource, activeType, showResolved]);

  const fetchCounts = useCallback(async () => {
    const types: InconsistencyType[] = ['sem_id_curseduca', 'inadimplente_ativo', 'sem_nome_email'];
    const counts: Record<string, number> = {};

    await Promise.all(types.map(async (tipo) => {
      const { count } = await supabase
        .from('inconsistencias' as any)
        .select('id', { count: 'exact', head: true })
        .eq('fonte', activeSource)
        .eq('tipo', tipo)
        .eq('resolvido', false);
      counts[tipo] = count ?? 0;
    }));

    setTypeCounts(counts);
  }, [activeSource]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleResolve = async (id: string) => {
    const { error } = await supabase
      .from('inconsistencias' as any)
      .update({ resolvido: true, resolvido_em: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao resolver inconsistência');
      return;
    }
    toast.success('Inconsistência marcada como resolvida');
    setRecords(prev => prev.filter(r => r.id !== id));
    setTypeCounts(prev => ({ ...prev, [activeType]: (prev[activeType] || 1) - 1 }));
  };

  const planos = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.nome_plano_master) set.add(r.nome_plano_master); });
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    let result = records;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r =>
        (r.plano || '').toLowerCase().includes(s) ||
        (r.nome || '').toLowerCase().includes(s) ||
        (r.email || '').toLowerCase().includes(s) ||
        (r.codigo_assinatura_meio_pagamento || '').includes(s) ||
        (r.codigo_cliente_meio_pagamento || '').includes(s) ||
        (r.id_curseduca || '').toLowerCase().includes(s)
      );
    }
    if (filterPlano !== 'all') {
      result = result.filter(r => r.nome_plano_master === filterPlano);
    }
    return result;
  }, [records, search, filterPlano]);

  const totalValor = useMemo(() =>
    filtered.reduce((sum, r) => sum + (r.valor_contratado || 0), 0),
    [filtered]
  );

  const totalInadimplentes = useMemo(() =>
    filtered.filter(r => r.status === 'Inadimplente').length,
    [filtered]
  );

  const sources = [
    { id: 'vindi', label: 'Vindi' },
  ];

  const totalPendentes = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <FileWarning className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inconsistências</h1>
            <p className="text-muted-foreground text-sm">
              Dados inconsistentes nos sistemas financeiros
              {!loading && totalPendentes > 0 && (
                <span className="ml-2 text-destructive font-medium">• {totalPendentes} pendentes</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Source tabs */}
      <Tabs value={activeSource} onValueChange={(v) => { setActiveSource(v); setActiveType('sem_id_curseduca'); }}>
        <TabsList>
          {sources.map(s => (
            <TabsTrigger key={s.id} value={s.id} className="gap-2">
              <CreditCard className="h-4 w-4" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeSource} className="space-y-4 mt-4">
          {/* Inconsistency type selector */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(inconsistencyLabels) as InconsistencyType[]).map(type => {
              const info = inconsistencyLabels[type];
              const Icon = info.icon;
              const isActive = activeType === type;
              const count = typeCounts[type] ?? 0;
              return (
                <button
                  key={type}
                  onClick={() => { setActiveType(type); setSearch(''); setFilterPlano('all'); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'bg-primary/10 border-primary/30 shadow-sm ring-1 ring-primary/20'
                      : 'bg-card border-border hover:bg-muted/50'
                  }`}
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                      {info.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{info.description}</div>
                  </div>
                  <Badge 
                    variant={count > 0 ? "destructive" : "secondary"} 
                    className="ml-auto shrink-0 h-6 min-w-6 px-2 text-xs"
                  >
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardDescription className="text-xs">Registros encontrados</CardDescription>
                  <CardTitle className="text-xl">{loading ? '...' : filtered.length}</CardTitle>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <CardDescription className="text-xs">Valor total contratado</CardDescription>
                  <CardTitle className="text-xl">{loading ? '...' : formatCurrency(totalValor)}</CardTitle>
                </div>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
                <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <CardDescription className="text-xs">Inadimplentes no filtro</CardDescription>
                  <CardTitle className="text-xl">{loading ? '...' : totalInadimplentes}</CardTitle>
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por plano, nome, email, código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPlano} onValueChange={setFilterPlano}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Plano Master" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                {planos.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showResolved ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {showResolved ? 'Mostrando resolvidos' : 'Mostrar resolvidos'}
            </Button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton rows={10} columns={7} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={AlertTriangle}
                  title="Nenhuma inconsistência encontrada"
                  description="Não há registros para este tipo de inconsistência no momento."
                />
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">ID Curseduca</TableHead>
                        <TableHead className="font-semibold">Nome</TableHead>
                        <TableHead className="font-semibold">Plano</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Vigência</TableHead>
                        <TableHead className="text-right font-semibold">Valor</TableHead>
                        <TableHead className="font-semibold">Meio Pgto</TableHead>
                        <TableHead className="font-semibold">Recorrência</TableHead>
                        <TableHead className="font-semibold">Cód. Assinatura</TableHead>
                        <TableHead className="font-semibold">Criação</TableHead>
                        <TableHead className="text-center font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(r => (
                        <TableRow key={r.id} className={r.resolvido ? 'opacity-40' : 'hover:bg-muted/30'}>
                          <TableCell className="font-mono text-xs">
                            {r.id_curseduca || (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                VAZIO
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {r.nome || <span className="text-muted-foreground italic text-xs">sem nome</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm truncate max-w-[180px]">{r.plano || '—'}</span>
                              {r.nome_plano_master && (
                                <Badge variant="outline" className="text-[10px] w-fit px-1.5 py-0 text-muted-foreground">
                                  {r.nome_plano_master}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {r.status ? (
                              <Badge variant="outline" className={
                                r.status === 'Adimplente' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                                r.status === 'Inadimplente' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                ''
                              }>
                                {r.status}
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            {r.vigencia_assinatura ? (
                              <Badge variant="outline" className={
                                r.vigencia_assinatura === 'Ativa' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                                r.vigencia_assinatura === 'Cancelada' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                                ''
                              }>
                                {r.vigencia_assinatura}
                              </Badge>
                            ) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums">
                            {formatCurrency(r.valor_contratado)}
                          </TableCell>
                          <TableCell className="text-xs">{cleanPaymentMethod(r.meio_de_pagamento)}</TableCell>
                          <TableCell className="text-xs">{r.recorrencia_pagamento || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.codigo_assinatura_meio_pagamento || '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{r.data_criacao || '—'}</TableCell>
                          <TableCell className="text-center">
                            {!r.resolvido && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-emerald-500/10"
                                onClick={() => handleResolve(r.id)}
                                title="Marcar como resolvido"
                              >
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
