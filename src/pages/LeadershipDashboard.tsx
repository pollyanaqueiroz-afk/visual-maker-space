import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle, XCircle, Clock, Star, TrendingUp, Users, Globe, UserCheck, Loader2, BarChart3, Activity, Trophy, DollarSign,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';
import ProductivityTab from '@/components/leadership/ProductivityTab';
import LoyaltyTab from '@/components/leadership/LoyaltyTab';
import CsatTab from '@/components/leadership/CsatTab';
import ClientsTab from '@/components/leadership/ClientsTab';
import { KpiCard } from '@/components/dashboard/KpiCard';

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
        supabase.from('meetings')
          .select('id, title, meeting_date, meeting_time, status, client_email, client_name, client_url, meeting_reason, loyalty_index, duration_minutes, created_by')
          .order('meeting_date', { ascending: false }),
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
    const withLoyalty = filtered.filter(m => m.loyalty_index != null && m.loyalty_index > 0);
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
      if (m.loyalty_index && m.loyalty_index > 0) {
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

  // Loyalty ranking: avg per client URL grouped by person
  const loyaltyByPersonClient = useMemo(() => {
    const map: Record<string, { uid: string; url: string; clientName: string; sum: number; count: number }> = {};
    for (const m of filtered) {
      if (!m.loyalty_index || m.loyalty_index === 0 || !m.client_url || !m.created_by) continue;
      const key = `${m.created_by}::${m.client_url}`;
      if (!map[key]) map[key] = { uid: m.created_by, url: m.client_url, clientName: m.client_name || '', sum: 0, count: 0 };
      map[key].sum += m.loyalty_index;
      map[key].count++;
      if (m.client_name && !map[key].clientName) map[key].clientName = m.client_name;
    }
    return Object.values(map)
      .map(c => ({
        ...c,
        personName: getCreatorLabel(c.uid),
        avg: parseFloat((c.sum / c.count).toFixed(1)),
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [filtered, profileMap]);

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

      <Tabs defaultValue="visao-geral" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visao-geral" className="flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="produtividade" className="flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Produtividade
          </TabsTrigger>
          <TabsTrigger value="fidelidade" className="flex items-center gap-1.5">
            <Star className="h-4 w-4" /> Fidelidade
          </TabsTrigger>
          <TabsTrigger value="csat" className="flex items-center gap-1.5">
            <Star className="h-4 w-4" /> CSAT
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" /> Clientes & Receita
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtividade">
          <ProductivityTab />
        </TabsContent>

        <TabsContent value="fidelidade">
          <LoyaltyTab filtered={filtered as any} profileMap={profileMap} />
        </TabsContent>

        <TabsContent value="csat">
          <CsatTab profileMap={profileMap} />
        </TabsContent>

        <TabsContent value="clientes">
          <ClientsTab />
        </TabsContent>

        <TabsContent value="visao-geral" className="space-y-6">

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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total" value={stats.total} icon={CalendarDays} color="bg-primary/10 text-primary" />
        <KpiCard label="Realizadas" value={stats.completed} icon={CheckCircle} color="bg-success/10 text-success" />
        <KpiCard label="Agendadas" value={stats.scheduled} icon={Clock} color="bg-info/10 text-info" />
        <KpiCard label="Canceladas" value={stats.cancelled} icon={XCircle} color="bg-destructive/10 text-destructive" />
        <KpiCard label="Fidelidade" value={stats.avgLoyalty} icon={Star} color="bg-warning/10 text-warning" />
        <KpiCard label="Horas" value={`${Math.round(stats.totalMinutes / 60)}h`} icon={TrendingUp} color="bg-primary/10 text-primary" />
        <KpiCard label="Clientes" value={stats.uniqueClients} icon={Globe} color="bg-accent text-accent-foreground" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} strokeWidth={2} stroke="hsl(var(--card))">
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reuniões por Membro</CardTitle>
          </CardHeader>
          <CardContent>
            {byCreator.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, byCreator.length * 44)}>
                <BarChart data={byCreator} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="completed" name="Realizadas" stackId="a" fill="hsl(var(--success))" />
                  <Bar dataKey="scheduled" name="Agendadas" stackId="a" fill="hsl(var(--info))" />
                  <Bar dataKey="cancelled" name="Canceladas" stackId="a" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance by Creator Table */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Performance do Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Membro</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Total</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Realizadas</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Agendadas</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Canceladas</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Taxa</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Fidelidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCreator.map(row => {
                const rate = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                return (
                  <TableRow key={row.uid} className="border-border/30">
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-center font-bold text-lg">{row.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/10 text-success border-success/20">{row.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-info/10 text-info border-info/20">{row.scheduled}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/10 text-destructive border-destructive/20">{row.cancelled}</Badge></TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${rate >= 70 ? 'text-success' : rate >= 40 ? 'text-warning' : 'text-destructive'}`}>
                        {rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 text-warning" />
                        <span className="font-semibold">{row.avgLoyalty}</span>
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
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Reuniões por Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byUrl.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">URL do Cliente</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Total</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Realizadas</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Agendadas</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Canceladas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byUrl.map(row => (
                  <TableRow key={row.url} className="border-border/30">
                    <TableCell className="font-medium text-sm">
                      {row.url !== 'Sem URL' ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{row.url}</a>
                      ) : (
                        <span className="text-muted-foreground">Sem URL</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">{row.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/10 text-success border-success/20">{row.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-info/10 text-info border-info/20">{row.scheduled}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/10 text-destructive border-destructive/20">{row.cancelled}</Badge></TableCell>
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
