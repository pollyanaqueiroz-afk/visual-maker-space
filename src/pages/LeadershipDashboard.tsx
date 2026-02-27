import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle, XCircle, Clock, Star, TrendingUp, Users, Globe, UserCheck, Loader2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['hsl(var(--info))', 'hsl(var(--success))', 'hsl(var(--destructive))'];

interface MeetingRow {
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
  duration_minutes: number;
  created_by: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

export default function LeadershipDashboard() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('current');
  const [filterUrl, setFilterUrl] = useState('all');
  const [filterCreator, setFilterCreator] = useState('all');

  useEffect(() => {
    (async () => {
      const [meetingsRes, profilesRes] = await Promise.all([
        supabase.from('meetings' as any)
          .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, duration_minutes, created_by')
          .order('meeting_date', { ascending: false }) as any,
        supabase.from('profiles').select('user_id, email, display_name'),
      ]);

      if (meetingsRes.error) {
        console.error(meetingsRes.error);
        toast.error('Erro ao carregar reuniões');
      } else {
        setMeetings((meetingsRes.data || []) as MeetingRow[]);
      }

      if (!profilesRes.error && profilesRes.data) {
        setProfiles(profilesRes.data as Profile[]);
      }

      setLoading(false);
    })();
  }, []);

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach(p => { map[p.user_id] = p; });
    return map;
  }, [profiles]);

  const getCreatorLabel = (uid: string | null) => {
    if (!uid) return 'Desconhecido';
    const p = profileMap[uid];
    return p?.display_name || p?.email || uid.slice(0, 8);
  };

  // Period filter
  const filtered = useMemo(() => {
    let list = meetings;
    if (periodFilter !== 'all') {
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
      list = list.filter(m => isWithinInterval(parseISO(m.meeting_date), { start, end }));
    }
    if (filterUrl !== 'all') list = list.filter(m => (m.client_url || '') === filterUrl);
    if (filterCreator !== 'all') list = list.filter(m => m.created_by === filterCreator);
    return list;
  }, [meetings, periodFilter, filterUrl, filterCreator]);

  // Unique values for filters
  const uniqueUrls = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach(m => { if (m.client_url) set.add(m.client_url); });
    return Array.from(set).sort();
  }, [meetings]);

  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach(m => { if (m.created_by) set.add(m.created_by); });
    return Array.from(set);
  }, [meetings]);

  // Stats
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
    const uniqueClients = new Set(filtered.filter(m => m.client_url).map(m => m.client_url!)).size;
    return { total, completed, scheduled, cancelled, avgLoyalty, totalMinutes, uniqueClients };
  }, [filtered]);

  // By creator
  const byCreator = useMemo(() => {
    const map: Record<string, { uid: string; total: number; completed: number; scheduled: number; cancelled: number; avgLoyalty: number; loyaltyCount: number }> = {};
    for (const m of filtered) {
      const uid = m.created_by || 'unknown';
      if (!map[uid]) map[uid] = { uid, total: 0, completed: 0, scheduled: 0, cancelled: 0, avgLoyalty: 0, loyaltyCount: 0 };
      map[uid].total++;
      if (m.status === 'completed') map[uid].completed++;
      else if (m.status === 'scheduled') map[uid].scheduled++;
      else if (m.status === 'cancelled') map[uid].cancelled++;
      if (m.loyalty_index) {
        map[uid].avgLoyalty += m.loyalty_index;
        map[uid].loyaltyCount++;
      }
    }
    return Object.values(map)
      .map(c => ({
        ...c,
        name: getCreatorLabel(c.uid),
        avgLoyalty: c.loyaltyCount > 0 ? (c.avgLoyalty / c.loyaltyCount).toFixed(1) : '—',
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, profileMap]);

  // By client URL
  const byUrl = useMemo(() => {
    const map: Record<string, { url: string; total: number; completed: number; scheduled: number; cancelled: number }> = {};
    for (const m of filtered) {
      const url = m.client_url || 'Sem URL';
      if (!map[url]) map[url] = { url, total: 0, completed: 0, scheduled: 0, cancelled: 0 };
      map[url].total++;
      if (m.status === 'completed') map[url].completed++;
      else if (m.status === 'scheduled') map[url].scheduled++;
      else if (m.status === 'cancelled') map[url].cancelled++;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // By status for pie
  const byStatus = useMemo(() => [
    { name: 'Agendadas', value: stats.scheduled },
    { name: 'Realizadas', value: stats.completed },
    { name: 'Canceladas', value: stats.cancelled },
  ], [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Liderança</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada de reuniões do time</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="previous">Mês anterior</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterUrl} onValueChange={setFilterUrl}>
          <SelectTrigger className="w-[240px] h-9 text-sm">
            <Globe className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Cliente (URL)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {uniqueUrls.map(u => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCreator} onValueChange={setFilterCreator}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <UserCheck className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos do time</SelectItem>
            {uniqueCreators.map(uid => (
              <SelectItem key={uid} value={uid}>{getCreatorLabel(uid)}</SelectItem>
            ))}
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
          { label: 'Clientes únicos', value: stats.uniqueClients, icon: Globe, color: 'text-accent-foreground' },
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Status Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle>
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

        {/* By Creator Bar Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reuniões por Membro do Time</CardTitle>
          </CardHeader>
          <CardContent>
            {byCreator.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, byCreator.length * 44)}>
                <BarChart data={byCreator} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Realizadas" stackId="a" fill="hsl(var(--success))" />
                  <Bar dataKey="scheduled" name="Agendadas" stackId="a" fill="hsl(var(--info))" />
                  <Bar dataKey="cancelled" name="Canceladas" stackId="a" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance by Creator Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Performance do Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Realizadas</TableHead>
                <TableHead className="text-center">Agendadas</TableHead>
                <TableHead className="text-center">Canceladas</TableHead>
                <TableHead className="text-center">Taxa Realização</TableHead>
                <TableHead className="text-center">Fidelidade Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCreator.map(row => {
                const rate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                return (
                  <TableRow key={row.uid}>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/20 text-success">{row.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-info/20 text-info">{row.scheduled}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive">{row.cancelled}</Badge></TableCell>
                    <TableCell className="text-center">
                      <span className={rate >= 70 ? 'text-success font-semibold' : rate >= 40 ? 'text-warning font-semibold' : 'text-destructive font-semibold'}>
                        {rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 text-warning" />
                        {row.avgLoyalty}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* By Client URL Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Reuniões por Cliente (URL)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byUrl.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
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
                {byUrl.map(row => (
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
    </div>
  );
}
