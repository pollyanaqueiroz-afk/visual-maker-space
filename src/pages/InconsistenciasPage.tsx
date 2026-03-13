import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Search, CreditCard, DollarSign, Users, Filter } from 'lucide-react';

type FinanceiroRecord = {
  id: string;
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

function statusBadge(status: string | null) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const colors: Record<string, string> = {
    Adimplente: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    Inadimplente: 'bg-red-500/15 text-red-700 border-red-200',
    Cancelado: 'bg-muted text-muted-foreground',
    Ativo: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
  };
  return <Badge variant="outline" className={colors[status] || ''}>{status}</Badge>;
}

export default function InconsistenciasPage() {
  const [activeSource, setActiveSource] = useState('vindi');
  const [activeType, setActiveType] = useState<InconsistencyType>('sem_id_curseduca');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FinanceiroRecord[]>([]);
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('all');

  useEffect(() => {
    fetchInconsistencies();
  }, [activeType]);

  const fetchInconsistencies = async () => {
    setLoading(true);
    let allData: FinanceiroRecord[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('cliente_financeiro')
        .select('id, id_curseduca, nome, email, codigo_assinatura_meio_pagamento, codigo_cliente_meio_pagamento, plano, meio_de_pagamento, valor_contratado, numero_parcelas_pagas, numero_parcelas_inadimplentes, numero_parcelas_contrato, recorrencia_pagamento, is_plano, is_upsell, tipo_produto_master, nome_plano_master, status, vigencia_assinatura, data_criacao');

      // Apply filters based on inconsistency type
      if (activeType === 'sem_id_curseduca') {
        query = query.is('id_curseduca', null).eq('vigencia_assinatura', 'Ativa');
      } else if (activeType === 'inadimplente_ativo') {
        query = query.eq('vigencia_assinatura', 'Ativa').eq('status', 'Inadimplente').not('id_curseduca', 'is', null);
      } else if (activeType === 'sem_nome_email') {
        query = query.not('id_curseduca', 'is', null).or('nome.is.null,email.is.null').eq('vigencia_assinatura', 'Ativa');
      }

      const { data, error } = await query
        .order('data_criacao', { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('Error fetching inconsistencies:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as FinanceiroRecord[]);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    setRecords(allData);
    setLoading(false);
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

  const sources = [
    { id: 'vindi', label: 'Vindi', count: null as number | null },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inconsistências</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Identificação e acompanhamento de dados inconsistentes nos sistemas financeiros
        </p>
      </div>

      {/* Source tabs */}
      <Tabs value={activeSource} onValueChange={setActiveSource}>
        <TabsList>
          {sources.map(s => (
            <TabsTrigger key={s.id} value={s.id} className="gap-2">
              <CreditCard className="h-4 w-4" />
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="vindi" className="space-y-4 mt-4">
          {/* Inconsistency type selector */}
          <div className="flex flex-wrap gap-3">
            {(Object.keys(inconsistencyLabels) as InconsistencyType[]).map(type => {
              const info = inconsistencyLabels[type];
              const Icon = info.icon;
              const isActive = activeType === type;
              return (
                <button
                  key={type}
                  onClick={() => { setActiveType(type); setSearch(''); setFilterPlano('all'); }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                      : 'bg-card border-border hover:bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {info.label}
                  {!loading && isActive && (
                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                      {records.length}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Registros encontrados</CardDescription>
                <CardTitle className="text-2xl">{loading ? '...' : filtered.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Valor total contratado</CardDescription>
                <CardTitle className="text-2xl">{loading ? '...' : formatCurrency(totalValor)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tipo de inconsistência</CardDescription>
                <CardTitle className="text-lg">{inconsistencyLabels[activeType].label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{inconsistencyLabels[activeType].description}</p>
              </CardContent>
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
                  description="Nenhum registro corresponde aos filtros selecionados."
                />
              ) : (
                <div className="overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Curseduca</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vigência</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Meio Pagamento</TableHead>
                        <TableHead>Recorrência</TableHead>
                        <TableHead>Cód. Assinatura</TableHead>
                        <TableHead>Data Criação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">
                            {r.id_curseduca || <span className="text-destructive font-medium">VAZIO</span>}
                          </TableCell>
                          <TableCell>{r.nome || <span className="text-muted-foreground italic">—</span>}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">{r.plano || '—'}</span>
                              {r.nome_plano_master && (
                                <span className="text-xs text-muted-foreground">{r.nome_plano_master}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell>{statusBadge(r.vigencia_assinatura)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCurrency(r.valor_contratado)}</TableCell>
                          <TableCell className="text-xs">{r.meio_de_pagamento?.replace('PaymentMethod::', '') || '—'}</TableCell>
                          <TableCell>{r.recorrencia_pagamento || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.codigo_assinatura_meio_pagamento || '—'}</TableCell>
                          <TableCell className="text-xs">{r.data_criacao || '—'}</TableCell>
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
