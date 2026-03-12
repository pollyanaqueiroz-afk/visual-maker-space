import { useState, useEffect, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDashboardBI, formatBRL, formatNumber, nullDash } from '@/hooks/useDashboardBI';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, X, Rocket, TableIcon, BarChart3, Search, Loader2, DollarSign, Save, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CSItem { cs_nome: string; cs_email: string; total: number; }
interface UpsellOportunidade {
  id_curseduca: string; nome: string; plano: string; receita: number | null;
  score_potencial_upsell: number; elegivel_upsell_banda: boolean; elegivel_upsell_tokens: boolean;
  elegivel_upsell_alunos: boolean; elegivel_upsell_produtos: boolean;
  upsell_total_realizado: number | null; data_ultimo_upsell: string | null;
  uso_banda_pct: number | null; uso_tokens_pct: number | null; uso_storage_pct: number | null;
  alunos_atual: number | null; crescimento_membros: number | null;
  cs_nome: string | null; cs_email: string | null;
}
interface UpsellOverview {
  total_ativos: number; com_potencial_upsell: number;
  elegivel_banda: number; elegivel_tokens: number; elegivel_alunos: number; elegivel_produtos: number;
  total_elegiveis: number; score_medio: number; upsell_total_realizado: number;
  media_uso_banda_pct: number; media_uso_tokens_pct: number; media_uso_storage_pct: number;
  receita_base_elegiveis: number;
}
interface UpsellTipo { tipo: string; elegiveis: number; media_uso_pct: number | null; receita_elegiveis: number; }

