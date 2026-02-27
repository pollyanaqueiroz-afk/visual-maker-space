import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, CheckCircle, XCircle, Users, UserCheck, Loader2, TrendingUp, Filter, Download, Trophy, Medal, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';

interface MeetingRow {
  id: string;
  meeting_date: string;
  status: string;
  client_url: string | null;
  client_name: string | null;
  meeting_reason: string | null;
  duration_minutes: number;
  created_by: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

export default function ProductivityTab() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPerson, setFilterPerson] = useState('all');
  const [filterReason, setFilterReason] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    (async () => {
      const [meetingsRes, profilesRes] = await Promise.all([
        supabase.from('meetings' as any)
          .select('id, meeting_date, status, client_url, client_name, meeting_reason, duration_minutes, created_by')
          .order('meeting_date', { ascending: true }) as any,
        supabase.from('profiles').select('user_id, email, display_name'),
      ]);
      if (meetingsRes.error) {
        toast.error('Erro ao carregar dados');
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

  const getLabel = (uid: string | null) => {
    if (!uid) return 'Desconhecido';
    const p = profileMap[uid];
    return p?.display_name || p?.email || uid.slice(0, 8);
  };

  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach(m => { if (m.created_by) set.add(m.created_by); });
    return Array.from(set);
  }, [meetings]);

  const uniqueReasons = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach(m => { if (m.meeting_reason) set.add(m.meeting_reason); });
    return Array.from(set).sort();
  }, [meetings]);

  const filtered = useMemo(() => {
    let list = meetings;
    if (filterPerson !== 'all') list = list.filter(m => m.created_by === filterPerson);
    if (filterReason !== 'all') list = list.filter(m => m.meeting_reason === filterReason);
    if (filterStatus !== 'all') list = list.filter(m => m.status === filterStatus);
    return list;
  }, [meetings, filterPerson, filterReason, filterStatus]);

  // Monthly chart data
  const monthlyData = useMemo(() => {
    if (filtered.length === 0) return [];
    const dates = filtered.map(m => parseISO(m.meeting_date));
    const minDate = startOfMonth(new Date(Math.min(...dates.map(d => d.getTime()))));
    const maxDate = endOfMonth(new Date(Math.max(...dates.map(d => d.getTime()))));
    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    return months.map(month => {
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const inMonth = filtered.filter(m => isWithinInterval(parseISO(m.meeting_date), { start, end }));
      return {
        month: format(month, 'MMM/yy', { locale: ptBR }),
        total: inMonth.length,
        realizadas: inMonth.filter(m => m.status === 'completed').length,
        agendadas: inMonth.filter(m => m.status === 'scheduled').length,
        canceladas: inMonth.filter(m => m.status === 'cancelled').length,
      };
    }).slice(-12); // last 12 months
  }, [filtered]);

  // Per-person stats
  const personStats = useMemo(() => {
    const map: Record<string, { uid: string; total: number; completed: number; cancelled: number; hours: number; reasons: Record<string, number> }> = {};
    for (const m of filtered) {
      const uid = m.created_by || 'unknown';
      if (!map[uid]) map[uid] = { uid, total: 0, completed: 0, cancelled: 0, hours: 0, reasons: {} };
      map[uid].total++;
      if (m.status === 'completed') {
        map[uid].completed++;
        map[uid].hours += m.duration_minutes;
      }
      if (m.status === 'cancelled') map[uid].cancelled++;
      if (m.meeting_reason) {
        map[uid].reasons[m.meeting_reason] = (map[uid].reasons[m.meeting_reason] || 0) + 1;
      }
    }
    return Object.values(map).map(p => ({
      ...p,
      name: getLabel(p.uid),
      rate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
      topReason: Object.entries(p.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      hoursFormatted: Math.round(p.hours / 60),
    })).sort((a, b) => b.total - a.total);
  }, [filtered, profileMap]);

  // By reason
  const byReason = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of filtered) {
      const r = m.meeting_reason || 'Sem motivo';
      map[r] = (map[r] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 30 ? name.slice(0, 30) + '…' : name, fullName: name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const totalStats = useMemo(() => ({
    total: filtered.length,
    completed: filtered.filter(m => m.status === 'completed').length,
    cancelled: filtered.filter(m => m.status === 'cancelled').length,
    people: new Set(filtered.map(m => m.created_by).filter(Boolean)).size,
  }), [filtered]);

  const exportCSV = () => {
    const headers = ['Pessoa', 'Total', 'Realizadas', 'Canceladas', 'Taxa (%)', 'Horas', 'Principal Motivo'];
    const rows = personStats.map(r => [r.name, r.total, r.completed, r.cancelled, r.rate, r.hoursFormatted, r.topReason]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produtividade_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtros:
          </div>
        <Select value={filterPerson} onValueChange={setFilterPerson}>
          <SelectTrigger className="w-[220px] h-9 text-sm">
            <UserCheck className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Pessoa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as pessoas</SelectItem>
            {uniqueCreators.map(uid => (
              <SelectItem key={uid} value={uid}>{getLabel(uid)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterReason} onValueChange={setFilterReason}>
          <SelectTrigger className="w-[260px] h-9 text-sm">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motivos</SelectItem>
            {uniqueReasons.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="completed">Realizadas</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 gap-1.5">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CalendarDays className="h-5 w-5 text-foreground" />
            <span className="text-2xl font-bold text-foreground">{totalStats.total}</span>
            <span className="text-[11px] text-muted-foreground">Total de Reuniões</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-foreground">{totalStats.completed}</span>
            <span className="text-[11px] text-muted-foreground">Realizadas</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <XCircle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-foreground">{totalStats.cancelled}</span>
            <span className="text-[11px] text-muted-foreground">Canceladas</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">{totalStats.people}</span>
            <span className="text-[11px] text-muted-foreground">Pessoas Ativas</span>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reuniões por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="realizadas" name="Realizadas" stackId="a" fill="hsl(var(--success))" />
                <Bar dataKey="agendadas" name="Agendadas" stackId="a" fill="hsl(var(--info))" />
                <Bar dataKey="canceladas" name="Canceladas" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* By Reason */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Por Motivo</CardTitle>
          </CardHeader>
          <CardContent>
            {byReason.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, byReason.length * 32)}>
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

        {/* Per person chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reuniões por Pessoa</CardTitle>
          </CardHeader>
          <CardContent>
            {personStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, personStats.length * 44)}>
                <BarChart data={personStats} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name="Realizadas" stackId="a" fill="hsl(var(--success))" />
                  <Bar dataKey="cancelled" name="Canceladas" stackId="a" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking Cards */}
      {personStats.length > 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <Trophy className="h-4 w-4 text-warning" /> Ranking de Produtividade
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Mais reuniões realizadas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Medal className="h-3.5 w-3.5 text-warning" /> Mais Reuniões Realizadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...personStats].sort((a, b) => b.completed - a.completed).slice(0, 5).map((p, i) => (
                  <div key={p.uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-warning' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-orange-400' : 'text-muted-foreground/60'}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <Badge className="bg-success/20 text-success">{p.completed}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Melhor taxa de realização */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary" /> Melhor Taxa de Realização
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...personStats].filter(p => p.total >= 3).sort((a, b) => b.rate - a.rate).slice(0, 5).map((p, i) => (
                  <div key={p.uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-warning' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-orange-400' : 'text-muted-foreground/60'}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className={`text-sm font-semibold ${p.rate >= 70 ? 'text-success' : p.rate >= 40 ? 'text-warning' : 'text-destructive'}`}>{p.rate}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Mais horas */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-info" /> Mais Horas de Reunião
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[...personStats].sort((a, b) => b.hoursFormatted - a.hoursFormatted).slice(0, 5).map((p, i) => (
                  <div key={p.uid} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-warning' : i === 1 ? 'text-muted-foreground' : i === 2 ? 'text-orange-400' : 'text-muted-foreground/60'}`}>
                        {i + 1}º
                      </span>
                      <span className="text-sm">{p.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{p.hoursFormatted}h</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Produtividade Individual Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Produtividade Individual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {personStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Realizadas</TableHead>
                  <TableHead className="text-center">Canceladas</TableHead>
                  <TableHead className="text-center">Taxa</TableHead>
                  <TableHead className="text-center">Horas</TableHead>
                  <TableHead>Principal Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personStats.map((row, i) => (
                  <TableRow key={row.uid}>
                    <TableCell className="text-center">
                      {i === 0 ? <Trophy className="h-4 w-4 text-warning mx-auto" /> :
                       i === 1 ? <span className="text-xs font-bold text-muted-foreground">2º</span> :
                       i === 2 ? <span className="text-xs font-bold text-orange-400">3º</span> :
                       <span className="text-xs text-muted-foreground/60">{i + 1}º</span>}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    <TableCell className="text-center"><Badge className="bg-success/20 text-success">{row.completed}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive">{row.cancelled}</Badge></TableCell>
                    <TableCell className="text-center">
                      <span className={row.rate >= 70 ? 'text-success font-semibold' : row.rate >= 40 ? 'text-warning font-semibold' : 'text-destructive font-semibold'}>
                        {row.rate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{row.hoursFormatted}h</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{row.topReason}</TableCell>
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
