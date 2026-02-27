import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { Star, Trophy, Users, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface MeetingRow {
  id: string;
  title: string;
  meeting_date: string;
  status: string;
  client_name: string | null;
  client_url: string | null;
  loyalty_index: number | null;
  created_by: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface LoyaltyTabProps {
  filtered: MeetingRow[];
  profileMap: Record<string, Profile>;
}

const getLoyaltyColor = (avg: number) => {
  if (avg >= 4) return 'hsl(var(--success))';
  if (avg >= 3) return 'hsl(var(--warning))';
  if (avg >= 2) return 'hsl(var(--info))';
  return 'hsl(var(--destructive))';
};

const getLoyaltyLabel = (avg: number) => {
  if (avg >= 4) return 'Excelente';
  if (avg >= 3) return 'Bom';
  if (avg >= 2) return 'Atenção';
  return 'Crítico';
};

export default function LoyaltyTab({ filtered, profileMap }: LoyaltyTabProps) {
  const getCreatorLabel = (uid: string | null) => {
    if (!uid) return 'Desconhecido';
    const p = profileMap[uid];
    return p?.display_name || p?.email || uid.slice(0, 8);
  };

  const withLoyalty = useMemo(() => filtered.filter(m => m.loyalty_index != null), [filtered]);

  // Global KPIs
  const kpis = useMemo(() => {
    const total = withLoyalty.length;
    const avg = total > 0 ? (withLoyalty.reduce((s, m) => s + (m.loyalty_index || 0), 0) / total) : 0;
    const uniqueClients = new Set(withLoyalty.filter(m => m.client_url).map(m => m.client_url!)).size;
    const critical = withLoyalty.filter(m => (m.loyalty_index || 0) <= 2).length;
    const excellent = withLoyalty.filter(m => (m.loyalty_index || 0) >= 4).length;
    return { total, avg: avg.toFixed(1), uniqueClients, critical, excellent };
  }, [withLoyalty]);

  // By client URL - avg loyalty
  const byClient = useMemo(() => {
    const map: Record<string, { url: string; clientName: string; sum: number; count: number; lastIndex: number }> = {};
    for (const m of withLoyalty) {
      if (!m.client_url) continue;
      if (!map[m.client_url]) map[m.client_url] = { url: m.client_url, clientName: m.client_name || '', sum: 0, count: 0, lastIndex: 0 };
      map[m.client_url].sum += m.loyalty_index!;
      map[m.client_url].count++;
      map[m.client_url].lastIndex = m.loyalty_index!;
      if (m.client_name && !map[m.client_url].clientName) map[m.client_url].clientName = m.client_name;
    }
    return Object.values(map)
      .map(c => ({ ...c, avg: parseFloat((c.sum / c.count).toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [withLoyalty]);

  // By person - avg loyalty across all their clients
  const byPerson = useMemo(() => {
    const map: Record<string, { uid: string; sum: number; count: number; clients: Set<string> }> = {};
    for (const m of withLoyalty) {
      const uid = m.created_by || 'unknown';
      if (!map[uid]) map[uid] = { uid, sum: 0, count: 0, clients: new Set() };
      map[uid].sum += m.loyalty_index!;
      map[uid].count++;
      if (m.client_url) map[uid].clients.add(m.client_url);
    }
    return Object.values(map)
      .map(c => ({ ...c, name: getCreatorLabel(c.uid), avg: parseFloat((c.sum / c.count).toFixed(1)), clientCount: c.clients.size }))
      .sort((a, b) => b.avg - a.avg);
  }, [withLoyalty, profileMap]);

  // By person x client
  const byPersonClient = useMemo(() => {
    const map: Record<string, { uid: string; url: string; clientName: string; sum: number; count: number }> = {};
    for (const m of withLoyalty) {
      if (!m.client_url || !m.created_by) continue;
      const key = `${m.created_by}::${m.client_url}`;
      if (!map[key]) map[key] = { uid: m.created_by, url: m.client_url, clientName: m.client_name || '', sum: 0, count: 0 };
      map[key].sum += m.loyalty_index!;
      map[key].count++;
      if (m.client_name && !map[key].clientName) map[key].clientName = m.client_name;
    }
    return Object.values(map)
      .map(c => ({ ...c, personName: getCreatorLabel(c.uid), avg: parseFloat((c.sum / c.count).toFixed(1)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [withLoyalty, profileMap]);

  // Chart data - top 15 clients
  const chartData = useMemo(() =>
    byClient.slice(0, 15).map(c => ({
      name: c.clientName || c.url.replace(/https?:\/\//, '').slice(0, 25),
      avg: c.avg,
      count: c.count,
    })), [byClient]);

  if (withLoyalty.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Star className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">Nenhuma avaliação de fidelidade registrada no período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Média Geral" value={kpis.avg} icon={Star} color="bg-warning/10 text-warning" />
        <KpiCard label="Avaliações" value={kpis.total} icon={Users} color="bg-primary/10 text-primary" />
        <KpiCard label="Clientes Avaliados" value={kpis.uniqueClients} icon={TrendingUp} color="bg-info/10 text-info" />
        <KpiCard label="Excelentes (≥4)" value={kpis.excellent} icon={Trophy} color="bg-success/10 text-success" />
        <KpiCard label="Críticos (≤2)" value={kpis.critical} icon={AlertTriangle} color="bg-destructive/10 text-destructive" />
      </div>

      {/* Chart - Top clients */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fidelidade Média por Cliente (Top 15)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 36)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }}
                formatter={(value: number) => [value.toFixed(1), 'Fidelidade']}
              />
              <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getLoyaltyColor(entry.avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Ranking by Person */}
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              Fidelidade Média por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="w-10 text-center text-[11px] uppercase tracking-wider">#</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Responsável</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Média</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Clientes</TableHead>
                  <TableHead className="text-center text-[11px] uppercase tracking-wider">Avaliações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPerson.map((row, i) => (
                  <TableRow key={row.uid} className="border-border/30">
                    <TableCell className="text-center">
                      {i === 0 ? <Trophy className="h-4 w-4 text-warning mx-auto" /> :
                        <span className={`text-xs font-bold ${i <= 2 ? 'text-foreground' : 'text-muted-foreground/60'}`}>{i + 1}º</span>}
                    </TableCell>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge style={{ backgroundColor: `${getLoyaltyColor(row.avg)}20`, color: getLoyaltyColor(row.avg), borderColor: `${getLoyaltyColor(row.avg)}40` }} className="border font-bold">
                        {row.avg}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{row.clientCount}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Clients needing attention */}
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Clientes que Precisam de Atenção (≤ 2.5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {byClient.filter(c => c.avg <= 2.5).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente em situação crítica 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-[11px] uppercase tracking-wider">Cliente</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider">Média</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider">Avaliações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byClient.filter(c => c.avg <= 2.5).sort((a, b) => a.avg - b.avg).map(row => (
                    <TableRow key={row.url} className="border-border/30">
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {row.clientName && <span className="text-sm font-medium text-foreground">{row.clientName}</span>}
                          <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{row.url}</a>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="h-4 w-4 text-destructive" />
                          <span className="text-lg font-bold text-destructive">{row.avg}</span>
                        </span>
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

      {/* Full Ranking: Person x Client */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Star className="h-4 w-4 text-warning" />
            Ranking Completo — Responsável × Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-10 text-center text-[11px] uppercase tracking-wider">#</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Responsável</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Cliente / URL</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Fidelidade Média</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Avaliações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPersonClient.slice(0, 30).map((row, i) => (
                <TableRow key={`${row.uid}-${row.url}`} className="border-border/30">
                  <TableCell className="text-center">
                    {i === 0 ? <Trophy className="h-4 w-4 text-warning mx-auto" /> :
                      <span className={`text-xs font-bold ${i <= 2 ? 'text-foreground' : 'text-muted-foreground/60'}`}>{i + 1}º</span>}
                  </TableCell>
                  <TableCell className="font-medium text-sm">{row.personName}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      {row.clientName && <span className="text-sm font-medium text-foreground">{row.clientName}</span>}
                      <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{row.url}</a>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Star className={`h-4 w-4 ${row.avg >= 3 ? 'text-warning' : row.avg >= 2 ? 'text-muted-foreground' : 'text-destructive'}`} />
                      <span className="text-lg font-bold">{row.avg}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-sm font-medium text-muted-foreground">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
