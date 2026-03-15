import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2, Search, UserPlus, ChevronUp, ChevronDown, Info, Users, DollarSign, Layers } from 'lucide-react';
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
  email?: string;
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
}

const PIE_COLORS = ['#64748b', '#3b82f6', '#94a3b8', '#6366f1', '#a1a1aa', '#475569', '#818cf8'];

export default function BINovosClientesPage({ csEmail }: { csEmail?: string }) {
  const { data: clientesData, loading: l1 } = useDashboardBI<NovoCliente[]>('novos_clientes', csEmail);
  const { data: timelineDia } = useDashboardBI<NovosTimeline[]>('novos_por_dia', csEmail);
  const { data: timelineSemana } = useDashboardBI<NovosTimeline[]>('novos_por_semana', csEmail);
  const { data: timelineMes } = useDashboardBI<NovosTimeline[]>('novos_por_mes', csEmail);
  const { data: porPlanoData } = useDashboardBI<NovosPorPlano[]>('novos_por_plano', csEmail);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [sortKey, setSortKey] = useState<'nome' | 'receita' | 'data_ativacao'>('data_ativacao');
  const [sortAsc, setSortAsc] = useState(false);

  if (l1) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const clientes = Array.isArray(clientesData) ? clientesData : [];
  const totalNovos = clientes.length;
  const totalReceita = clientes.reduce((s, c) => s + (c.receita || 0), 0);

  const timelineData = viewMode === 'dia' ? (timelineDia || []) :
    viewMode === 'semana' ? (timelineSemana || []) : (timelineMes || []);

  const planoData = (porPlanoData || []).map((p, i) => ({ ...p, fill: PIE_COLORS[i % PIE_COLORS.length] }));
  const planosDistintos = planoData.length;

  const filtered = clientes.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.nome || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.plano || '').toLowerCase().includes(q);
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
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Novos Clientes <InfoTip text="Clientes com data_criacao nos últimos 15 dias. Contagem distinta por id_curseduca." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-foreground">{formatNumber(totalNovos)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                MRR Novos <InfoTip text="Soma de valor_contratado com is_plano=TRUE e vigencia_assinatura='Ativa' dos novos clientes (15 dias)." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-foreground">{formatBRL(totalReceita)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Planos Distintos <InfoTip text="Quantidade de tipo_plano distintos entre os novos clientes (is_plano=TRUE)." />
              </p>
              <p className="text-2xl font-extrabold tracking-tight text-foreground">{planosDistintos}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Layers className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">Novos Clientes — Quantidade e MRR <InfoTip text="Barras = quantidade de novos clientes. Eixo direito = MRR (is_plano + vigencia Ativa). Filtro: últimos 15 dias." /></CardTitle>
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
                <RechartsTooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : formatNumber(v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="total" name="Qtd Novos" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="receita" name="MRR Novos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados no período</p>}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By tipo_plano pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Novos por Tipo de Plano <InfoTip text="Distribuição por tipo_plano (is_plano=TRUE) dos novos clientes. Contagem distinta de id_curseduca por tipo." /></CardTitle></CardHeader>
          <CardContent>
            {planoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={planoData} dataKey="total" nameKey="plano" cx="50%" cy="50%" outerRadius={100}
                    label={({ plano, percent }) => `${plano} ${(percent * 100).toFixed(0)}%`}>
                    {planoData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number, name: string, props: any) => [formatNumber(v), props.payload.plano]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        {/* Client table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold">Lista de Novos ({filtered.length}) <InfoTip text="Novos clientes (15 dias). Colunas: nome, email, plano, MRR (vigência ativa), data de ativação." /></CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar nome ou email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 max-w-xs h-8 text-sm" />
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
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{c.nome || '—'}</span>
                        {c.email && <p className="text-[11px] text-muted-foreground">{c.email}</p>}
                      </div>
                    </TableCell>
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
