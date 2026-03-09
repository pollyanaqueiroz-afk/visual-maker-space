import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle, XCircle, Clock, Star, TrendingUp, Users, BarChart3, Globe, Heart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import LoyaltyTrackingTab from '@/components/dashboard/LoyaltyTrackingTab';
import { KpiCard } from '@/components/dashboard/KpiCard';

const MEETING_REASONS = [
  'Passagem de bastão Closer <> Onboarding',
  'Passagem de bastão Onboarding <> CS',
  'Apresentação do CS para o cliente',
  'Reunião interna de definição do escopo implantação',
  'Negociação',
  'Inadimplência',
  'Upsell',
  'Reversão de Churn',
  'Renovação',
  'Definição de implantação',
  'Follow Up de implantação',
  'Resolução de problemas proativos',
  'Encantamento proativo',
  'Resolução reativa',
];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'hsl(var(--info))',
  completed: 'hsl(var(--success))',
  cancelled: 'hsl(var(--destructive))',
};

const PIE_COLORS = ['hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  status: string;
  client_email: string | null;
  client_name: string | null;
  client_url: string | null;
  meeting_reason: string | null;
  loyalty_index: number | null;
  loyalty_reason: string | null;
  duration_minutes: number;
}

export default function MeetingsDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('current');
  const [activeKPI, setActiveKPI] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, loyalty_reason, duration_minutes, created_by')
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: false });
      if (error) {
        console.error(error);
        toast.error('Erro ao carregar dados');
      } else {
        setMeetings((data || []) as Meeting[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return meetings;
    const now = new Date();
    let start: Date, end: Date;
    if (periodFilter === 'current') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      const prev = subMonths(now, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
    }
    return meetings.filter(m => {
      const d = parseISO(m.meeting_date);
      return isWithinInterval(d, { start, end });
    });
  }, [meetings, periodFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter(m => m.status === 'completed').length;
    const scheduled = filtered.filter(m => m.status === 'scheduled').length;
    const cancelled = filtered.filter(m => m.status === 'cancelled').length;
    const withLoyalty = filtered.filter(m => m.loyalty_index != null && m.loyalty_index > 0);
    const avgLoyalty = withLoyalty.length > 0
      ? (withLoyalty.reduce((s, m) => s + (m.loyalty_index || 0), 0) / withLoyalty.length).toFixed(1)
      : '—';
    const totalMinutes = filtered.filter(m => m.status === 'completed').reduce((s, m) => s + m.duration_minutes, 0);
    const uniqueClients = new Set(filtered.filter(m => m.client_email).map(m => m.client_email!.toLowerCase())).size;
    return { total, completed, scheduled, cancelled, avgLoyalty, totalMinutes, uniqueClients };
  }, [filtered]);

  const toggleKPI = (kpi: string) => {
    setActiveKPI(prev => prev === kpi ? null : kpi);
  };

  const kpiFilteredMeetings = useMemo(() => {
    if (!activeKPI) return [];
    switch (activeKPI) {
      case 'total':
        return filtered;
      case 'completed':
        return filtered.filter(m => m.status === 'completed');
      case 'scheduled':
        return filtered.filter(m => m.status === 'scheduled');
      case 'cancelled':
        return filtered.filter(m => m.status === 'cancelled');
      case 'loyalty':
        return filtered.filter(m => m.loyalty_index != null).sort((a, b) => (b.loyalty_index || 0) - (a.loyalty_index || 0));
      case 'hours':
        return filtered.filter(m => m.status === 'completed' && m.duration_minutes > 0).sort((a, b) => b.duration_minutes - a.duration_minutes);
      case 'clients':
        return filtered.filter(m => m.client_email);
      default:
        return [];
    }
  }, [activeKPI, filtered]);

  const clientsGrouped = useMemo(() => {
    if (activeKPI !== 'clients') return [];
    const map: Record<string, { email: string; name: string; url: string; total: number; completed: number; scheduled: number; cancelled: number; meetings: Meeting[] }> = {};
    for (const m of filtered) {
      if (!m.client_email) continue;
      const key = m.client_email.toLowerCase();
      if (!map[key]) {
        map[key] = { email: key, name: m.client_name || '', url: m.client_url || '', total: 0, completed: 0, scheduled: 0, cancelled: 0, meetings: [] };
      }
      map[key].total += 1;
      if (m.status === 'completed') map[key].completed += 1;
      else if (m.status === 'scheduled') map[key].scheduled += 1;
      else if (m.status === 'cancelled') map[key].cancelled += 1;
      map[key].meetings.push(m);
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [activeKPI, filtered]);

  const byReason = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of filtered) {
      const r = m.meeting_reason || 'Sem motivo';
      map[r] = (map[r] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + '…' : name, fullName: name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const byStatus = useMemo(() => [
    { name: 'Agendadas', value: stats.scheduled },
    { name: 'Realizadas', value: stats.completed },
    { name: 'Canceladas', value: stats.cancelled },
  ], [stats]);

  const loyaltyDist = useMemo(() => {
    const dist = [0, 0, 0, 0];
    for (const m of filtered) {
      if (m.loyalty_index && m.loyalty_index >= 1 && m.loyalty_index <= 4) {
        dist[m.loyalty_index - 1]++;
      }
    }
    const internalCount = filtered.filter(m => m.loyalty_index === 0).length;
    return [
      { name: '1 — Muito baixo', value: dist[0] },
      { name: '2 — Baixo', value: dist[1] },
      { name: '3 — Alto', value: dist[2] },
      { name: '4 — Muito alto', value: dist[3] },
      ...(internalCount > 0 ? [{ name: 'Internas', value: internalCount }] : []),
    ];
  }, [filtered]);

  const byClientUrl = useMemo(() => {
    const map: Record<string, { url: string; scheduled: number; completed: number; cancelled: number; total: number }> = {};
    for (const m of filtered) {
      const url = m.client_url || 'Sem URL';
      if (!map[url]) map[url] = { url, scheduled: 0, completed: 0, cancelled: 0, total: 0 };
      map[url].total++;
      if (m.status === 'completed') map[url].completed++;
      else if (m.status === 'scheduled') map[url].scheduled++;
      else if (m.status === 'cancelled') map[url].cancelled++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const LOYALTY_COLORS = ['hsl(var(--destructive))', 'hsl(var(--warning, 30 90% 50%))', 'hsl(var(--info))', 'hsl(var(--success))'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Carregando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Reuniões</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Logado como <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </div>
      </div>

      <Tabs defaultValue="reunioes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="reunioes" className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> Reuniões
          </TabsTrigger>
          <TabsTrigger value="fidelidade" className="flex items-center gap-1.5">
            <Heart className="h-4 w-4" /> Fidelidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fidelidade">
          <LoyaltyTrackingTab />
        </TabsContent>

        <TabsContent value="reunioes" className="space-y-6">

      {/* Period filter */}
      <div className="flex justify-end">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="previous">Mês anterior</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total" value={stats.total} icon={CalendarDays} color="bg-primary/10 text-primary"
          onClick={() => toggleKPI('total')} active={activeKPI === 'total'} />
        <KpiCard label="Realizadas" value={stats.completed} icon={CheckCircle} color="bg-success/10 text-success"
          onClick={() => toggleKPI('completed')} active={activeKPI === 'completed'} />
        <KpiCard label="Agendadas" value={stats.scheduled} icon={Clock} color="bg-info/10 text-info"
          onClick={() => toggleKPI('scheduled')} active={activeKPI === 'scheduled'} />
        <KpiCard label="Canceladas" value={stats.cancelled} icon={XCircle} color="bg-destructive/10 text-destructive"
          onClick={() => toggleKPI('cancelled')} active={activeKPI === 'cancelled'} />
        <KpiCard label="Fidelidade" value={stats.avgLoyalty} icon={Star} color="bg-warning/10 text-warning"
          onClick={() => toggleKPI('loyalty')} active={activeKPI === 'loyalty'} />
        <KpiCard label="Horas" value={`${Math.round(stats.totalMinutes / 60)}h`} icon={TrendingUp} color="bg-primary/10 text-primary"
          onClick={() => toggleKPI('hours')} active={activeKPI === 'hours'} />
        <KpiCard label="Clientes" value={stats.uniqueClients} icon={Users} color="bg-accent text-accent-foreground"
          onClick={() => toggleKPI('clients')} active={activeKPI === 'clients'} />
      </div>

      {/* KPI Detail: Clients grouped */}
      {activeKPI === 'clients' && clientsGrouped.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-kpi)] animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-accent-foreground" /> Clientes únicos ({clientsGrouped.length})
              </CardTitle>
              <button onClick={() => setActiveKPI(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realizadas</TableHead>
                  <TableHead className="text-center">Agendadas</TableHead>
                  <TableHead className="text-center">Canceladas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientsGrouped.map(c => (
                  <TableRow key={c.email}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{c.name || c.email}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{c.url}</a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{c.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/20 text-success border-0 text-[10px]">{c.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-info/20 text-info border-0 text-[10px]">{c.scheduled}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">{c.cancelled}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* KPI Detail: Meeting list (non-clients) */}
      {activeKPI && activeKPI !== 'clients' && kpiFilteredMeetings.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-kpi)] animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {activeKPI === 'total' && <><CalendarDays className="h-4 w-4 text-primary" /> Todas as reuniões ({kpiFilteredMeetings.length})</>}
                {activeKPI === 'completed' && <><CheckCircle className="h-4 w-4 text-success" /> Reuniões realizadas ({kpiFilteredMeetings.length})</>}
                {activeKPI === 'scheduled' && <><Clock className="h-4 w-4 text-info" /> Reuniões agendadas ({kpiFilteredMeetings.length})</>}
                {activeKPI === 'cancelled' && <><XCircle className="h-4 w-4 text-destructive" /> Reuniões canceladas ({kpiFilteredMeetings.length})</>}
                {activeKPI === 'loyalty' && <><Star className="h-4 w-4 text-warning" /> Reuniões com fidelidade ({kpiFilteredMeetings.length})</>}
                {activeKPI === 'hours' && <><TrendingUp className="h-4 w-4 text-primary" /> Reuniões por duração ({kpiFilteredMeetings.length})</>}
              </CardTitle>
              <button onClick={() => setActiveKPI(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {(activeKPI === 'loyalty' || activeKPI === 'total') && <TableHead className="text-center">Fidelidade</TableHead>}
                  {(activeKPI === 'hours' || activeKPI === 'total') && <TableHead className="text-center">Duração</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpiFilteredMeetings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm font-medium">
                      {format(parseISO(m.meeting_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.meeting_time || '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate" title={m.title}>
                      {m.title || '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{m.client_name || '—'}</p>
                        {m.client_url && (
                          <a href={m.client_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                            {m.client_url}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={m.meeting_reason || ''}>
                      {m.meeting_reason || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`border-0 text-[10px] ${
                        m.status === 'completed' ? 'bg-success/20 text-success' :
                        m.status === 'scheduled' ? 'bg-info/20 text-info' :
                        'bg-destructive/20 text-destructive'
                      }`}>
                        {m.status === 'completed' ? 'Realizada' : m.status === 'scheduled' ? 'Agendada' : 'Cancelada'}
                      </Badge>
                    </TableCell>
                    {(activeKPI === 'loyalty' || activeKPI === 'total') && (
                      <TableCell className="text-center">
                        {m.loyalty_index === 0 ? (
                          <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">Interna</Badge>
                        ) : m.loyalty_index != null ? (
                          <Badge variant="outline" className={`text-[10px] ${
                            m.loyalty_index >= 3 ? 'border-success/30 text-success' :
                            m.loyalty_index >= 2 ? 'border-warning/30 text-warning' :
                            'border-destructive/30 text-destructive'
                          }`}>
                            <Star className="h-2.5 w-2.5 mr-0.5" /> {m.loyalty_index}
                          </Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {(activeKPI === 'hours' || activeKPI === 'total') && (
                      <TableCell className="text-center">
                        <span className="text-sm">{m.duration_minutes > 0 ? `${m.duration_minutes}min` : '—'}</span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {activeKPI && ((activeKPI === 'clients' && clientsGrouped.length === 0) || (activeKPI !== 'clients' && kpiFilteredMeetings.length === 0)) && (
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma reunião encontrada para este filtro
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} strokeWidth={2} stroke="hsl(var(--card))" label={false}>
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                {/* Central label */}
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">
                  {stats.total}
                </text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
                  reuniões
                </text>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Índice de Fidelidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={loyaltyDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {loyaltyDist.map((_, i) => (
                    <Cell key={i} fill={LOYALTY_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* By Reason Bar Chart */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reuniões por Motivo</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, byReason.length * 36)}>
              <BarChart data={byReason} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} formatter={(v: number, _: string, props: any) => [v, props.payload.fullName]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* By Client URL Table */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Reuniões por URL do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byClientUrl.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL do Cliente</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realizadas</TableHead>
                  <TableHead className="text-center">Agendadas</TableHead>
                  <TableHead className="text-center">Canceladas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClientUrl.map(row => (
                  <TableRow key={row.url}>
                    <TableCell className="font-medium text-sm">
                      {row.url !== 'Sem URL' ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{row.url}</a>
                      ) : (
                        <span className="text-muted-foreground">Sem URL</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/20 text-success">{row.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-info/20 text-info">{row.scheduled}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive">{row.cancelled}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
