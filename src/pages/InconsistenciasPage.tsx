import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardTitle, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Search, Filter, CheckCircle, FileWarning, DollarSign, Hash } from 'lucide-react';
import { toast } from 'sonner';

type Record = {
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
  notas: string | null;
  created_at: string;
};

function formatCurrency(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function InconsistenciasPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<Record[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlano, setFilterPlano] = useState('all');
  const [showResolved, setShowResolved] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let allData: Record[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('inconsistencias' as any)
        .select('*')
        .eq('fonte', 'vindi');

      if (!showResolved) {
        query = query.eq('resolvido', false);
      }

      const { data, error } = await query
        .order('valor_contratado', { ascending: false })
        .range(from, from + batchSize - 1);

      if (error) {
        console.error('Error fetching:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as unknown as Record[]);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    setRecords(allData);
    setLoading(false);
  }, [showResolved]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolve = async (id: string) => {
    const { error } = await supabase
      .from('inconsistencias' as any)
      .update({ resolvido: true, resolvido_em: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      toast.error('Erro ao resolver inconsistência');
      return;
    }
    toast.success('Marcada como resolvida');
    setRecords(prev => prev.filter(r => r.id !== id));
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
        (r.codigo_cliente_meio_pagamento || '').includes(s)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(r => r.status === filterStatus);
    }
    if (filterPlano !== 'all') {
      result = result.filter(r => r.nome_plano_master === filterPlano);
    }
    return result;
  }, [records, search, filterStatus, filterPlano]);

  const totalValor = useMemo(() =>
    filtered.reduce((sum, r) => sum + (r.valor_contratado || 0), 0),
    [filtered]
  );

  const countInadimplentes = useMemo(() =>
    records.filter(r => r.status === 'Inadimplente').length,
    [records]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <FileWarning className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inconsistências — Vindi</h1>
          <p className="text-muted-foreground text-sm">
            Assinaturas ativas sem ID Curseduca vinculado
            {!loading && records.length > 0 && (
              <span className="ml-1 text-destructive font-medium">• {records.length} pendentes</span>
            )}
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all ${filterStatus === 'all' ? 'ring-2 ring-primary/30' : 'hover:bg-muted/30'}`}
          onClick={() => setFilterStatus('all')}
        >
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardDescription className="text-xs">Total de registros</CardDescription>
              <CardTitle className="text-xl">{loading ? '...' : records.length}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filterStatus === 'Inadimplente' ? 'ring-2 ring-destructive/30' : 'hover:bg-muted/30'}`}
          onClick={() => setFilterStatus(filterStatus === 'Inadimplente' ? 'all' : 'Inadimplente')}
        >
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <CardDescription className="text-xs">Inadimplentes</CardDescription>
              <CardTitle className="text-xl">{loading ? '...' : countInadimplentes}</CardTitle>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <CardDescription className="text-xs">Valor total (filtrado)</CardDescription>
              <CardTitle className="text-xl">{loading ? '...' : formatCurrency(totalValor)}</CardTitle>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por plano, nome, email, código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {planos.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="Adimplente">Adimplente</SelectItem>
            <SelectItem value="Inadimplente">Inadimplente</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showResolved ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {showResolved ? 'Com resolvidos' : 'Mostrar resolvidos'}
        </Button>
        {(filterStatus !== 'all' || filterPlano !== 'all' || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus('all'); setFilterPlano('all'); setSearch(''); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Results count */}
      {!loading && filtered.length !== records.length && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filtered.length} de {records.length} registros
        </p>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={10} columns={7} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title="Nenhuma inconsistência encontrada"
              description="Não há registros com os filtros aplicados."
            />
          ) : (
            <div className="overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Plano</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Vigência</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold">Meio Pgto</TableHead>
                    <TableHead className="font-semibold">Recorrência</TableHead>
                    <TableHead className="font-semibold">Cód. Assinatura</TableHead>
                    <TableHead className="font-semibold">Criação</TableHead>
                    <TableHead className="text-center font-semibold w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className={r.resolvido ? 'opacity-40' : 'hover:bg-muted/30'}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium truncate max-w-[220px]">{r.plano || '—'}</span>
                          {r.nome_plano_master && (
                            <span className="text-[11px] text-muted-foreground">{r.nome_plano_master}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          r.status === 'Adimplente' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                          r.status === 'Inadimplente' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          ''
                        }>
                          {r.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          r.vigencia_assinatura === 'Ativa' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                          r.vigencia_assinatura === 'Cancelada' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                          ''
                        }>
                          {r.vigencia_assinatura || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatCurrency(r.valor_contratado)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.meio_de_pagamento?.replace('PaymentMethod::', '') || '—'}
                      </TableCell>
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
    </div>
  );
}