const UPSELL_STATUSES = [
  { value: 'nenhum_contato', label: 'Nenhum Contato', color: 'bg-muted text-muted-foreground' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  { value: 'em_negociacao', label: 'Em Negociação', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { value: 'proposta_aceita', label: 'Proposta Aceita', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  { value: 'pagamento_realizado', label: 'Pagamento Realizado', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
];

const extractName = (csNome: string, csEmail: string): string => {
  if (csNome && csNome !== 'CS') return csNome;
  if (!csEmail) return 'Sem CS';
  return csEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

interface TrackingRecord {
  id: string;
  id_curseduca: string;
  client_name: string | null;
  client_url: string | null;
  tipo: string;
  status: string;
  valor_pagamento: number | null;
  data_pagamento: string | null;
}

export default function UpsellPage() {
  const [csFilter, setCsFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: csOptions } = useDashboardBI<CSItem[]>('cs');
  const csEmail = csFilter || undefined;

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Upsell
          </h1>
          <p className="text-sm text-muted-foreground">Oportunidades de expansão de receita</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={csFilter} onValueChange={v => setCsFilter(v === '__clear__' ? '' : v)}>
            <SelectTrigger className="w-[220px] h-8 text-sm">
              <SelectValue placeholder="Filtrar por CS..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Todos os CSs</SelectItem>
              {(csOptions || []).filter(c => c.cs_email).map(cs => (
                <SelectItem key={cs.cs_email} value={cs.cs_email}>
                  {extractName(cs.cs_nome, cs.cs_email)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {csFilter && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs cursor-pointer" onClick={() => setCsFilter('')}>
              Filtro: {csFilter.split('@')[0]} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="tabela" className="text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />Tabela</TabsTrigger>
          <TabsTrigger value="graficos" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela"><UpsellTabelaTab csEmail={csEmail} refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="graficos"><UpsellGraficosTab csEmail={csEmail} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tabela Tab with status tracking ──
function UpsellTabelaTab({ csEmail, refreshKey }: { csEmail?: string; refreshKey: number }) {
  const { data: apiData, loading } = useDashboardBI<UpsellOportunidade[]>('upsell_oportunidades', csEmail);
  const [tracking, setTracking] = useState<Record<string, TrackingRecord>>({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [paymentDialog, setPaymentDialog] = useState<{ id_curseduca: string; tipo: string; nome: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [saving, setSaving] = useState(false);
  const perPage = 20;

  // Only show clients that exceed banda, storage or tokens
  const exceedingClients = useMemo(() => {
    if (!apiData) return [];
    return apiData.filter(r =>
      r.elegivel_upsell_banda || r.elegivel_upsell_tokens ||
      (r.uso_banda_pct != null && r.uso_banda_pct > 80) ||
      (r.uso_tokens_pct != null && r.uso_tokens_pct > 80) ||
      (r.uso_storage_pct != null && r.uso_storage_pct > 80)
    );
  }, [apiData]);

  // Load tracking data from DB
  const loadTracking = useCallback(async () => {
    const { data } = await supabase.from('upsell_tracking').select('*');
    if (data) {
      const map: Record<string, TrackingRecord> = {};
      for (const row of data) {
        map[`${row.id_curseduca}_${row.tipo}`] = row as TrackingRecord;
      }
      setTracking(map);
    }
  }, []);

  useEffect(() => { loadTracking(); }, [loadTracking, refreshKey]);

  const getTrackingStatus = (id_curseduca: string, tipo: string) => {
    return tracking[`${id_curseduca}_${tipo}`]?.status || 'nenhum_contato';
  };

  const handleStatusChange = async (id_curseduca: string, tipo: string, newStatus: string, clientName: string) => {
    if (newStatus === 'pagamento_realizado') {
      setPaymentDialog({ id_curseduca, tipo, nome: clientName });
      return;
    }
    await upsertTracking(id_curseduca, tipo, newStatus, clientName);
  };

  const upsertTracking = async (id_curseduca: string, tipo: string, status: string, clientName: string, valor?: number, dataPagamento?: string) => {
    const { data: user } = await supabase.auth.getUser();
    const payload: any = {
      id_curseduca, tipo, status,
      client_name: clientName,
      updated_by: user?.user?.id || null,
      updated_at: new Date().toISOString(),
    };
    if (valor != null) payload.valor_pagamento = valor;
    if (dataPagamento) payload.data_pagamento = dataPagamento;

    const existing = tracking[`${id_curseduca}_${tipo}`];
    let error;
    if (existing) {
      ({ error } = await supabase.from('upsell_tracking').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('upsell_tracking').insert(payload));
    }

    if (error) {
      toast.error('Erro ao salvar status');
      return;
    }
    toast.success('Status atualizado');
    loadTracking();
  };

  const handlePaymentSave = async () => {
    if (!paymentDialog) return;
    setSaving(true);
    const valor = parseFloat(paymentAmount.replace(',', '.'));
    await upsertTracking(
      paymentDialog.id_curseduca,
      paymentDialog.tipo,
      'pagamento_realizado',
      paymentDialog.nome,
      isNaN(valor) ? undefined : valor,
      paymentDate || undefined
    );
    setSaving(false);
    setPaymentDialog(null);
    setPaymentAmount('');
    setPaymentDate('');
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!exceedingClients.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum cliente excedendo limites encontrado.</CardContent></Card>;

  // Calculate status percentages
  const allTrackingEntries = exceedingClients.flatMap(c => {
    const tipos: string[] = [];
    if (c.elegivel_upsell_banda || (c.uso_banda_pct != null && c.uso_banda_pct > 80)) tipos.push('banda');
    if (c.elegivel_upsell_tokens || (c.uso_tokens_pct != null && c.uso_tokens_pct > 80)) tipos.push('tokens');
    if (c.uso_storage_pct != null && c.uso_storage_pct > 80) tipos.push('storage');
    if (tipos.length === 0) tipos.push('geral');
    return tipos.map(t => ({ id_curseduca: c.id_curseduca, tipo: t }));
  });

  const totalEntries = allTrackingEntries.length;
  const statusCounts: Record<string, number> = {};
  UPSELL_STATUSES.forEach(s => { statusCounts[s.value] = 0; });
  allTrackingEntries.forEach(e => {
    const st = getTrackingStatus(e.id_curseduca, e.tipo);
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  // Payment totals
  const paidRecords = Object.values(tracking).filter(t => t.status === 'pagamento_realizado' && t.valor_pagamento);
  const totalPaid = paidRecords.reduce((sum, r) => sum + (r.valor_pagamento || 0), 0);

  // Sales by period
  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    paidRecords.forEach(r => {
      if (r.data_pagamento) {
        const day = r.data_pagamento;
        map[day] = (map[day] || 0) + (r.valor_pagamento || 0);
      }
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({
      label: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      total,
    }));
  }, [paidRecords]);

  const filtered = exceedingClients.filter(r =>
    r.nome?.toLowerCase().includes(search.toLowerCase()) ||
    r.id_curseduca?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-4">
      {/* Status percentage KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {UPSELL_STATUSES.map(s => {
          const count = statusCounts[s.value] || 0;
          const pct = totalEntries > 0 ? ((count / totalEntries) * 100).toFixed(1) : '0.0';
          return (
            <Card key={s.value} className="border">
              <CardContent className="p-3 text-center">
                <Badge className={cn('mb-1', s.color)}>{s.label}</Badge>
                <p className="text-xl font-bold text-foreground">{pct}%</p>
                <span className="text-[11px] text-muted-foreground">{count} de {totalEntries}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Payment summary */}
      {paidRecords.length > 0 && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-medium">Total Pagamento Realizado</span>
              </div>
              <span className="text-xl font-bold text-emerald-600">{formatBRL(totalPaid)}</span>
            </div>
            {salesByDay.length > 1 && (
              <div className="mt-3">
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={salesByDay}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Clientes Excedendo Limites ({filtered.length})</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-8 max-w-xs h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Banda</TableHead>
                <TableHead>Tokens IA</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Status Banda</TableHead>
                <TableHead>Status Tokens</TableHead>
                <TableHead>Status Storage</TableHead>
                <TableHead>CS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r, i) => {
                const bandaExcede = (r.uso_banda_pct != null && r.uso_banda_pct > 80) || r.elegivel_upsell_banda;
                const tokensExcede = (r.uso_tokens_pct != null && r.uso_tokens_pct > 80) || r.elegivel_upsell_tokens;
                const storageExcede = r.uso_storage_pct != null && r.uso_storage_pct > 80;

                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.nome || r.id_curseduca}</TableCell>
                    <TableCell>
                      {bandaExcede ? (
                        <span className="text-destructive font-semibold text-sm">{r.uso_banda_pct?.toFixed(0)}%</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.uso_banda_pct != null ? `${r.uso_banda_pct.toFixed(0)}%` : '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tokensExcede ? (
                        <span className="text-destructive font-semibold text-sm">{r.uso_tokens_pct?.toFixed(0)}%</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.uso_tokens_pct != null ? `${r.uso_tokens_pct.toFixed(0)}%` : '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {storageExcede ? (
                        <span className="text-destructive font-semibold text-sm">{r.uso_storage_pct?.toFixed(0)}%</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">{r.uso_storage_pct != null ? `${r.uso_storage_pct.toFixed(0)}%` : '—'}</span>
                      )}
                    </TableCell>
                    {/* Status selects for each tipo */}
                    <TableCell>
                      {bandaExcede ? (
                        <StatusSelect
                          value={getTrackingStatus(r.id_curseduca, 'banda')}
                          onChange={(v) => handleStatusChange(r.id_curseduca, 'banda', v, r.nome)}
                        />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {tokensExcede ? (
                        <StatusSelect
                          value={getTrackingStatus(r.id_curseduca, 'tokens')}
                          onChange={(v) => handleStatusChange(r.id_curseduca, 'tokens', v, r.nome)}
                        />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {storageExcede ? (
                        <StatusSelect
                          value={getTrackingStatus(r.id_curseduca, 'storage')}
                          onChange={(v) => handleStatusChange(r.id_curseduca, 'storage', v, r.nome)}
                        />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{nullDash(r.cs_nome)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Anterior</button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Próxima</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(o) => { if (!o) setPaymentDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento — {paymentDialog?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Valor do Pagamento</label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="0,00"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Data do Pagamento</label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Cancelar</Button>
            <Button onClick={handlePaymentSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const status = UPSELL_STATUSES.find(s => s.value === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-[150px] text-[11px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {UPSELL_STATUSES.map(s => (
          <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Gráficos Tab ──
function UpsellGraficosTab({ csEmail }: { csEmail?: string }) {
  return (
    <div className="space-y-6">
      <UpsellKPIsSection csEmail={csEmail} />
      <UpsellPorTipo csEmail={csEmail} />
    </div>
  );
}

function GaugeCard({ label, value }: { label: string; value: number }) {
  const pct = Math.min(value, 100);
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f97316' : '#22c55e';
  const gaugeData = [{ value: pct, fill: color }];

  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center">
        <span className="text-xs text-muted-foreground mb-2">{label}</span>
        <ResponsiveContainer width={140} height={140}>
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={180} endAngle={0} data={gaugeData} barSize={12}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={6} />
          </RadialBarChart>
        </ResponsiveContainer>
        <span className="text-2xl font-bold -mt-8" style={{ color }}>{value.toFixed(1)}%</span>
      </CardContent>
    </Card>
  );
}

function UpsellKPIsSection({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<UpsellOverview>('upsell_overview', csEmail);
  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!data) return null;

  const cards = [
    { label: 'Total Elegíveis', value: formatNumber(data.total_elegiveis), color: 'border-blue-500/30 bg-blue-500/5' },
    { label: 'Score Médio', value: data.score_medio?.toFixed(1) ?? '—', color: 'border-blue-500/30 bg-blue-500/5' },
    { label: 'Upsell Realizado', value: formatBRL(data.upsell_total_realizado), color: 'border-green-500/30 bg-green-500/5' },
    { label: 'Receita Base', value: formatBRL(data.receita_base_elegiveis), color: 'border-muted bg-muted/30' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <Card key={c.label} className={cn('border', c.color)}>
            <CardContent className="p-4 text-center">
              <p className="text-xl font-bold text-foreground">{c.value}</p>
              <span className="text-[11px] text-muted-foreground">{c.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GaugeCard label="Uso Banda" value={data.media_uso_banda_pct ?? 0} />
        <GaugeCard label="Uso Tokens IA" value={data.media_uso_tokens_pct ?? 0} />
        <GaugeCard label="Uso Storage" value={data.media_uso_storage_pct ?? 0} />
      </div>
    </div>
  );
}

function UpsellPorTipo({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<UpsellTipo[]>('upsell_por_tipo', csEmail);
  if (loading) return <Card><CardContent className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  if (!data || data.length === 0) return null;

  const TIPO_COLORS: Record<string, string> = { Banda: '#3b82f6', 'Tokens IA': '#8b5cf6', Alunos: '#f97316', Produtos: '#22c55e' };
  const chartData = data.map(d => ({ ...d, fill: TIPO_COLORS[d.tipo] || '#9ca3af' }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Oportunidades por Tipo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={Math.max(data.length * 50, 120)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number) => formatNumber(v)} />
            <Bar dataKey="elegiveis" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Elegíveis</TableHead>
            <TableHead>Uso Médio</TableHead>
            <TableHead className="text-right">Receita Elegíveis</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: TIPO_COLORS[r.tipo] || '#9ca3af' }} />
                    <span className="text-sm font-medium">{r.tipo}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(r.elegiveis)}</TableCell>
                <TableCell>
                  {r.media_uso_pct != null ? (
                    r.media_uso_pct > 80 ? <Badge variant="destructive" className="text-[10px]">Saturado ({r.media_uso_pct.toFixed(0)}%)</Badge>
                    : <span className="text-sm">{r.media_uso_pct.toFixed(0)}%</span>
                  ) : <span className="text-xs text-muted-foreground">N/A</span>}
                </TableCell>
                <TableCell className="text-right">{formatBRL(r.receita_elegiveis)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
