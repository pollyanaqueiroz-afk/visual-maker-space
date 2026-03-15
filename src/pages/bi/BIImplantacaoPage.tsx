import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useDashboardBI, formatBRL, formatNumber, formatPct } from '@/hooks/useDashboardBI';
import { Loader2, Search, Construction, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

interface ImplantacaoCliente {
  nome: string;
  id_curseduca?: string;
  plano?: string;
  receita?: number;
  status_financeiro?: string;
  risco_churn?: string;
  dias_contrato?: number;
  dias_desde_primeiro_aluno?: number;
  membros_mes_atual?: number;
  cs_nome?: string;
}

interface ImplantacaoOverview {
  total_implantacao: number;
  pct_adimplente: number;
  pct_inadimplente: number;
  churn_em_implantacao: number;
  pct_churn_implantacao: number;
  above_5_students: number;
}

interface ImplantacaoFinalizada {
  periodo: string;
  total: number;
}

const PIE_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#6b7280'];
const RISK_COLORS: Record<string, string> = { baixo: '#22c55e', medio: '#eab308', alto: '#f97316', critico: '#ef4444' };

export default function BIImplantacaoPage({ csEmail }: { csEmail?: string }) {
  const { data: clientesData, loading: l1 } = useDashboardBI<ImplantacaoCliente[]>('implantacao_clientes', csEmail);
  const { data: overview } = useDashboardBI<ImplantacaoOverview>('implantacao_overview', csEmail);
  const { data: finDia } = useDashboardBI<ImplantacaoFinalizada[]>('implantacao_finalizada_dia', csEmail);
  const { data: finSemana } = useDashboardBI<ImplantacaoFinalizada[]>('implantacao_finalizada_semana', csEmail);
  const { data: finMes } = useDashboardBI<ImplantacaoFinalizada[]>('implantacao_finalizada_mes', csEmail);

  const [search, setSearch] = useState('');
  const [finView, setFinView] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [sortKey, setSortKey] = useState<'nome' | 'receita' | 'dias_contrato'>('dias_contrato');
  const [sortAsc, setSortAsc] = useState(false);

  if (l1) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const clientes = Array.isArray(clientesData) ? clientesData : [];
  const ov = overview || { total_implantacao: clientes.length, pct_adimplente: 0, pct_inadimplente: 0, churn_em_implantacao: 0, pct_churn_implantacao: 0, above_5_students: 0 };

  // By plan
  const planCounts: Record<string, number> = {};
  clientes.forEach(c => { const p = c.plano || 'Sem plano'; planCounts[p] = (planCounts[p] || 0) + 1; });
  const planData = Object.entries(planCounts).sort((a, b) => b[1] - a[1]).map(([name, value], i) => ({ name, value, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  // By risk
  const riskCounts: Record<string, number> = {};
  clientes.forEach(c => { const r = c.risco_churn || 'sem_info'; riskCounts[r] = (riskCounts[r] || 0) + 1; });
  const riskData = Object.entries(riskCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value, fill: RISK_COLORS[name] || '#9ca3af' }));

  // Finalized timeline
  const filterFrom2026 = (arr: ImplantacaoFinalizada[] | null) => (arr || []).filter(d => d.periodo >= '2026-01');
  const finData = finView === 'dia' ? filterFrom2026(finDia) : finView === 'semana' ? filterFrom2026(finSemana) : filterFrom2026(finMes);

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.nome || '').toLowerCase().includes(q) || (c.plano || '').toLowerCase().includes(q);
  });

  // Clients with >5 students should exit implantation - flag them
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? 0, vb = b[sortKey] ?? 0;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: string }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Em Implantação</p>
            <p className="text-2xl font-extrabold">{formatNumber(ov.total_implantacao)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">% Adimplente</p>
            <p className="text-2xl font-extrabold text-success">{formatPct(ov.pct_adimplente)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">% Inadimplente</p>
            <p className="text-2xl font-extrabold text-destructive">{formatPct(ov.pct_inadimplente)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Churn em Implantação</p>
            <p className="text-2xl font-extrabold text-destructive">{formatNumber(ov.churn_em_implantacao)}</p>
            <span className="text-[10px] text-muted-foreground">{formatPct(ov.pct_churn_implantacao)}</span>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 text-center">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{">"} 5 Alunos (Sair)</p>
            <p className="text-2xl font-extrabold text-warning">{formatNumber(ov.above_5_students)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By plan */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Por Tipo de Plano</CardTitle></CardHeader>
          <CardContent>
            {planData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {planData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* By risk */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Por Nível de Risco</CardTitle></CardHeader>
          <CardContent>
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {riskData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Implantação finalizada timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Implantação Finalizada</CardTitle>
          <div className="flex gap-1">
            {(['dia', 'semana', 'mes'] as const).map(v => (
              <button key={v} onClick={() => setFinView(v)}
                className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                  finView === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}>
                {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {finData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={finData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" name="Finalizadas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">Dados ainda não disponíveis</p>}
        </CardContent>
      </Card>

      {/* Client table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm font-semibold">Clientes em Implantação ({filtered.length})</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 max-w-xs h-8 text-sm" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>Cliente<SortIcon col="nome" /></TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('receita')}>MRR<SortIcon col="receita" /></TableHead>
                <TableHead>Financeiro</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('dias_contrato')}>Dias Contrato<SortIcon col="dias_contrato" /></TableHead>
                <TableHead className="text-right">Alunos</TableHead>
                <TableHead>CS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.slice(0, 100).map((c, i) => {
                const exceedsStudents = (c.membros_mes_atual || 0) > 5;
                return (
                  <TableRow key={i} className={cn(exceedsStudents && "bg-warning/5")}>
                    <TableCell className="font-medium text-sm">{c.nome || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.plano || '—'}</Badge></TableCell>
                    <TableCell className="text-right">{formatBRL(c.receita)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status_financeiro === 'Inadimplente' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {c.status_financeiro || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px]", c.risco_churn === 'alto' || c.risco_churn === 'critico' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground')}>
                        {c.risco_churn || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{c.dias_contrato ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn(exceedsStudents && "font-bold text-warning")}>
                        {c.membros_mes_atual ?? '—'}
                        {exceedsStudents && ' ⚠'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.cs_nome || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
