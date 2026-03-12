import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfWeek, endOfWeek, isSameDay, getDay, getISOWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle, XCircle, Clock, TrendingUp, Users, BarChart3, RefreshCw, Calendar as CalendarIcon, LayoutGrid,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from 'recharts';
import { KpiCard } from '@/components/dashboard/KpiCard';

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

interface Reschedule {
  id: string;
  meeting_id: string;
  previous_date: string;
  previous_time: string;
  new_date: string;
  new_time: string;
  reason: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
}

interface AllMeeting extends Meeting {
  created_by: string;
}

function OverviewTab() {
  const [allMeetings, setAllMeetings] = useState<AllMeeting[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewPeriod, setOverviewPeriod] = useState('current');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) return;

        // Fetch all meetings (admin RLS) and team members in parallel
        const [meetRes, teamRes] = await Promise.all([
          supabase
            .from('meetings')
            .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, loyalty_reason, duration_minutes, created_by')
            .order('meeting_date', { ascending: false })
            .limit(5000),
          fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=list`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          ),
        ]);

        if (meetRes.data) setAllMeetings(meetRes.data as AllMeeting[]);

        if (teamRes.ok) {
          const result = await teamRes.json();
          const users = result.users || result;
          if (Array.isArray(users)) {
            setTeamMembers(
              users
                .filter((u: any) => u.email?.endsWith('@curseduca.com'))
                .map((u: any) => ({
                  id: u.id,
                  email: u.email || '',
                  display_name: u.display_name || u.email?.split('@')[0] || u.id,
                }))
            );
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    if (overviewPeriod === 'all') return allMeetings;
    const now = new Date();
    let start: Date, end: Date;
    if (overviewPeriod === 'current') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      const prev = subMonths(now, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
    }
    return allMeetings.filter(m => {
      const d = parseISO(m.meeting_date);
      return isWithinInterval(d, { start, end });
    });
  }, [allMeetings, overviewPeriod]);

  const csComparison = useMemo(() => {
    const map: Record<string, {
      id: string; name: string; email: string;
      total: number; completed: number; cancelled: number; scheduled: number;
      totalMinutes: number; uniqueClients: Set<string>;
      loyaltySum: number; loyaltyCount: number;
    }> = {};

    for (const m of filtered) {
      const csId = m.created_by || 'unknown';
      if (!map[csId]) {
        const member = teamMembers.find(t => t.id === csId);
        map[csId] = {
          id: csId,
          name: member?.display_name || member?.email?.split('@')[0] || 'Desconhecido',
          email: member?.email || '',
          total: 0, completed: 0, cancelled: 0, scheduled: 0,
          totalMinutes: 0, uniqueClients: new Set(),
          loyaltySum: 0, loyaltyCount: 0,
        };
      }
      const cs = map[csId];
      cs.total++;
      if (m.status === 'completed') { cs.completed++; cs.totalMinutes += m.duration_minutes; }
      if (m.status === 'cancelled') cs.cancelled++;
      if (m.status === 'scheduled') cs.scheduled++;
      if (m.client_email) cs.uniqueClients.add(m.client_email.toLowerCase());
      if (m.loyalty_index != null) { cs.loyaltySum += m.loyalty_index; cs.loyaltyCount++; }
    }

    return Object.values(map)
      .filter(cs => cs.total > 0)
      .sort((a, b) => b.total - a.total)
      .map(cs => ({
        ...cs,
        uniqueClientsCount: cs.uniqueClients.size,
        avgLoyalty: cs.loyaltyCount > 0 ? (cs.loyaltySum / cs.loyaltyCount).toFixed(1) : '—',
        completionRate: cs.total > 0 ? Math.round((cs.completed / cs.total) * 100) : 0,
        hours: Math.round(cs.totalMinutes / 60),
      }));
  }, [filtered, teamMembers]);

  const chartData = useMemo(() =>
    csComparison.map(cs => ({
      name: cs.name,
      Realizadas: cs.completed,
      Canceladas: cs.cancelled,
      Agendadas: cs.scheduled,
    })),
  [csComparison]);

  if (loading) {
    return (
      <TabsContent value="overview">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Carregando overview...</div>
        </div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="overview" className="space-y-6">
      {/* Period filter */}
      <div className="flex justify-end">
        <Select value={overviewPeriod} onValueChange={setOverviewPeriod}>
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

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Reuniões" value={filtered.length} icon={CalendarDays} color="bg-primary/10 text-primary" />
        <KpiCard label="Realizadas" value={filtered.filter(m => m.status === 'completed').length} icon={CheckCircle} color="bg-success/10 text-success" />
        <KpiCard label="Canceladas" value={filtered.filter(m => m.status === 'cancelled').length} icon={XCircle} color="bg-destructive/10 text-destructive" />
        <KpiCard label="CSs Ativos" value={csComparison.length} icon={Users} color="bg-accent text-accent-foreground" />
      </div>

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reuniões por CS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Realizadas" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} stackId="stack" />
                <Bar dataKey="Canceladas" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} stackId="stack" />
                <Bar dataKey="Agendadas" fill="hsl(var(--info))" radius={[0, 4, 4, 0]} stackId="stack" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Comparison Table */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Comparativo entre CSs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {csComparison.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CS</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realizadas</TableHead>
                  <TableHead className="text-center">Canceladas</TableHead>
                  <TableHead className="text-center">% Conclusão</TableHead>
                  <TableHead className="text-center">Horas</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-center">Fidelidade Média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csComparison.map(cs => (
                  <TableRow key={cs.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{cs.name}</p>
                        {cs.email && <p className="text-xs text-muted-foreground">{cs.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{cs.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-success/20 text-success border-0 text-[10px]">{cs.completed}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">{cs.cancelled}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${cs.completionRate >= 80 ? 'text-success' : cs.completionRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                        {cs.completionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{cs.hours}h</TableCell>
                    <TableCell className="text-center text-sm">{cs.uniqueClientsCount}</TableCell>
                    <TableCell className="text-center text-sm font-medium">{cs.avgLoyalty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}


export default function MeetingsDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [reschedules, setReschedules] = useState<Reschedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('current');
  const [activeKPI, setActiveKPI] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const { user } = useAuth();

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [meetRes, rescRes] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, loyalty_reason, duration_minutes, created_by')
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: false }),
      supabase
        .from('meeting_reschedules')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    if (meetRes.error) toast.error('Erro ao carregar reuniões');
    if (rescRes.error) console.error(rescRes.error);
    setMeetings((meetRes.data || []) as Meeting[]);
    setReschedules((rescRes.data || []) as Reschedule[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

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

  // Today's meetings
  const todayMeetings = useMemo(() => {
    const today = new Date();
    return meetings.filter(m => isSameDay(parseISO(m.meeting_date), today));
  }, [meetings]);

  // This week's meetings
  const thisWeekMeetings = useMemo(() => {
    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    const we = endOfWeek(now, { weekStartsOn: 1 });
    return meetings.filter(m => {
      const d = parseISO(m.meeting_date);
      return isWithinInterval(d, { start: ws, end: we });
    });
  }, [meetings]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter(m => m.status === 'completed').length;
    const scheduled = filtered.filter(m => m.status === 'scheduled').length;
    const cancelled = filtered.filter(m => m.status === 'cancelled').length;
    const totalMinutes = filtered.filter(m => m.status === 'completed').reduce((s, m) => s + m.duration_minutes, 0);
    const uniqueClients = new Set(filtered.filter(m => m.client_email).map(m => m.client_email!.toLowerCase())).size;
    const meetingIds = new Set(filtered.map(m => m.id));
    const rescheduleCount = reschedules.filter(r => meetingIds.has(r.meeting_id)).length;
    const todayTotal = todayMeetings.length;
    const todayCompleted = todayMeetings.filter(m => m.status === 'completed').length;
    return { total, completed, scheduled, cancelled, totalMinutes, uniqueClients, rescheduleCount, todayTotal, todayCompleted };
  }, [filtered, reschedules, todayMeetings]);

  const toggleKPI = (kpi: string) => {
    setActiveKPI(prev => prev === kpi ? null : kpi);
  };

  // Meetings by day (for chart)
  const byDay = useMemo(() => {
    const map: Record<string, { date: string; total: number; completed: number; cancelled: number }> = {};
    for (const m of filtered) {
      const key = m.meeting_date;
      if (!map[key]) map[key] = { date: key, total: 0, completed: 0, cancelled: 0 };
      map[key].total++;
      if (m.status === 'completed') map[key].completed++;
      if (m.status === 'cancelled') map[key].cancelled++;
    }
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        label: format(parseISO(d.date), 'dd/MM', { locale: ptBR }),
      }));
  }, [filtered]);

  // Meetings by week
  const byWeek = useMemo(() => {
    const map: Record<string, { week: string; total: number; completed: number; cancelled: number }> = {};
    for (const m of filtered) {
      const d = parseISO(m.meeting_date);
      const weekNum = getISOWeek(d);
      const year = d.getFullYear();
      const key = `${year}-S${String(weekNum).padStart(2, '0')}`;
      if (!map[key]) map[key] = { week: key, total: 0, completed: 0, cancelled: 0 };
      map[key].total++;
      if (m.status === 'completed') map[key].completed++;
      if (m.status === 'cancelled') map[key].cancelled++;
    }
    return Object.values(map).sort((a, b) => a.week.localeCompare(b.week));
  }, [filtered]);

  // Meetings by month
  const byMonth = useMemo(() => {
    const map: Record<string, { month: string; total: number; completed: number; cancelled: number }> = {};
    for (const m of meetings) {
      const d = parseISO(m.meeting_date);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM/yy', { locale: ptBR });
      if (!map[key]) map[key] = { month: label, total: 0, completed: 0, cancelled: 0 };
      map[key].total++;
      if (m.status === 'completed') map[key].completed++;
      if (m.status === 'cancelled') map[key].cancelled++;
    }
    return Object.values(map);
  }, [meetings]);

  // Meetings by client
  const byClient = useMemo(() => {
    const map: Record<string, { name: string; email: string; url: string; total: number; completed: number; scheduled: number; cancelled: number; reschedules: number }> = {};
    for (const m of filtered) {
      const key = (m.client_email || 'sem-email').toLowerCase();
      if (!map[key]) {
        map[key] = {
          name: m.client_name || m.client_email || 'Sem cliente',
          email: m.client_email || '',
          url: m.client_url || '',
          total: 0, completed: 0, scheduled: 0, cancelled: 0, reschedules: 0,
        };
      }
      map[key].total++;
      if (m.status === 'completed') map[key].completed++;
      else if (m.status === 'scheduled') map[key].scheduled++;
      else if (m.status === 'cancelled') map[key].cancelled++;
      // Count reschedules for this meeting
      map[key].reschedules += reschedules.filter(r => r.meeting_id === m.id).length;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered, reschedules]);

  // Reschedules for the period
  const filteredReschedules = useMemo(() => {
    const meetingIds = new Set(filtered.map(m => m.id));
    return reschedules.filter(r => meetingIds.has(r.meeting_id));
  }, [filtered, reschedules]);

  const chartData = viewMode === 'day' ? byDay : viewMode === 'week' ? byWeek : byMonth;
  const chartKey = viewMode === 'day' ? 'label' : viewMode === 'week' ? 'week' : 'month';

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
          <h1 className="text-2xl font-bold text-foreground">Produtividade — Reuniões</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Logado como <span className="font-medium text-foreground">{user?.email}</span>
          </p>
        </div>
        <button onClick={fetchData} className="text-muted-foreground hover:text-foreground transition-colors" title="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="produtividade" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Produtividade Individual
          </TabsTrigger>
        </TabsList>

        <OverviewTab />

        <TabsContent value="produtividade" className="space-y-6">

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

          {/* Today Banner */}
          <Card className="border-none bg-gradient-to-r from-primary/10 to-primary/5 shadow-sm">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Hoje — {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.todayTotal === 0 ? 'Nenhuma reunião agendada' : `${stats.todayTotal} reunião(ões) • ${stats.todayCompleted} realizada(s)`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{stats.todayTotal}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hoje</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{thisWeekMeetings.length}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Semana</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
            <KpiCard label="Reagendamentos" value={stats.rescheduleCount} icon={RefreshCw} color="bg-warning/10 text-warning"
              onClick={() => toggleKPI('reschedules')} active={activeKPI === 'reschedules'} />
            <KpiCard label="Horas" value={`${Math.round(stats.totalMinutes / 60)}h`} icon={TrendingUp} color="bg-primary/10 text-primary"
              onClick={() => toggleKPI('hours')} active={activeKPI === 'hours'} />
            <KpiCard label="Clientes" value={stats.uniqueClients} icon={Users} color="bg-accent text-accent-foreground"
              onClick={() => toggleKPI('clients')} active={activeKPI === 'clients'} />
          </div>

          {/* KPI Detail: Reschedules */}
          {activeKPI === 'reschedules' && (
            <Card className="border-none shadow-[var(--shadow-kpi)] animate-in fade-in slide-in-from-top-2 duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-warning" /> Reagendamentos ({filteredReschedules.length})
                  </CardTitle>
                  <button onClick={() => setActiveKPI(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredReschedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum reagendamento no período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Original</TableHead>
                        <TableHead>Nova Data</TableHead>
                        <TableHead>Reunião</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Reagendado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReschedules.map(r => {
                        const meeting = meetings.find(m => m.id === r.meeting_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="text-sm">
                              <span className="line-through text-muted-foreground">
                                {format(parseISO(r.previous_date), 'dd/MM/yyyy', { locale: ptBR })} {r.previous_time?.slice(0, 5)}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {format(parseISO(r.new_date), 'dd/MM/yyyy', { locale: ptBR })} {r.new_time?.slice(0, 5)}
                            </TableCell>
                            <TableCell className="text-sm">{meeting?.title || '—'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={r.reason}>{r.reason}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(parseISO(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}

          {/* KPI Detail: Clients grouped */}
          {activeKPI === 'clients' && byClient.length > 0 && (
            <Card className="border-none shadow-[var(--shadow-kpi)] animate-in fade-in slide-in-from-top-2 duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-accent-foreground" /> Reuniões por Cliente ({byClient.length})
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
                      <TableHead className="text-center">Reagend.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byClient.map(c => (
                      <TableRow key={c.email || c.name}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
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
                        <TableCell className="text-center">
                          {c.reschedules > 0 ? (
                            <Badge className="bg-warning/20 text-warning border-0 text-[10px]">{c.reschedules}</Badge>
                          ) : <span className="text-xs text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* KPI Detail: Generic meeting list */}
          {activeKPI && !['clients', 'reschedules'].includes(activeKPI) && (() => {
            const list = activeKPI === 'total' ? filtered
              : activeKPI === 'completed' ? filtered.filter(m => m.status === 'completed')
              : activeKPI === 'scheduled' ? filtered.filter(m => m.status === 'scheduled')
              : activeKPI === 'cancelled' ? filtered.filter(m => m.status === 'cancelled')
              : activeKPI === 'hours' ? filtered.filter(m => m.status === 'completed' && m.duration_minutes > 0).sort((a, b) => b.duration_minutes - a.duration_minutes)
              : [];
            if (list.length === 0) return (
              <Card className="border-none shadow-[var(--shadow-kpi)]"><CardContent className="py-8 text-center text-muted-foreground">Nenhuma reunião encontrada</CardContent></Card>
            );
            return (
              <Card className="border-none shadow-[var(--shadow-kpi)] animate-in fade-in slide-in-from-top-2 duration-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{list.length} reunião(ões)</CardTitle>
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
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Duração</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.slice(0, 50).map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm font-medium">{format(parseISO(m.meeting_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{m.meeting_time?.slice(0, 5) || '—'}</TableCell>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate" title={m.title}>{m.title || '—'}</TableCell>
                          <TableCell>
                            <p className="text-sm">{m.client_name || '—'}</p>
                            {m.client_url && <a href={m.client_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{m.client_url}</a>}
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
                          <TableCell className="text-center text-sm">{m.duration_minutes > 0 ? `${m.duration_minutes}min` : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })()}

          {/* Productivity Chart */}
          <Card className="border-none shadow-[var(--shadow-kpi)]">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Reuniões {viewMode === 'day' ? 'por Dia' : viewMode === 'week' ? 'por Semana' : 'por Mês'}
                </CardTitle>
                <div className="flex gap-1">
                  {(['day', 'week', 'month'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        viewMode === mode
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey={chartKey} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="completed" name="Realizadas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} stackId="stack" />
                    <Bar dataKey="cancelled" name="Canceladas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Clients Table */}
          <Card className="border-none shadow-[var(--shadow-kpi)]">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Produtividade por Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byClient.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma reunião no período</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Realizadas</TableHead>
                      <TableHead className="text-center">Agendadas</TableHead>
                      <TableHead className="text-center">Canceladas</TableHead>
                      <TableHead className="text-center">Reagend.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byClient.slice(0, 30).map(c => (
                      <TableRow key={c.email || c.name}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[160px] block">{c.url}</a>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-center font-semibold">{c.total}</TableCell>
                        <TableCell className="text-center"><Badge className="bg-success/20 text-success border-0 text-[10px]">{c.completed}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className="bg-info/20 text-info border-0 text-[10px]">{c.scheduled}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive border-0 text-[10px]">{c.cancelled}</Badge></TableCell>
                        <TableCell className="text-center">
                          {c.reschedules > 0 ? (
                            <Badge className="bg-warning/20 text-warning border-0 text-[10px]">{c.reschedules}</Badge>
                          ) : <span className="text-xs text-muted-foreground">0</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Today's meetings detail */}
          {todayMeetings.length > 0 && (
            <Card className="border-none shadow-[var(--shadow-kpi)]">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  Reuniões de Hoje ({todayMeetings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Horário</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-center">Duração</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayMeetings.sort((a, b) => (a.meeting_time || '').localeCompare(b.meeting_time || '')).map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm font-medium">{m.meeting_time?.slice(0, 5) || '—'}</TableCell>
                        <TableCell className="text-sm">{m.title}</TableCell>
                        <TableCell className="text-sm">{m.client_name || '—'}</TableCell>
                        <TableCell className="text-center text-sm">{m.duration_minutes}min</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-0 text-[10px] ${
                            m.status === 'completed' ? 'bg-success/20 text-success' :
                            m.status === 'scheduled' ? 'bg-info/20 text-info' :
                            'bg-destructive/20 text-destructive'
                          }`}>
                            {m.status === 'completed' ? 'Realizada' : m.status === 'scheduled' ? 'Agendada' : 'Cancelada'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

        </TabsContent>
      </Tabs>
    </div>
  );
}
