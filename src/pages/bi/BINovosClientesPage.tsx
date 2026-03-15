import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2, Search, UserPlus, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const InfoTip = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1.5 shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

interface NovoCliente {
  nome: string;
  id_curseduca?: string;
  plano?: string;
  receita?: number;
  data_ativacao?: string;
  cs_nome?: string;
  contrato_status?: string;
}

interface NovosTimeline {
  periodo: string;
  total: number;
  receita: number;
}

interface NovosPorPlano {
  plano: string;
  total: number;
  receita: number;
}

const PIE_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#8b5cf6', '#ec4899', '#f97316', '#6b7280'];

export default function BINovosClientesPage({ csEmail }: { csEmail?: string }) {
  const { data: clientesData, loading: l1 } = useDashboardBI<NovoCliente[]>('novos_clientes', csEmail);
  const { data: timelineDia } = useDashboardBI<NovosTimeline[]>('novos_por_dia', csEmail);
  const { data: timelineSemana } = useDashboardBI<NovosTimeline[]>('novos_por_semana', csEmail);
  const { data: timelineMes } = useDashboardBI<NovosTimeline[]>('novos_por_mes', csEmail);
  const { data: porPlanoData } = useDashboardBI<NovosPorPlano[]>('novos_por_plano', csEmail);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [sortKey, setSortKey] = useState<'nome' | 'receita' | 'data_ativacao'>('data_ativacao');
  const [sortAsc, setSortAsc] = useState(false);

  if (l1) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const clientes = Array.isArray(clientesData) ? clientesData : [];
  const totalNovos = clientes.length;
  const totalReceita = clientes.reduce((s, c) => s + (c.receita || 0), 0);

  // Filter from Jan 2026
  const filterFrom2026 = (arr: NovosTimeline[] | null) => {
    if (!arr) return [];
    return arr.filter(d => d.periodo >= '2026-01');
  };

  const timelineData = viewMode === 'dia' ? filterFrom2026(timelineDia) :
    viewMode === 'semana' ? filterFrom2026(timelineSemana) : filterFrom2026(timelineMes);

  const planoData = (porPlanoData || []).map((p, i) => ({ ...p, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.nome || '').toLowerCase().includes(q) || (c.plano || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Novos Clientes <InfoTip text="Contagem total de clientes novos retornados pela API. Representa todos os clientes ativados no período selecionado." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight">{formatNumber(totalNovos)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                MRR Novos <InfoTip text="Soma da receita recorrente mensal (MRR) de todos os novos clientes. Mostra o impacto financeiro das novas aquisições." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight">{formatBRL(totalReceita)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-[var(--shadow-kpi)]">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Planos Distintos <InfoTip text="Quantidade de tipos de plano diferentes entre os novos clientes. Ajuda a entender a diversificação de planos nas novas aquisições." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight">{planoData.length}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-info/10 text-info">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Novos Clientes — Por Valor e Quantidade <InfoTip text="Gráfico de barras duplas mostrando a evolução temporal da quantidade de novos clientes (eixo esquerdo) e o MRR gerado (eixo direito). Permite comparar volume vs. valor das aquisições ao longo do tempo. Filtro a partir de Jan/2026." /></CardTitle>
          <div className="flex gap-1">
            {(['dia', 'semana', 'mes'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                  viewMode === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}>
                {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="periodo" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : formatNumber(v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="Qtd Novos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="receita" name="MRR Novos" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">Dados ainda não disponíveis na API</p>}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By plan pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Novos por Tipo de Plano <InfoTip text="Distribuição percentual dos novos clientes por tipo de plano. Identifica quais planos atraem mais clientes e ajuda no direcionamento comercial." /></CardTitle></CardHeader>
          <CardContent>
            {planoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={planoData} dataKey="total" nameKey="plano" cx="50%" cy="50%" outerRadius={100}
                    label={({ plano, percent }) => `${plano} ${(percent * 100).toFixed(0)}%`}>
                    {planoData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string, props: any) => [formatNumber(v), props.payload.plano]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Client table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold">Lista de Novos ({filtered.length}) <InfoTip text="Tabela com todos os novos clientes, ordenável por nome, MRR e data de ativação. Permite busca por nome ou plano. Exibe até 50 registros." /></CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 max-w-xs h-8 text-sm" />
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>Cliente<SortIcon col="nome" /></TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>MRR<SortIcon col="receita" /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort('data_ativacao')}>Ativação<SortIcon col="data_ativacao" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 50).map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{c.nome || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.plano || '—'}</Badge></TableCell>
                    <TableCell className="text-right">{formatBRL(c.receita)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.data_ativacao || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
