import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Star, Search, TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MeetingLoyalty {
  id: string;
  client_url: string | null;
  client_name: string | null;
  meeting_date: string;
  loyalty_index: number | null;
  status: string;
}

export default function LoyaltyTrackingTab() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<MeetingLoyalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientPlans, setClientPlans] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, client_url, client_name, meeting_date, loyalty_index, status')
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: true });
      if (error) {
        toast.error('Erro ao carregar dados de fidelidade');
      } else {
        setMeetings((data || []) as MeetingLoyalty[]);
      }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clients')
        .select('client_url, plano_contratado')
        .not('plano_contratado', 'is', null);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((c: any) => { if (c.client_url && c.plano_contratado) map[c.client_url] = c.plano_contratado; });
        setClientPlans(map);
      }
    })();
  }, []);

  const clientData = useMemo(() => {
    const meetingsWithLoyalty = meetings.filter(m => m.loyalty_index != null && m.loyalty_index > 0);
    const map: Record<string, { url: string; name: string; history: { date: string; index: number }[] }> = {};
    for (const m of meetingsWithLoyalty) {
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

  const adherenceStats = useMemo(() => {
    const completedAll = meetings.filter(m => m.status === 'completed');
    const completed = completedAll.filter(m => m.loyalty_index !== 0);
    const withLoyalty = completed.filter(m => m.loyalty_index != null && m.loyalty_index > 0);
    const withoutLoyalty = completed.filter(m => m.loyalty_index == null);
    const rate = completed.length > 0 ? Math.round((withLoyalty.length / completed.length) * 100) : 0;

    const monthMap: Record<string, { completed: number; withLoyalty: number }> = {};
    for (const m of completed) {
      const key = m.meeting_date.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { completed: 0, withLoyalty: 0 };
      monthMap[key].completed += 1;
      if (m.loyalty_index != null) monthMap[key].withLoyalty += 1;
    }

    const monthlyAdherence = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: format(parseISO(month + '-01'), 'MMM/yy', { locale: ptBR }),
        taxa: data.completed > 0 ? Math.round((data.withLoyalty / data.completed) * 100) : 0,
        total: data.completed,
        preenchidas: data.withLoyalty,
      }));

    return { completed: completed.length, withLoyalty: withLoyalty.length, withoutLoyalty: withoutLoyalty.length, rate, monthlyAdherence };
  }, [meetings]);

  const loyaltyByPlan = useMemo(() => {
    const map: Record<string, { sum: number; count: number; clients: number; atRisk: number; fidelized: number }> = {};
    for (const c of clientData) {
      const plan = clientPlans[c.url] || 'Sem plano definido';
      if (!map[plan]) map[plan] = { sum: 0, count: 0, clients: 0, atRisk: 0, fidelized: 0 };
      map[plan].sum += c.latest;
      map[plan].count += 1;
      map[plan].clients += 1;
      if (c.latest <= 2) map[plan].atRisk += 1;
      if (c.latest >= 3) map[plan].fidelized += 1;
    }
    return Object.entries(map)
      .map(([plan, data]) => ({
        plan,
        avg: parseFloat((data.sum / data.count).toFixed(1)),
        clients: data.clients,
        atRisk: data.atRisk,
        fidelized: data.fidelized,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [clientData, clientPlans]);

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

  const chartData = useMemo(() => {
    const monthMap: Record<string, { sum: number; count: number }> = {};
    for (const m of meetings) {
      if (m.loyalty_index == null) continue;
      const key = m.meeting_date.slice(0, 7);
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
      {/* 1. KPIs existentes */}
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

      {/* 2. Card de Aderência das Respostas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Aderência das Respostas
            <Badge variant="outline" className={`text-xs ${
              adherenceStats.rate >= 80 ? 'border-success/30 text-success' :
              adherenceStats.rate >= 50 ? 'border-warning/30 text-warning' :
              'border-destructive/30 text-destructive'
            }`}>
              {adherenceStats.rate}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-xl font-bold">{adherenceStats.completed}</p>
              <p className="text-[10px] text-muted-foreground">Reuniões realizadas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-success/10">
              <p className="text-xl font-bold text-success">{adherenceStats.withLoyalty}</p>
              <p className="text-[10px] text-muted-foreground">Com fidelidade preenchida</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-xl font-bold text-destructive">{adherenceStats.withoutLoyalty}</p>
              <p className="text-[10px] text-muted-foreground">Sem preenchimento</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Taxa de aderência</span>
              <span className={`font-bold ${
                adherenceStats.rate >= 80 ? 'text-success' :
                adherenceStats.rate >= 50 ? 'text-warning' :
                'text-destructive'
              }`}>{adherenceStats.rate}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  adherenceStats.rate >= 80 ? 'bg-success' :
                  adherenceStats.rate >= 50 ? 'bg-warning' :
                  'bg-destructive'
                }`}
                style={{ width: `${adherenceStats.rate}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {adherenceStats.rate >= 80
                ? '✅ Excelente! A maioria das reuniões tem avaliação de fidelidade.'
                : adherenceStats.rate >= 50
                ? '⚠️ Atenção: algumas reuniões estão sem avaliação de fidelidade.'
                : '🚨 Crítico: a maioria das reuniões está sem avaliação. Preencha a fidelidade ao concluir cada reunião.'}
            </p>
          </div>

          {adherenceStats.monthlyAdherence.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Evolução da Aderência por Mês</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={adherenceStats.monthlyAdherence}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)', fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === 'taxa') return [`${value}%`, 'Aderência'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="taxa" name="taxa" radius={[4, 4, 0, 0]}>
                    {adherenceStats.monthlyAdherence.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.taxa >= 80 ? 'hsl(var(--success))' : entry.taxa >= 50 ? 'hsl(var(--warning, 30 90% 50%))' : 'hsl(var(--destructive))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid gap-1.5 mt-2">
                {adherenceStats.monthlyAdherence.map(m => (
                  <div key={m.month} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/30 text-xs">
                    <span className="font-medium capitalize">{m.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{m.preenchidas}/{m.total} reuniões</span>
                      <Badge variant="outline" className={`text-[9px] ${
                        m.taxa >= 80 ? 'border-success/30 text-success' :
                        m.taxa >= 50 ? 'border-warning/30 text-warning' :
                        'border-destructive/30 text-destructive'
                      }`}>
                        {m.taxa}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Gráfico Evolução da Fidelidade Média */}
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

      {/* 4. Fidelidade por Plano */}
      {loyaltyByPlan.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Fidelidade Média por Tipo de Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(160, loyaltyByPlan.length * 50)}>
              <BarChart data={loyaltyByPlan} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="plan" width={180} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)', fontSize: 12 }}
                  formatter={(value: number) => [`${value}`, 'Média']}
                />
                <Bar dataKey="avg" radius={[0, 6, 6, 0]}>
                  {loyaltyByPlan.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.avg >= 3 ? 'hsl(var(--success))' : entry.avg >= 2 ? 'hsl(var(--warning, 30 90% 50%))' : 'hsl(var(--destructive))'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-center">Clientes</TableHead>
                  <TableHead className="text-center">Média</TableHead>
                  <TableHead className="text-center">Fidelizados (≥3)</TableHead>
                  <TableHead className="text-center">Em Risco (≤2)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loyaltyByPlan.map(row => (
                  <TableRow key={row.plan}>
                    <TableCell className="font-medium text-sm">{row.plan}</TableCell>
                    <TableCell className="text-center">{row.clients}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-xs ${
                        row.avg >= 3 ? 'border-success/30 text-success' :
                        row.avg >= 2 ? 'border-warning/30 text-warning' :
                        'border-destructive/30 text-destructive'
                      }`}>
                        <Star className="h-2.5 w-2.5 mr-0.5" /> {row.avg}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-success font-medium">{row.fidelized}</span>
                      <span className="text-muted-foreground text-xs ml-1">({row.clients > 0 ? Math.round((row.fidelized / row.clients) * 100) : 0}%)</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-destructive font-medium">{row.atRisk}</span>
                      <span className="text-muted-foreground text-xs ml-1">({row.clients > 0 ? Math.round((row.atRisk / row.clients) * 100) : 0}%)</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 5. Busca de cliente */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {/* 6. Tabela Fidelidade por Cliente (com coluna Plano) */}
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
                  <TableHead>Plano</TableHead>
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
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{clientPlans[row.url] || '—'}</span>
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

      {/* 7. Reuniões sem fidelidade preenchida */}
      {adherenceStats.withoutLoyalty > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Reuniões sem fidelidade preenchida ({adherenceStats.withoutLoyalty})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {meetings
                .filter(m => m.status === 'completed' && m.loyalty_index == null)
                .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date))
                .map(m => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background/80">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium">{format(parseISO(m.meeting_date), 'dd/MM/yyyy')}</span>
                      <span className="text-xs text-muted-foreground">{m.client_name || m.client_url || 'Sem cliente'}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">Sem avaliação</Badge>
                  </div>
                ))}
            </div>
            <p className="text-[10px] text-destructive/60 mt-2">
              Acesse o agendamento para preencher a fidelidade dessas reuniões.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
