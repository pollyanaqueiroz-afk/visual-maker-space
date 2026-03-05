import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardBI, formatBRL, formatNumber, getStatusColor } from '@/hooks/useDashboardBI';
import { Loader2, Users, UserCheck, AlertTriangle, Construction, UserX, DollarSign, Receipt, TrendingDown, Clock, GraduationCap } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';

interface OverviewData {
  total_clientes: number;
  ativos: number;
  cancelados: number;
  em_implantacao: number;
  em_risco: number;
  sem_status: number;
  adimplentes: number;
  inadimplentes: number;
  receita_total: number;
  receita_adimplente: number;
  ticket_medio: number;
  media_dias_sem_login: number;
  media_alunos: number;
}

interface StatusItem { status: string; total: number; receita: number; }
interface ReceitaItem { status: string; total: number; receita: number; ticket_medio: number | null; }

export default function BIOverviewPage({ csEmail }: { csEmail?: string }) {
  const { data, loading, error } = useDashboardBI<OverviewData>('overview', csEmail);
  const { data: statusData, loading: l2 } = useDashboardBI<StatusItem[]>('status', csEmail);
  const { data: receitaData, loading: l3 } = useDashboardBI<ReceitaItem[]>('receita_por_status', csEmail);

  if (loading || l2 || l3) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="text-destructive p-4">Erro: {error}</div>;

  const kpiRow1 = [
    { label: 'Total Clientes', value: formatNumber(data.total_clientes), icon: Users, color: 'bg-muted text-foreground', extra: data.sem_status > 0 ? `+${data.sem_status} sem status` : undefined },
    { label: 'Ativos', value: formatNumber(data.ativos), icon: UserCheck, color: 'bg-success/10 text-success' },
    { label: 'Em Risco', value: formatNumber(data.em_risco), icon: AlertTriangle, color: 'bg-warning/10 text-warning' },
    { label: 'Em Implantação', value: formatNumber(data.em_implantacao), icon: Construction, color: 'bg-info/10 text-info' },
    { label: 'Cancelados', value: formatNumber(data.cancelados), icon: UserX, color: 'bg-destructive/10 text-destructive' },
  ];

  const kpiRow2 = [
    { label: 'Receita Total', value: formatBRL(data.receita_total), icon: DollarSign, color: 'bg-success/10 text-success' },
    { label: 'Receita Adimplente', value: formatBRL(data.receita_adimplente), icon: Receipt, color: 'bg-success/10 text-success' },
    { label: 'Ticket Médio', value: formatBRL(data.ticket_medio), icon: TrendingDown, color: 'bg-info/10 text-info' },
    { label: 'Adimplentes / Inadimplentes', value: `${formatNumber(data.adimplentes)} / ${formatNumber(data.inadimplentes)}`, icon: Users, color: 'bg-warning/10 text-warning' },
  ];

  const kpiRow3 = [
    { label: 'Média dias sem login', value: data.media_dias_sem_login?.toFixed(1) ?? '—', icon: Clock, color: 'bg-warning/10 text-warning' },
    { label: 'Média de alunos', value: data.media_alunos?.toFixed(1) ?? '—', icon: GraduationCap, color: 'bg-info/10 text-info' },
  ];

  const CustomTooltipPie = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-card p-3 shadow-md text-sm">
        <p className="font-semibold">{d.status}</p>
        <p>Total: {formatNumber(d.total)}</p>
        <p>Receita: {formatBRL(d.receita)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiRow1.map(k => (
          <Card key={k.label} className="border-none shadow-[var(--shadow-kpi)]">
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-extrabold tracking-tight">{k.value}</p>
                {k.extra && <p className="text-[10px] text-muted-foreground mt-0.5">{k.extra}</p>}
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiRow2.map(k => (
          <Card key={k.label} className="border-none shadow-[var(--shadow-kpi)]">
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tracking-tight">{k.value}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-2 gap-4 max-w-lg">
        {kpiRow3.map(k => (
          <Card key={k.label} className="border-none shadow-[var(--shadow-kpi)]">
            <CardContent className="p-4 flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold tracking-tight">{k.value}</p>
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut: Status Distribution */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle></CardHeader>
          <CardContent>
            {statusData && statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} dataKey="total" nameKey="status" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                    {statusData.map((s, i) => <Cell key={i} fill={getStatusColor(s.status)} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltipPie />} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Bar: Receita por Status */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Receita por Status</CardTitle></CardHeader>
          <CardContent>
            {receitaData && receitaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={receitaData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="status" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : name === 'ticket_medio' ? formatBRL(v) : v} />
                  <Bar dataKey="receita" name="Receita" radius={[0, 4, 4, 0]}>
                    {receitaData.map((s, i) => <Cell key={i} fill={getStatusColor(s.status)} />)}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
