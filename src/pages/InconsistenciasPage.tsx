import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardTitle, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { FileWarning, DollarSign, Hash, AlertTriangle, ChevronLeft, ChevronRight, Unlink } from 'lucide-react';

type Registro = {
  id: string;
  plano: string | null;
  meio_de_pagamento: string | null;
  valor_contratado: number | null;
  status: string | null;
  vigencia_assinatura: string | null;
  recorrencia_pagamento: string | null;
  codigo_assinatura_meio_pagamento: string | null;
  nome_plano_master: string | null;
  data_criacao: string | null;
};

type ClienteSemFinanceiro = {
  id: string;
  nome: string | null;
  id_curseduca: string | null;
  email: string | null;
  plano: string | null;
  cs_atual: string | null;
  status_curseduca: string | null;
  status_financeiro_inadimplencia: string | null;
  data_criacao: string | null;
};

function formatCurrency(value: number | null) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const PAGE_SIZE = 25;

function PaginationControls({ page, totalPages, total, onPrev, onNext }: { page: number; totalPages: number; total: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <span className="text-sm text-muted-foreground">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Tab: Vindi sem ID Curseduca ──
function VindiTab() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<Registro[]>([]);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let allData: Registro[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await (supabase
        .from('inconsistencias' as any)
        .select('id, plano, meio_de_pagamento, valor_contratado, status, vigencia_assinatura, recorrencia_pagamento, codigo_assinatura_meio_pagamento, nome_plano_master, data_criacao')
        .eq('fonte', 'vindi')
        .eq('resolvido', false)
        .order('valor_contratado', { ascending: false })
        .range(from, from + batchSize - 1));

      if (error) { console.error(error); break; }
      if (data && data.length > 0) {
        allData = allData.concat(data as unknown as Registro[]);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else { hasMore = false; }
    }
    setRecords(allData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalValor = useMemo(() => records.reduce((s, r) => s + (r.valor_contratado || 0), 0), [records]);
  const totalInadimplentes = useMemo(() => records.filter(r => r.status === 'Inadimplente').length, [records]);
  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paged = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Hash className="h-4 w-4 text-primary" /></div>
            <div><CardDescription className="text-xs">Total</CardDescription><CardTitle className="text-xl">{loading ? '...' : records.length}</CardTitle></div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            <div><CardDescription className="text-xs">Inadimplentes</CardDescription><CardTitle className="text-xl">{loading ? '...' : totalInadimplentes}</CardTitle></div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-emerald-600" /></div>
            <div><CardDescription className="text-xs">Valor total</CardDescription><CardTitle className="text-xl">{loading ? '...' : formatCurrency(totalValor)}</CardTitle></div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <TableSkeleton rows={10} columns={7} /> : (
            <>
              <div className="overflow-auto">
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium truncate max-w-[220px]">{r.plano || '—'}</span>
                            {r.nome_plano_master && <span className="text-[11px] text-muted-foreground">{r.nome_plano_master}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            r.status === 'Adimplente' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                            r.status === 'Inadimplente' ? 'bg-destructive/10 text-destructive border-destructive/20' : ''
                          }>{r.status || '—'}</Badge>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-200">{r.vigencia_assinatura || '—'}</Badge></TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">{formatCurrency(r.valor_contratado)}</TableCell>
                        <TableCell className="text-xs">{r.meio_de_pagamento?.replace('PaymentMethod::', '') || '—'}</TableCell>
                        <TableCell className="text-xs">{r.recorrencia_pagamento || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.codigo_assinatura_meio_pagamento || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{r.data_criacao || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls page={page} totalPages={totalPages} total={records.length} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab: Clientes sem vínculo com financeiro ──
function SemFinanceiroTab() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ClienteSemFinanceiro[]>([]);
  const [page, setPage] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let allData: ClienteSemFinanceiro[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, nome, id_curseduca, email, plano, cs_atual, status_curseduca, status_financeiro_inadimplencia, data_criacao')
        .is('status_financeiro', null)
        .order('nome', { ascending: true })
        .range(from, from + batchSize - 1);

      if (error) { console.error(error); break; }
      if (data && data.length > 0) {
        allData = allData.concat(data as ClienteSemFinanceiro[]);
        from += batchSize;
        hasMore = data.length === batchSize;
      } else { hasMore = false; }
    }
    setRecords(allData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const paged = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    records.forEach(r => { const s = r.status_curseduca || 'Sem status'; map[s] = (map[s] || 0) + 1; });
    return map;
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-3 space-y-0">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center"><Unlink className="h-4 w-4 text-destructive" /></div>
            <div><CardDescription className="text-xs">Sem Vínculo</CardDescription><CardTitle className="text-xl">{loading ? '...' : records.length}</CardTitle></div>
          </CardHeader>
        </Card>
        {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([status, count]) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{status}</CardDescription>
              <CardTitle className="text-xl">{count}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <TableSkeleton rows={10} columns={7} /> : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Nome</TableHead>
                      <TableHead className="font-semibold">ID Curseduca</TableHead>
                      <TableHead className="font-semibold">E-mail</TableHead>
                      <TableHead className="font-semibold">Plano</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">CS Atual</TableHead>
                      <TableHead className="font-semibold">Criação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.nome || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.id_curseduca || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{r.email || '—'}</TableCell>
                        <TableCell className="text-xs max-w-[160px] truncate">{r.plano || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            r.status_curseduca === 'Ativo' ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200' :
                            r.status_curseduca === 'Cancelado' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            r.status_curseduca === 'Implantacao' ? 'bg-blue-500/10 text-blue-700 border-blue-200' :
                            r.status_curseduca === 'Risco por Engajamento' ? 'bg-amber-500/10 text-amber-700 border-amber-200' : ''
                          }>{r.status_curseduca || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.cs_atual || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.data_criacao ? new Date(r.data_criacao).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {paged.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls page={page} totalPages={totalPages} total={records.length} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ──
export default function InconsistenciasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
          <FileWarning className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inconsistências</h1>
          <p className="text-muted-foreground text-sm">Registros que precisam de atenção e correção</p>
        </div>
      </div>

      <Tabs defaultValue="sem-financeiro" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sem-financeiro">Clientes sem Vínculo Financeiro</TabsTrigger>
          <TabsTrigger value="vindi">Vindi sem ID Curseduca</TabsTrigger>
        </TabsList>
        <TabsContent value="sem-financeiro"><SemFinanceiroTab /></TabsContent>
        <TabsContent value="vindi"><VindiTab /></TabsContent>
      </Tabs>
    </div>
  );
}
