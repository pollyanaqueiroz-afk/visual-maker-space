import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Star, Trophy, Users, TrendingUp, BarChart3, Loader2, Smile, Frown, Meh, MessageSquare, Target,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';

interface CsatRow {
  id: string;
  meeting_id: string;
  client_email: string;
  client_name: string | null;
  score: number | null;
  comment: string | null;
  responded_at: string | null;
  sent_at: string;
}

interface MeetingInfo {
  id: string;
  title: string;
  meeting_date: string;
  client_url: string | null;
  created_by: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface CsatTabProps {
  profileMap: Record<string, Profile>;
}

const getScoreColor = (score: number) => {
  if (score >= 9) return 'hsl(var(--success))';
  if (score >= 7) return 'hsl(var(--info))';
  if (score >= 5) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
};

export default function CsatTab({ profileMap }: CsatTabProps) {
  const [csatData, setCsatData] = useState<CsatRow[]>([]);
  const [meetingsMap, setMeetingsMap] = useState<Record<string, MeetingInfo>>({});
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState('all');

  const getCreatorLabel = (uid: string | null) => {
    if (!uid) return 'Desconhecido';
    const p = profileMap[uid];
    return p?.display_name || p?.email || uid.slice(0, 8);
  };

  useEffect(() => {
    (async () => {
      const [csatRes, meetingsRes] = await Promise.all([
        supabase.from('meeting_csat').select('*').order('sent_at', { ascending: false }),
        supabase.from('meetings').select('id, title, meeting_date, client_url, created_by'),
      ]);

      if (!csatRes.error) setCsatData((csatRes.data || []) as CsatRow[]);
      if (!meetingsRes.error) {
        const map: Record<string, MeetingInfo> = {};
        (meetingsRes.data || []).forEach((m: MeetingInfo) => { map[m.id] = m; });
        setMeetingsMap(map);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return csatData;
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
    return csatData.filter(c => isWithinInterval(parseISO(c.sent_at), { start, end }));
  }, [csatData, periodFilter]);

  const responded = useMemo(() => filtered.filter(c => c.responded_at && c.score !== null), [filtered]);

  // KPIs
  const kpis = useMemo(() => {
    const totalSent = filtered.length;
    const totalResponded = responded.length;
    const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;
    const avgScore = totalResponded > 0
      ? parseFloat((responded.reduce((s, c) => s + (c.score || 0), 0) / totalResponded).toFixed(1))
      : 0;
    const promoters = responded.filter(c => (c.score || 0) >= 9).length;
    const detractors = responded.filter(c => (c.score || 0) <= 6).length;
    const nps = totalResponded > 0 ? Math.round(((promoters - detractors) / totalResponded) * 100) : 0;
    return { totalSent, totalResponded, responseRate, avgScore, nps };
  }, [filtered, responded]);

  // By client (name or email)
  const byClient = useMemo(() => {
    const map: Record<string, { key: string; name: string; sum: number; count: number; responses: number; sent: number }> = {};
    for (const c of filtered) {
      const key = c.client_email;
      if (!map[key]) map[key] = { key, name: c.client_name || c.client_email, sum: 0, count: 0, responses: 0, sent: 0 };
      map[key].sent++;
      if (c.responded_at && c.score !== null) {
        map[key].sum += c.score;
        map[key].count++;
        map[key].responses++;
      }
    }
    return Object.values(map)
      .map(c => ({
        ...c,
        avg: c.count > 0 ? parseFloat((c.sum / c.count).toFixed(1)) : null,
        rate: c.sent > 0 ? Math.round((c.responses / c.sent) * 100) : 0,
      }))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [filtered]);

  // By responsible (created_by of meeting)
  const byResponsible = useMemo(() => {
    const map: Record<string, { uid: string; sum: number; count: number; sent: number }> = {};
    for (const c of filtered) {
      const meeting = meetingsMap[c.meeting_id];
      const uid = meeting?.created_by || 'unknown';
      if (!map[uid]) map[uid] = { uid, sum: 0, count: 0, sent: 0 };
      map[uid].sent++;
      if (c.responded_at && c.score !== null) {
        map[uid].sum += c.score;
        map[uid].count++;
      }
    }
    return Object.values(map)
      .map(c => ({
        ...c,
        name: getCreatorLabel(c.uid),
        avg: c.count > 0 ? parseFloat((c.sum / c.count).toFixed(1)) : null,
        rate: c.sent > 0 ? Math.round((c.count / c.sent) * 100) : 0,
      }))
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
  }, [filtered, meetingsMap, profileMap]);

  // Chart data - top clients
  const chartData = useMemo(() =>
    byClient
      .filter(c => c.avg !== null)
      .slice(0, 15)
      .map(c => ({ name: c.name.slice(0, 25), avg: c.avg!, count: c.count })),
    [byClient]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (csatData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Nenhuma pesquisa CSAT enviada ainda.</p>
        <p className="text-xs mt-1">Confirme reuniões para enviar automaticamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-3">
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="CSAT Médio" value={kpis.avgScore || '—'} icon={Star} color="bg-warning/10 text-warning" />
        <KpiCard label="NPS" value={kpis.nps} icon={TrendingUp} color={`${kpis.nps >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`} />
        <KpiCard label="Respostas" value={kpis.totalResponded} icon={MessageSquare} color="bg-primary/10 text-primary" />
        <KpiCard label="Aderência" value={`${kpis.responseRate}%`} icon={Target} color="bg-info/10 text-info" />
        <KpiCard label="Pesquisas Enviadas" value={kpis.totalSent} icon={Users} color="bg-accent text-accent-foreground" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CSAT Médio por Cliente (Top 15)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }}
                  formatter={(value: number) => [value.toFixed(1), 'CSAT']}
                />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={getScoreColor(entry.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ranking: Happiest clients */}
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Smile className="h-4 w-4 text-success" />
              Clientes Mais Satisfeitos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-10 text-center text-[11px] uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">CSAT</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Aderência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClient.filter(c => c.avg !== null).slice(0, 10).map((row, i) => (
                  <TableRow key={row.key} className="border-border/30">
                    <TableCell className="text-center">
                      {i === 0 ? <Trophy className="h-4 w-4 text-warning mx-auto" /> :
                        <span className={`text-xs font-bold ${i <= 2 ? 'text-foreground' : 'text-muted-foreground/60'}`}>{i + 1}º</span>}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge style={{ backgroundColor: `${getScoreColor(row.avg!)}20`, color: getScoreColor(row.avg!), borderColor: `${getScoreColor(row.avg!)}40` }} className="border font-bold">
                        {row.avg}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{row.rate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Ranking: Unhappiest clients */}
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Frown className="h-4 w-4 text-destructive" />
              Clientes Menos Satisfeitos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byClient.filter(c => c.avg !== null && c.avg <= 6).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente com CSAT ≤ 6 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="w-10 text-center text-[11px] uppercase tracking-wider">#</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider">CSAT</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider">Respostas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient
                    .filter(c => c.avg !== null)
                    .sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99))
                    .filter(c => (c.avg ?? 99) <= 6)
                    .slice(0, 10)
                    .map((row, i) => (
                      <TableRow key={row.key} className="border-border/30">
                        <TableCell className="text-center">
                          <span className="text-xs font-bold text-destructive">{i + 1}º</span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{row.name}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 border font-bold">
                            {row.avg}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{row.count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CSAT by Responsible */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            CSAT por Responsável
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-10 text-center text-[11px] uppercase tracking-wider">#</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Responsável</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">CSAT Médio</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Respostas</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Enviadas</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Aderência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byResponsible.map((row, i) => (
                <TableRow key={row.uid} className="border-border/30">
                  <TableCell className="text-center">
                    {i === 0 ? <Trophy className="h-4 w-4 text-warning mx-auto" /> :
                      <span className={`text-xs font-bold ${i <= 2 ? 'text-foreground' : 'text-muted-foreground/60'}`}>{i + 1}º</span>}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{row.name}</TableCell>
                  <TableCell className="text-center">
                    {row.avg !== null ? (
                      <Badge style={{ backgroundColor: `${getScoreColor(row.avg)}20`, color: getScoreColor(row.avg), borderColor: `${getScoreColor(row.avg)}40` }} className="border font-bold">
                        {row.avg}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{row.count}</TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">{row.sent}</TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-bold ${row.rate >= 70 ? 'text-success' : row.rate >= 40 ? 'text-warning' : 'text-destructive'}`}>
                      {row.rate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent comments */}
      {responded.filter(c => c.comment).length > 0 && (
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Últimos Comentários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {responded
              .filter(c => c.comment)
              .slice(0, 10)
              .map(c => (
                <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${getScoreColor(c.score!)}20` }}>
                    <span className="text-xs font-bold" style={{ color: getScoreColor(c.score!) }}>{c.score}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{c.client_name || c.client_email}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{c.comment}</p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
