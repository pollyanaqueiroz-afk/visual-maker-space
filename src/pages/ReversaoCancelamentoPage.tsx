import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RefreshCw, Search, Loader2, TableIcon, BarChart3, CalendarDays, User, StickyNote, Save, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const REVERSAO_STATUSES = [
  { value: 'nenhum_contato', label: 'Nenhum Contato', color: 'bg-muted text-muted-foreground' },
  { value: 'risco_fidelidade', label: 'Risco por Fidelidade', color: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' },
  { value: 'elaboracao_proposta', label: 'Elaboração de Proposta', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  { value: 'reuniao_reversao', label: 'Reunião de Reversão', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { value: 'cliente_revertido', label: 'Cliente Revertido', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  { value: 'cliente_perdido', label: 'Cliente Perdido', color: 'bg-destructive/20 text-destructive' },
];

const PIE_COLORS = ['#9ca3af', '#f97316', '#3b82f6', '#eab308', '#22c55e', '#ef4444'];

interface ChurnRecord {
  id: string;
  id_curseduca: string;
  client_name: string | null;
  client_url: string | null;
  plano: string | null;
  receita: number | null;
  cs_email: string | null;
  cs_nome: string | null;
  meeting_id: string | null;
  loyalty_reason: string | null;
  status: string;
  status_changed_at: string;
  notas: string | null;
  created_at: string;
}

export default function ReversaoCancelamentoPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Recuperação de Churn
          </h1>
          <p className="text-sm text-muted-foreground">Clientes com índice de fidelidade 1 — acompanhamento de reversão</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="tabela" className="text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />Tabela</TabsTrigger>
          <TabsTrigger value="graficos" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Gráficos</TabsTrigger>
        </TabsList>
        <TabsContent value="tabela"><ReversaoTabelaTab refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="graficos"><ReversaoGraficosTab refreshKey={refreshKey} /></TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Syncs meetings with loyalty_index=1 into cliente_churn table.
 * Uses id_curseduca (derived from client_url) as unique key.
 */
async function syncChurnFromMeetings() {
  // Fetch meetings with loyalty_index = 1 OR 2
  const { data: meetings } = await supabase
    .from('meetings')
    .select('id, client_url, client_name, meeting_date, loyalty_reason, created_by, loyalty_index')
    .in('loyalty_index', [1, 2])
    .eq('status', 'completed')
    .order('meeting_date', { ascending: false });

  if (!meetings || meetings.length === 0) return;

  // Deduplicate by client_url, keeping most recent
  const seen = new Map<string, any>();
  for (const m of meetings) {
    const key = m.client_url || m.client_name || m.id;
    if (!seen.has(key)) seen.set(key, m);
  }

  // Get existing records
  const { data: existing } = await supabase.from('cliente_churn').select('id_curseduca');
  const existingKeys = new Set((existing || []).map(e => e.id_curseduca));

  // Resolve CS emails
  const userIds = [...new Set(meetings.map(m => m.created_by).filter(Boolean))];
  const profileMap = new Map<string, { email: string; name: string }>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    for (const p of profiles || []) {
      profileMap.set(p.user_id, { email: p.email, name: p.display_name || p.email });
    }
  }

  // Insert new ones — loyalty_index=1 → nenhum_contato, loyalty_index=2 → risco_fidelidade
  const toInsert: any[] = [];
  for (const [key, m] of seen) {
    const idCurseduca = m.client_url || key;
    if (existingKeys.has(idCurseduca)) continue;

    const profile = m.created_by ? profileMap.get(m.created_by) : null;
    const initialStatus = m.loyalty_index === 2 ? 'risco_fidelidade' : 'nenhum_contato';
    toInsert.push({
      id_curseduca: idCurseduca,
      client_name: m.client_name,
      client_url: m.client_url,
      meeting_id: m.id,
      loyalty_reason: m.loyalty_reason,
      cs_email: profile?.email || null,
      cs_nome: profile?.name || null,
      status: initialStatus,
    });
  }

  if (toInsert.length > 0) {
    await supabase.from('cliente_churn').insert(toInsert);
  }
}

function useChurnData(refreshKey: number) {
  const [records, setRecords] = useState<ChurnRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // First sync new loyalty_index=1 meetings into cliente_churn
    await syncChurnFromMeetings();

    // Then fetch all records
    const { data, error } = await supabase
      .from('cliente_churn')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar dados');
      setLoading(false);
      return;
    }

    setRecords((data || []) as ChurnRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  return { records, loading, refetch: fetchData };
}

// ── Tabela Tab ──
function ReversaoTabelaTab({ refreshKey }: { refreshKey: number }) {
  const { records, loading, refetch } = useChurnData(refreshKey);
  const [search, setSearch] = useState('');

  const handleStatusChange = async (record: ChurnRecord, newStatus: string) => {
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('cliente_churn').update({
      status: newStatus,
      status_changed_at: new Date().toISOString(),
      updated_by: user?.user?.id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', record.id);

    if (error) { toast.error('Erro ao salvar status'); return; }
    toast.success('Status atualizado');
    refetch();
  };

  const handleNotasSave = async (record: ChurnRecord, notas: string) => {
    const { error } = await supabase.from('cliente_churn')
      .update({ notas: notas || null, updated_at: new Date().toISOString() })
      .eq('id', record.id);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Observações salvas');
    refetch();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Status KPIs
  const statusCounts: Record<string, number> = {};
  REVERSAO_STATUSES.forEach(s => { statusCounts[s.value] = 0; });
  records.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  const total = records.length;

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.client_name || '').toLowerCase().includes(q) ||
      (r.client_url || '').toLowerCase().includes(q) ||
      (r.id_curseduca || '').toLowerCase().includes(q) ||
      (r.cs_nome || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Status percentage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {REVERSAO_STATUSES.map(s => {
          const count = statusCounts[s.value] || 0;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <Card key={s.value} className="border">
              <CardContent className="p-3 text-center">
                <Badge className={cn('mb-1', s.color)}>{s.label}</Badge>
                <p className="text-xl font-bold text-foreground">{pct}%</p>
                <span className="text-[11px] text-muted-foreground">{count} de {total}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Clientes em Recuperação ({filtered.length})</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 max-w-xs h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>ID Curseduca</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>CS Responsável</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Data Status</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {row.client_name && <span className="text-sm font-medium text-foreground">{row.client_name}</span>}
                      {row.client_url ? (
                        <a href={row.client_url.startsWith('http') ? row.client_url : `https://${row.client_url}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline truncate max-w-[200px]">
                          {row.client_url}
                        </a>
                      ) : <span className="text-xs text-muted-foreground">Sem URL</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{row.id_curseduca}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{row.plano || '—'}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{row.loyalty_reason || '—'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {row.cs_nome || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Select value={row.status} onValueChange={(v) => handleStatusChange(row, v)}>
                      <SelectTrigger className="h-7 w-[170px] text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REVERSAO_STATUSES.map(s => (
                          <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.status_changed_at
                      ? format(parseISO(row.status_changed_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <NotasPopover
                      value={row.notas || ''}
                      onSave={(v) => handleNotasSave(row, v)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NotasPopover({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o && draft !== value) onSave(draft); setOpen(o); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <StickyNote className="h-3 w-3" />
          {value ? 'Ver notas' : 'Adicionar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Observações..." rows={4} className="text-sm" />
        <Button size="sm" className="mt-2 w-full h-7 text-xs" onClick={() => { onSave(draft); setOpen(false); }}>
          <Save className="h-3 w-3 mr-1" /> Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

// ── Gráficos Tab ──
function ReversaoGraficosTab({ refreshKey }: { refreshKey: number }) {
  const { records, loading } = useChurnData(refreshKey);

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const total = records.length;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  REVERSAO_STATUSES.forEach(s => { statusCounts[s.value] = 0; });
  records.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });

  const pieData = REVERSAO_STATUSES.map((s, i) => ({
    name: s.label,
    value: statusCounts[s.value] || 0,
    fill: PIE_COLORS[i],
  })).filter(d => d.value > 0);

  // CS breakdown
  const csCounts: Record<string, Record<string, number>> = {};
  records.forEach(r => {
    const cs = r.cs_nome || r.cs_email || 'Sem CS';
    if (!csCounts[cs]) csCounts[cs] = {};
    csCounts[cs][r.status] = (csCounts[cs][r.status] || 0) + 1;
  });

  const csBarData = Object.entries(csCounts).map(([cs, counts]) => ({
    cs: cs.length > 20 ? cs.substring(0, 20) + '...' : cs,
    ...counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  })).sort((a, b) => b.total - a.total).slice(0, 15);

  // Monthly trend
  const monthlyTrend: Record<string, Record<string, number>> = {};
  records.forEach(r => {
    if (r.status_changed_at) {
      const month = r.status_changed_at.substring(0, 7);
      if (month >= '2026-01') {
        if (!monthlyTrend[month]) monthlyTrend[month] = {};
        monthlyTrend[month][r.status] = (monthlyTrend[month][r.status] || 0) + 1;
      }
    }
  });

  const trendData = Object.entries(monthlyTrend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {REVERSAO_STATUSES.map(s => {
          const count = statusCounts[s.value] || 0;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
          return (
            <Card key={s.value} className="border">
              <CardContent className="p-3 text-center">
                <Badge className={cn('mb-1', s.color)}>{s.label}</Badge>
                <p className="text-xl font-bold text-foreground">{pct}%</p>
                <span className="text-[11px] text-muted-foreground">{count} clientes</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* CS breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Clientes por CS</CardTitle></CardHeader>
          <CardContent>
            {csBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(csBarData.length * 35, 150)}>
                <BarChart data={csBarData} layout="vertical" margin={{ left: 100, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="cs" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Legend />
                  {REVERSAO_STATUSES.map((s, i) => (
                    <Bar key={s.value} dataKey={s.value} name={s.label} stackId="a" fill={PIE_COLORS[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução Mensal de Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {REVERSAO_STATUSES.map((s, i) => (
                  <Bar key={s.value} dataKey={s.value} name={s.label} stackId="a" fill={PIE_COLORS[i]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
