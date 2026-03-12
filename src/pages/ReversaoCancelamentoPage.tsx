import { useState, useEffect, useMemo, useCallback } from 'react';
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
  { value: 'elaboracao_proposta', label: 'Elaboração de Proposta', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-400' },
  { value: 'reuniao_reversao', label: 'Reunião de Reversão', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { value: 'cliente_revertido', label: 'Cliente Revertido', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  { value: 'cliente_perdido', label: 'Cliente Perdido', color: 'bg-destructive/20 text-destructive' },
];

const PIE_COLORS = ['#9ca3af', '#3b82f6', '#eab308', '#22c55e', '#ef4444'];

interface MeetingRisk {
  meeting_id: string;
  client_url: string;
  client_name: string | null;
  meeting_date: string;
  loyalty_reason: string | null;
  meeting_title: string;
  created_by_email: string | null;
}

interface TrackingRecord {
  id: string;
  meeting_id: string;
  client_url: string | null;
  client_name: string | null;
  status: string;
  status_changed_at: string;
  notas: string | null;
}

export default function ReversaoCancelamentoPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-primary" />
            Reversão de Cancelamento
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

function useReversaoData(refreshKey: number) {
  const [clients, setClients] = useState<MeetingRisk[]>([]);
  const [tracking, setTracking] = useState<Record<string, TrackingRecord>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch meetings with loyalty_index = 1
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, client_url, client_name, meeting_date, loyalty_reason, title, created_by')
      .eq('loyalty_index', 1)
      .eq('status', 'completed')
      .order('meeting_date', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar dados');
      setLoading(false);
      return;
    }

    const raw = (meetings || []) as any[];

    // Deduplicate by client
    const seen = new Map<string, MeetingRisk>();
    for (const m of raw) {
      const key = m.client_url || m.client_name || m.title;
      if (!seen.has(key)) {
        seen.set(key, {
          meeting_id: m.id,
          client_url: m.client_url || '',
          client_name: m.client_name,
          meeting_date: m.meeting_date,
          loyalty_reason: m.loyalty_reason,
          meeting_title: m.title,
          created_by_email: null,
        });
      }
    }

    // Get CS names
    const userIds = [...new Set(raw.map(m => m.created_by).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name || p.email]));
      for (const m of raw) {
        const key = m.client_url || m.client_name || m.title;
        const entry = seen.get(key);
        if (entry && !entry.created_by_email && m.created_by) {
          entry.created_by_email = profileMap.get(m.created_by) || null;
        }
      }
    }

    // Fetch tracking data
    const { data: trackingData } = await supabase.from('reversao_tracking').select('*');
    const trackMap: Record<string, TrackingRecord> = {};
    if (trackingData) {
      for (const t of trackingData) {
        trackMap[t.meeting_id] = t as TrackingRecord;
      }
    }

    setClients(Array.from(seen.values()));
    setTracking(trackMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  return { clients, tracking, loading, refetch: fetchData, setTracking };
}

// ── Tabela Tab ──
function ReversaoTabelaTab({ refreshKey }: { refreshKey: number }) {
  const { clients, tracking, loading, refetch, setTracking } = useReversaoData(refreshKey);
  const [search, setSearch] = useState('');

  const getStatus = (meetingId: string) => tracking[meetingId]?.status || 'nenhum_contato';

  const handleStatusChange = async (row: MeetingRisk, newStatus: string) => {
    const { data: user } = await supabase.auth.getUser();
    const existing = tracking[row.meeting_id];

    const payload: any = {
      meeting_id: row.meeting_id,
      client_url: row.client_url,
      client_name: row.client_name,
      status: newStatus,
      status_changed_at: new Date().toISOString(),
      updated_by: user?.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing) {
      ({ error } = await supabase.from('reversao_tracking').update(payload).eq('id', existing.id));
    } else {
      ({ error } = await supabase.from('reversao_tracking').insert(payload));
    }

    if (error) {
      toast.error('Erro ao salvar status');
      return;
    }
    toast.success('Status atualizado');
    refetch();
  };

  const handleNotasSave = async (meetingId: string, notas: string, row: MeetingRisk) => {
    const existing = tracking[meetingId];
    if (existing) {
      const { error } = await supabase.from('reversao_tracking')
        .update({ notas: notas || null, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { toast.error('Erro ao salvar'); return; }
    } else {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from('reversao_tracking').insert({
        meeting_id: meetingId,
        client_url: row.client_url,
        client_name: row.client_name,
        notas: notas || null,
        updated_by: user?.user?.id || null,
      });
      if (error) { toast.error('Erro ao salvar'); return; }
    }
    toast.success('Observações salvas');
    refetch();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // Status KPIs
  const statusCounts: Record<string, number> = {};
  REVERSAO_STATUSES.forEach(s => { statusCounts[s.value] = 0; });
  clients.forEach(c => {
    const st = getStatus(c.meeting_id);
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });
  const total = clients.length;

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.client_name || '').toLowerCase().includes(q) ||
      (c.client_url || '').toLowerCase().includes(q) ||
      (c.created_by_email || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Status percentage cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          <CardTitle className="text-sm">Clientes em Reversão ({filtered.length})</CardTitle>
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
                <TableHead>Última Reunião</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>CS Responsável</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Data Status</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, idx) => {
                const tr = tracking[row.meeting_id];
                return (
                  <TableRow key={row.meeting_id || idx}>
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
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(parseISO(row.meeting_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{row.loyalty_reason || '—'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.created_by_email || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Select value={getStatus(row.meeting_id)} onValueChange={(v) => handleStatusChange(row, v)}>
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
                      {tr?.status_changed_at
                        ? format(parseISO(tr.status_changed_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <NotasPopover
                        value={tr?.notas || ''}
                        onSave={(v) => handleNotasSave(row.meeting_id, v, row)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
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
  const { clients, tracking, loading } = useReversaoData(refreshKey);

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const getStatus = (meetingId: string) => tracking[meetingId]?.status || 'nenhum_contato';
  const total = clients.length;

  // Status distribution
  const statusCounts: Record<string, number> = {};
  REVERSAO_STATUSES.forEach(s => { statusCounts[s.value] = 0; });
  clients.forEach(c => {
    const st = getStatus(c.meeting_id);
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  const pieData = REVERSAO_STATUSES.map((s, i) => ({
    name: s.label,
    value: statusCounts[s.value] || 0,
    fill: PIE_COLORS[i],
  })).filter(d => d.value > 0);

  // CS breakdown
  const csCounts: Record<string, Record<string, number>> = {};
  clients.forEach(c => {
    const cs = c.created_by_email || 'Sem CS';
    const st = getStatus(c.meeting_id);
    if (!csCounts[cs]) csCounts[cs] = {};
    csCounts[cs][st] = (csCounts[cs][st] || 0) + 1;
  });

  const csBarData = Object.entries(csCounts).map(([cs, counts]) => ({
    cs: cs.length > 20 ? cs.substring(0, 20) + '...' : cs,
    ...counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  })).sort((a, b) => b.total - a.total).slice(0, 15);

  // Monthly trend from status_changed_at
  const monthlyTrend: Record<string, Record<string, number>> = {};
  Object.values(tracking).forEach(t => {
    if (t.status_changed_at) {
      const month = t.status_changed_at.substring(0, 7); // YYYY-MM
      if (!monthlyTrend[month]) monthlyTrend[month] = {};
      monthlyTrend[month][t.status] = (monthlyTrend[month][t.status] || 0) + 1;
    }
  });

  const trendData = Object.entries(monthlyTrend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
