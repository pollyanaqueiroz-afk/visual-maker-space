import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDashboardBI, formatBRL, formatNumber, getStatusColor } from '@/hooks/useDashboardBI';
import { useCountUp } from '@/hooks/useCountUp';
import { Loader2, Users, UserCheck, AlertTriangle, Construction, UserX, DollarSign, Receipt, TrendingDown, Clock, GraduationCap, Rocket, Ban } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart } from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface OverviewData {
  total_clientes: number;
  ativos: number;
  em_implantacao: number;
  em_risco: number;
  cancelados: number;
  adimplentes: number;
  inadimplentes: number;
  receita_total: number;
  receita_planos: number;
  receita_upsell: number;
  receita_inadimplente: number;
  mrr_upsell: number;
  ticket_medio: number;
  media_dias_sem_login: number;
  media_alunos: number;
}

interface ClientDetail {
  nome: string;
  id_curseduca?: string;
  plano?: string;
  receita?: number;
  contrato_status?: string;
  cs_nome?: string;
  status_financeiro?: string;
  risco_churn?: string;
}

interface StatusItem { status: string; total: number; receita: number; }
interface ReceitaItem { status: string; total: number; receita: number; ticket_medio: number | null; }
interface MRRWeekly { periodo: string; mrr: number; mrr_planos?: number; mrr_upsell?: number; }

