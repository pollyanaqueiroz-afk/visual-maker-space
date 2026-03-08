import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Star, Search, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MeetingLoyalty {
  id: string;
  client_url: string | null;
  client_name: string | null;
  meeting_date: string;
  loyalty_index: number | null;
}

export default function LoyaltyTrackingTab() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingLoyalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, client_url, client_name, meeting_date, loyalty_index')
        .eq('created_by', user.id)
        .not('loyalty_index', 'is', null)
        .order('meeting_date', { ascending: true });
      if (error) {
        toast.error('Erro ao carregar dados de fidelidade');
      } else {
        setMeetings((data || []) as MeetingLoyalty[]);
      }
      setLoading(false);
    })();
  }, [user]);

  const clientData = useMemo(() => {
    const map: Record<string, { url: string; name: string; history: { date: string; index: number }[] }> = {};
    for (const m of meetings) {
      const url = m.client_url || 'Sem URL';
      if (!map[url]) map[url] = { url, name: m.client_name || '', history: [] };
      if (m.loyalty_index != null) {
        map[url].history.push({ date: m.meeting_date, index: m.loyalty_index });
      }
      if (m.client_name && !map[url].name) map[url].name = m.client_name;
    }
    return Object.values(map).map(c => {
      const latest = c.history[c.history.length - 1]?.index ?? 0;
      const previous = c.history.length > 1 ? c.history[c.history.length - 2]?.index ?? latest : latest;
      const trend = latest - previous;
      return { ...c, latest, trend };
    }).sort((a, b) => b.latest - a.latest);
  }, [meetings]);

  const filtered = useMemo(() => {
    if (!search) return clientData;
    const q = search.toLowerCase();
    return clientData.filter(c => c.url.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [clientData, search]);

  const globalAvg = useMemo(() => {
    if (clientData.length === 0) return '—';
    return (clientData.reduce((s, c) => s + c.latest, 0) / clientData.length).toFixed(1);
  }, [clientData]);

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getLoyaltyBadge = (index: number) => {
    if (index >= 4) return <Badge className="bg-success/20 text-success">Muito Alto</Badge>;
    if (index >= 3) return <Badge className="bg-info/20 text-info">Alto</Badge>;
    if (index >= 2) return <Badge className="bg-warning/20 text-warning">Baixo</Badge>;
    return <Badge className="bg-destructive/20 text-destructive">Muito Baixo</Badge>;
  };

  // Prepare chart data: last 6 months aggregated
  const chartData = useMemo(() => {
    const monthMap: Record<string, { sum: number; count: number }> = {};
    for (const m of meetings) {
      if (m.loyalty_index == null) continue;
      const key = m.meeting_date.slice(0, 7); // YYYY-MM
      if (!monthMap[key]) monthMap[key] = { sum: 0, count: 0 };
      monthMap[key].sum += m.loyalty_index;
      monthMap[key].count++;
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, { sum, count }]) => ({
        month: format(parseISO(month + '-01'), 'MMM/yy', { locale: ptBR }),
        avg: parseFloat((sum / count).toFixed(1)),
      }));
  }, [meetings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Star className="h-5 w-5 text-warning" />
            <span className="text-2xl font-bold text-foreground">{globalAvg}</span>
            <span className="text-[11px] text-muted-foreground">Fidelidade Média Atual</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-foreground">{clientData.filter(c => c.latest >= 3).length}</span>
            <span className="text-[11px] text-muted-foreground">Clientes Fidelizados (≥3)</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-foreground">{clientData.filter(c => c.latest <= 2).length}</span>
            <span className="text-[11px] text-muted-foreground">Clientes em Risco (≤2)</span>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução da Fidelidade Média</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 4]} ticks={[1, 2, 3, 4]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Média" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Search + Table */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Fidelidade por Cliente ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de fidelidade encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / URL</TableHead>
                  <TableHead className="text-center">Índice Atual</TableHead>
                  <TableHead className="text-center">Nível</TableHead>
                  <TableHead className="text-center">Tendência</TableHead>
                  <TableHead className="text-center">Avaliações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(row => (
                  <TableRow key={row.url}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {row.name && <span className="text-sm font-medium text-foreground">{row.name}</span>}
                        {row.url !== 'Sem URL' ? (
                          <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{row.url}</a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem URL</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 text-warning" />
                        {row.latest}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{getLoyaltyBadge(row.latest)}</TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        {getTrendIcon(row.trend)}
                        {row.trend > 0 ? `+${row.trend}` : row.trend === 0 ? '—' : row.trend}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{row.history.length}</TableCell>
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
