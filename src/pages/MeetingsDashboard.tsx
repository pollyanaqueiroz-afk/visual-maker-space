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
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import LoyaltyTrackingTab from '@/components/dashboard/LoyaltyTrackingTab';

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
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await (supabase
        .from('meetings' as any)
        .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, loyalty_reason, duration_minutes, created_by')
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: false }) as any);
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
    const withLoyalty = filtered.filter(m => m.loyalty_index != null);
    const avgLoyalty = withLoyalty.length > 0
      ? (withLoyalty.reduce((s, m) => s + (m.loyalty_index || 0), 0) / withLoyalty.length).toFixed(1)
      : '—';
    const totalMinutes = filtered.filter(m => m.status === 'completed').reduce((s, m) => s + m.duration_minutes, 0);
    const uniqueClients = new Set(filtered.filter(m => m.client_email).map(m => m.client_email!.toLowerCase())).size;
    return { total, completed, scheduled, cancelled, avgLoyalty, totalMinutes, uniqueClients };
  }, [filtered]);

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
    return [
      { name: '1 — Muito baixo', value: dist[0] },
      { name: '2 — Baixo', value: dist[1] },
      { name: '3 — Alto', value: dist[2] },
      { name: '4 — Muito alto', value: dist[3] },
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: CalendarDays, color: 'text-foreground' },
          { label: 'Realizadas', value: stats.completed, icon: CheckCircle, color: 'text-success' },
          { label: 'Agendadas', value: stats.scheduled, icon: Clock, color: 'text-info' },
          { label: 'Canceladas', value: stats.cancelled, icon: XCircle, color: 'text-destructive' },
          { label: 'Fidelidade Média', value: stats.avgLoyalty, icon: Star, color: 'text-warning' },
          { label: 'Horas realizadas', value: `${Math.round(stats.totalMinutes / 60)}h`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Clientes únicos', value: stats.uniqueClients, icon: Users, color: 'text-accent-foreground' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
              <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* By Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Loyalty Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Índice de Fidelidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={loyaltyDist}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Reuniões por Motivo</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, byReason.length * 36)}>
              <BarChart data={byReason} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, _: string, props: any) => [v, props.payload.fullName]} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* By Client URL Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4" />
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
