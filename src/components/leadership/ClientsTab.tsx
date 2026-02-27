import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Users, DollarSign, Loader2, TrendingUp, AlertTriangle, PauseCircle, XCircle } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/KpiCard';
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

const PLANS = ['Evolution', 'Evolution App', 'Pro', 'Enterprise', 'Black'] as const;
const STATUSES = ['ativo', 'inadimplente', 'churned', 'em_trial'] as const;

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  inadimplente: 'Inadimplente',
  churned: 'Churned',
  em_trial: 'Em Trial',
};

const STATUS_COLORS: Record<string, string> = {
  ativo: 'bg-success/15 text-success',
  inadimplente: 'bg-warning/15 text-warning',
  churned: 'bg-destructive/15 text-destructive',
  em_trial: 'bg-info/15 text-info',
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
];

interface ClientRow {
  id: string;
  client_url: string;
  client_name: string | null;
  plan: string | null;
  monthly_value: number | null;
  client_status: string | null;
  loyalty_index: number | null;
}

export default function ClientsTab() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('clients' as any)
        .select('id, client_url, client_name, plan, monthly_value, client_status, loyalty_index')
        .order('client_name', { ascending: true }) as any;

      if (error) {
        console.error(error);
        toast.error('Erro ao carregar clientes');
      } else {
        setClients((data || []) as ClientRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let list = clients;
    if (statusFilter !== 'all') list = list.filter(c => (c.client_status || 'ativo') === statusFilter);
    if (planFilter !== 'all') list = list.filter(c => c.plan === planFilter);
    return list;
  }, [clients, statusFilter, planFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalRevenue = filtered.reduce((s, c) => s + (c.monthly_value || 0), 0);
    const avgRevenue = total > 0 ? totalRevenue / total : 0;
    const ativos = filtered.filter(c => (c.client_status || 'ativo') === 'ativo').length;
    const inadimplentes = filtered.filter(c => c.client_status === 'inadimplente').length;
    const churned = filtered.filter(c => c.client_status === 'churned').length;
    const emTrial = filtered.filter(c => c.client_status === 'em_trial').length;
    return { total, totalRevenue, avgRevenue, ativos, inadimplentes, churned, emTrial };
  }, [filtered]);

  const byPlan = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const c of filtered) {
      const plan = c.plan || 'Sem plano';
      if (!map[plan]) map[plan] = { name: plan, count: 0, revenue: 0 };
      map[plan].count++;
      map[plan].revenue += c.monthly_value || 0;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map: Record<string, { name: string; value: number }> = {};
    for (const c of filtered) {
      const status = STATUS_LABELS[c.client_status || 'ativo'] || c.client_status || 'Ativo';
      if (!map[status]) map[status] = { name: status, value: 0 };
      map[status].value++;
    }
    return Object.values(map);
  }, [filtered]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {PLANS.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Clientes" value={stats.total} icon={Users} color="bg-primary/10 text-primary" />
        <KpiCard label="Receita Total" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} color="bg-success/10 text-success" />
        <KpiCard label="Ticket Médio" value={formatCurrency(stats.avgRevenue)} icon={TrendingUp} color="bg-info/10 text-info" />
        <KpiCard label="Ativos" value={stats.ativos} icon={Users} color="bg-success/10 text-success" />
        <KpiCard label="Inadimplentes" value={stats.inadimplentes} icon={AlertTriangle} color="bg-warning/10 text-warning" />
        <KpiCard label="Churned" value={stats.churned} icon={XCircle} color="bg-destructive/10 text-destructive" />
        <KpiCard label="Em Trial" value={stats.emTrial} icon={PauseCircle} color="bg-info/10 text-info" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clientes por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {byPlan.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={byPlan} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }}
                    formatter={(value: number, name: string) =>
                      name === 'revenue' ? formatCurrency(value) : value
                    }
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="count" name="Clientes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} strokeWidth={2} stroke="hsl(var(--card))">
                  {byStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: 'var(--shadow-elevated)' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan table */}
      <Card className="border-none shadow-[var(--shadow-kpi)]">
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Receita por Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Plano</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Clientes</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">% Base</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Receita Mensal</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">% Receita</TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">Ticket Médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPlan.map(row => {
                const pctBase = stats.total > 0 ? ((row.count / stats.total) * 100).toFixed(1) : '0';
                const pctRevenue = stats.totalRevenue > 0 ? ((row.revenue / stats.totalRevenue) * 100).toFixed(1) : '0';
                const avgTicket = row.count > 0 ? row.revenue / row.count : 0;
                return (
                  <TableRow key={row.name} className="border-border/30">
                    <TableCell className="font-medium text-sm">
                      <Badge variant="outline" className="text-xs">{row.name}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold">{row.count}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{pctBase}%</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCurrency(row.revenue)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{pctRevenue}%</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(avgTicket)}</TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="border-t-2 border-border font-bold">
                <TableCell className="text-sm">Total</TableCell>
                <TableCell className="text-center">{stats.total}</TableCell>
                <TableCell className="text-center">100%</TableCell>
                <TableCell className="text-right">{formatCurrency(stats.totalRevenue)}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell className="text-right">{formatCurrency(stats.avgRevenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