function AnimatedKPI({ label, rawValue, formatted, icon: Icon, color, extra, delay, onClick }: {
  label: string; rawValue: number; formatted: string; icon: any; color: string; extra?: string; delay: number; onClick?: () => void;
}) {
  const isCurrency = formatted.startsWith('R$');
  const countDisplay = useCountUp({ end: rawValue, duration: 1200, decimals: 0, separator: '.' });
  const display = isCurrency ? formatted : countDisplay;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    >
      <Card
        className={cn("border-none shadow-[var(--shadow-kpi)]", onClick && "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all")}
        onClick={onClick}
      >
        <CardContent className="p-4 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="text-2xl font-extrabold tracking-tight">{display}</p>
            {extra && <p className="text-[10px] text-muted-foreground mt-0.5">{extra}</p>}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ClientListModal({ open, onClose, title, clients, loading }: {
  open: boolean; onClose: () => void; title: string; clients: ClientDetail[]; loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title} ({clients.length})</DialogTitle>
          <DialogDescription>Lista detalhada de clientes nesta categoria</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : clients.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead>CS</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{c.nome || c.id_curseduca || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{c.plano || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{formatBRL(c.receita)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.cs_nome || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.contrato_status === 'Cancelado' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {c.contrato_status || '—'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function BIOverviewPage({ csEmail }: { csEmail?: string }) {
  const { data, loading, error } = useDashboardBI<OverviewData>('overview', csEmail);
  const { data: statusData, loading: l2 } = useDashboardBI<StatusItem[]>('status', csEmail);
  const { data: receitaData, loading: l3 } = useDashboardBI<ReceitaItem[]>('receita_por_status', csEmail);
  const { data: mrrSemanal } = useDashboardBI<MRRWeekly[]>('mrr_semanal', csEmail);
  const { data: mrrMensal } = useDashboardBI<MRRWeekly[]>('mrr_mensal', csEmail);

  // Client lists for modals
  const { data: allClients, loading: lClients } = useDashboardBI<ClientDetail[]>('clientes_lista', csEmail);
  const [modalType, setModalType] = useState<string | null>(null);
  const [mrrView, setMrrView] = useState<'semanal' | 'mensal'>('mensal');

  if (loading || l2 || l3) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error || !data) return <div className="text-destructive p-4">Erro: {error}</div>;

  const mrrTotal = data.receita_total;
  const mrrUpsell = data.mrr_upsell || 0;
  const mrrPlanos = data.receita_planos || (mrrTotal - mrrUpsell);
  const valorInadimplente = data.receita_inadimplente || 0;

  const getModalClients = (): ClientDetail[] => {
    if (!allClients || !Array.isArray(allClients)) return [];
    switch (modalType) {
      case 'total': return allClients;
      case 'ativos': return allClients.filter(c => c.contrato_status === 'Ativo' || c.contrato_status === 'ACTIVE');
      case 'risco': return allClients.filter(c => c.contrato_status === 'Risco por Engajamento' || c.risco_churn === 'alto' || c.risco_churn === 'critico');
      case 'implantacao': return allClients.filter(c => c.contrato_status === 'Implantacao' || c.contrato_status === 'Implantação');
      case 'cancelados': return allClients.filter(c => c.contrato_status === 'Cancelado' || c.contrato_status === 'BLOCK');
      default: return [];
    }
  };

  const getModalTitle = (): string => {
    switch (modalType) {
      case 'total': return 'Total de Clientes';
      case 'ativos': return 'Clientes Ativados';
      case 'risco': return 'Clientes Em Risco';
      case 'implantacao': return 'Clientes Em Implantação';
      case 'cancelados': return 'Clientes Cancelados';
      default: return '';
    }
  };

  const kpiRow1 = [
    { label: 'Total Clientes', raw: data.total_clientes, formatted: formatNumber(data.total_clientes), icon: Users, color: 'bg-muted text-foreground', key: 'total' },
    { label: 'Ativados', raw: data.ativos, formatted: formatNumber(data.ativos), icon: UserCheck, color: 'bg-success/10 text-success', key: 'ativos' },
    { label: 'Em Risco', raw: data.em_risco, formatted: formatNumber(data.em_risco), icon: AlertTriangle, color: 'bg-warning/10 text-warning', key: 'risco' },
    { label: 'Em Implantação', raw: data.em_implantacao, formatted: formatNumber(data.em_implantacao), icon: Construction, color: 'bg-info/10 text-info', key: 'implantacao' },
    { label: 'Cancelados', raw: data.cancelados ?? 0, formatted: formatNumber(data.cancelados ?? 0), icon: UserX, color: 'bg-destructive/10 text-destructive', key: 'cancelados' },
  ];

  const kpiRow2 = [
    { label: 'MRR Total', raw: mrrTotal, formatted: formatBRL(mrrTotal), icon: DollarSign, color: 'bg-success/10 text-success' },
    { label: 'MRR Planos', raw: mrrPlanos, formatted: formatBRL(mrrPlanos), icon: Receipt, color: 'bg-success/10 text-success' },
    { label: 'MRR Upsell', raw: mrrUpsell, formatted: formatBRL(mrrUpsell), icon: Rocket, color: 'bg-info/10 text-info' },
    { label: 'Valor Inadimplente', raw: valorInadimplente, formatted: formatBRL(valorInadimplente), icon: Ban, color: 'bg-destructive/10 text-destructive' },
  ];

  const kpiRow3 = [
    { label: 'Ticket Médio', raw: data.ticket_medio, formatted: formatBRL(data.ticket_medio), icon: TrendingDown, color: 'bg-info/10 text-info' },
    { label: 'Adimplentes / Inadimplentes', raw: data.adimplentes, formatted: `${formatNumber(data.adimplentes)} / ${formatNumber(data.inadimplentes)}`, icon: Users, color: 'bg-warning/10 text-warning' },
    { label: 'Média dias sem login', raw: data.media_dias_sem_login || 0, formatted: data.media_dias_sem_login?.toFixed(1) ?? '—', icon: Clock, color: 'bg-warning/10 text-warning' },
    { label: 'Média de alunos', raw: data.media_alunos || 0, formatted: data.media_alunos?.toFixed(1) ?? '—', icon: GraduationCap, color: 'bg-info/10 text-info' },
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

  // Filter MRR data to start from Jan 2026
  const filterFrom2026 = (arr: MRRWeekly[] | null) => {
    if (!arr) return [];
    return arr.filter(d => d.periodo >= '2026-01');
  };

  const mrrChartData = mrrView === 'mensal' ? filterFrom2026(mrrMensal) : filterFrom2026(mrrSemanal);

  return (
    <div className="space-y-6">
      {/* Row 1 — Clickable client KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpiRow1.map((k, i) => (
          <AnimatedKPI
            key={k.label} label={k.label} rawValue={k.raw} formatted={k.formatted}
            icon={k.icon} color={k.color} delay={i * 0.08}
            onClick={() => setModalType(k.key)}
          />
        ))}
      </div>

      {/* Row 2 — MRR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiRow2.map((k, i) => (
          <AnimatedKPI key={k.label} label={k.label} rawValue={k.raw} formatted={k.formatted} icon={k.icon} color={k.color} delay={0.4 + i * 0.08} />
        ))}
      </div>

      {/* Row 3 — extras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiRow3.map((k, i) => (
          <AnimatedKPI key={k.label} label={k.label} rawValue={k.raw} formatted={k.formatted} icon={k.icon} color={k.color} delay={0.7 + i * 0.08} />
        ))}
      </div>

      {/* MRR Semanal / Mensal Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.5 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Acompanhamento MRR</CardTitle>
            <div className="flex gap-1">
              {(['semanal', 'mensal'] as const).map(v => (
                <button key={v} onClick={() => setMrrView(v)}
                  className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                    mrrView === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  )}>
                  {v === 'semanal' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {mrrChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={mrrChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="mrr_planos" name="MRR Planos" fill="hsl(var(--success))" stackId="mrr" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="mrr_upsell" name="MRR Upsell" fill="hsl(var(--info))" stackId="mrr" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-8">Dados de MRR ainda não disponíveis na API</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.5 }}>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">Distribuição por Status</CardTitle></CardHeader>
            <CardContent>
              {statusData && statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={statusData} dataKey="total" nameKey="status" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} animationBegin={0} animationDuration={1200} animationEasing="ease-out">
                      {statusData.map((s, i) => <Cell key={i} fill={getStatusColor(s.status)} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltipPie />} />
                    <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.5 }}>
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold">MRR por Status</CardTitle></CardHeader>
            <CardContent>
              {receitaData && receitaData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={receitaData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="status" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : name === 'ticket_medio' ? formatBRL(v) : v} />
                    <Bar dataKey="receita" name="MRR" radius={[0, 4, 4, 0]} animationBegin={200} animationDuration={1000} animationEasing="ease-out">
                      {receitaData.map((s, i) => <Cell key={i} fill={getStatusColor(s.status)} />)}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Client detail modal */}
      <ClientListModal
        open={!!modalType}
        onClose={() => setModalType(null)}
        title={getModalTitle()}
        clients={getModalClients()}
        loading={lClients}
      />
    </div>
  );
}
