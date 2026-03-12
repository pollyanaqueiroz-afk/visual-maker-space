import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDashboardBI, formatBRL, formatNumber, formatPct, nullDash } from '@/hooks/useDashboardBI';
import { RefreshCw, X, UserX, TableIcon, BarChart3, Search, Loader2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

interface CSItem { cs_nome: string; cs_email: string; total: number; }

interface InactiveClient {
  id_curseduca: string;
  nome: string;
  plano: string;
  receita: number | null;
  contrato_status: string;
  status_financeiro: string | null;
  valor_inadimplente: number | null;
  dias_desde_ultimo_login: number | null;
  membros_mes_atual: number | null;
  variacao_membros: number | null;
  motivo_churn_cs: string | null;
  cs_nome: string | null;
  cs_email: string | null;
  data_cancelamento?: string | null;
  risco_churn: string | null;
}

const extractName = (csNome: string, csEmail: string): string => {
  if (csNome && csNome !== 'CS') return csNome;
  if (!csEmail) return 'Sem CS';
  return csEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const STATUS_COLORS: Record<string, string> = {
  'Cancelado': '#ef4444',
  'Bloqueado': '#f97316',
  'Suspenso': '#eab308',
  'Inativo': '#6b7280',
};

export default function ClientesInativosPage() {
  const [csFilter, setCsFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: csOptions } = useDashboardBI<CSItem[]>('cs');
  const csEmail = csFilter || undefined;

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserX className="h-6 w-6 text-muted-foreground" />
            Clientes Inativos
          </h1>
          <p className="text-sm text-muted-foreground">Clientes cancelados, bloqueados ou inativos financeiramente</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={csFilter} onValueChange={v => setCsFilter(v === '__clear__' ? '' : v)}>
            <SelectTrigger className="w-[220px] h-8 text-sm">
              <SelectValue placeholder="Filtrar por CS..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Todos os CSs</SelectItem>
              {(csOptions || []).filter(c => c.cs_email).map(cs => (
                <SelectItem key={cs.cs_email} value={cs.cs_email}>
                  {extractName(cs.cs_nome, cs.cs_email)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {csFilter && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs cursor-pointer" onClick={() => setCsFilter('')}>
              Filtro: {csFilter.split('@')[0]} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabela" className="w-full">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="tabela" className="text-xs gap-1.5"><TableIcon className="h-3.5 w-3.5" />Tabela</TabsTrigger>
          <TabsTrigger value="graficos" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Gráficos</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela"><InativosTabelaTab csEmail={csEmail} /></TabsContent>
        <TabsContent value="graficos"><InativosGraficosTab csEmail={csEmail} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Tabela Tab ──
function InativosTabelaTab({ csEmail }: { csEmail?: string }) {
  // Uses the cancelados metric which returns cancelled/inactive clients
  const { data, loading } = useDashboardBI<InactiveClient[]>('cancelados', csEmail);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<keyof InactiveClient>('receita');
  const [sortAsc, setSortAsc] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const perPage = 20;

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const clients = Array.isArray(data) ? data : [];

  // KPIs
  const totalCancelados = clients.length;
  const totalReceita = clients.reduce((sum, c) => sum + (c.receita || 0), 0);
  const comMotivo = clients.filter(c => c.motivo_churn_cs).length;
  const semCS = clients.filter(c => !c.cs_nome && !c.cs_email).length;

  const filtered = clients.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.nome || '').toLowerCase().includes(q) ||
      (r.id_curseduca || '').toLowerCase().includes(q) ||
      (r.plano || '').toLowerCase().includes(q);
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey] ?? '', vb = b[sortKey] ?? '';
    if (va === '' && vb === '') return 0;
    if (va === '') return 1;
    if (vb === '') return -1;
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paged = sorted.slice(page * perPage, (page + 1) * perPage);

  const toggleSort = (key: keyof InactiveClient) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const SortIcon = ({ col }: { col: keyof InactiveClient }) => sortKey === col ? (sortAsc ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatNumber(totalCancelados)}</p>
            <span className="text-xs text-muted-foreground">Total Inativos</span>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatBRL(totalReceita)}</p>
            <span className="text-xs text-muted-foreground">Receita Perdida</span>
          </CardContent>
        </Card>
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatNumber(comMotivo)}</p>
            <span className="text-xs text-muted-foreground">Com Motivo Registrado</span>
          </CardContent>
        </Card>
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatNumber(semCS)}</p>
            <span className="text-xs text-muted-foreground">Sem CS Atribuído</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-sm">Clientes Inativos ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowExtra(!showExtra)}>
              {showExtra ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
              {showExtra ? 'Menos colunas' : 'Mais colunas'}
            </Button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-8 max-w-xs h-8 text-sm" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('nome')}>Cliente<SortIcon col="nome" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('plano')}>Plano<SortIcon col="plano" /></TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort('receita')}>Receita<SortIcon col="receita" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('contrato_status')}>Status<SortIcon col="contrato_status" /></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('motivo_churn_cs')}>Motivo<SortIcon col="motivo_churn_cs" /></TableHead>
                <TableHead>Último CS</TableHead>
                {showExtra && (
                  <>
                    <TableHead>Status Financeiro</TableHead>
                    <TableHead className="text-right">Vlr Inadimpl.</TableHead>
                    <TableHead className="text-right">Dias s/ Login</TableHead>
                    <TableHead className="text-right">Membros</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r, i) => (
                <TableRow key={i} className="opacity-80">
                  <TableCell className="font-medium text-sm max-w-[200px] truncate">{r.nome || r.id_curseduca}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.plano || '—'}</Badge></TableCell>
                  <TableCell className="text-right">{formatBRL(r.receita)}</TableCell>
                  <TableCell>
                    <Badge variant="destructive" className="text-[10px]">{r.contrato_status || 'Cancelado'}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{r.motivo_churn_cs || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground line-through">{nullDash(r.cs_nome)}</TableCell>
                  {showExtra && (
                    <>
                      <TableCell className="text-xs">{r.status_financeiro || '—'}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.valor_inadimplente)}</TableCell>
                      <TableCell className="text-right">{r.dias_desde_ultimo_login ?? '—'}</TableCell>
                      <TableCell className="text-right">{r.membros_mes_atual != null ? formatNumber(r.membros_mes_atual) : '—'}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-muted-foreground">
              <span>Página {page + 1} de {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Anterior</button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-muted">Próxima</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Gráficos Tab ──
function InativosGraficosTab({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<InactiveClient[]>('cancelados', csEmail);

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const clients = Array.isArray(data) ? data : [];
  if (clients.length === 0) return <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum cliente inativo encontrado.</CardContent></Card>;

  // By plan
  const planCounts: Record<string, number> = {};
  clients.forEach(c => {
    const plan = c.plano || 'Sem plano';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });
  const planData = Object.entries(planCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  // By motivo
  const motivoCounts: Record<string, { count: number; receita: number }> = {};
  clients.forEach(c => {
    const motivo = c.motivo_churn_cs || 'Sem motivo';
    if (!motivoCounts[motivo]) motivoCounts[motivo] = { count: 0, receita: 0 };
    motivoCounts[motivo].count += 1;
    motivoCounts[motivo].receita += c.receita || 0;
  });
  const motivoData = Object.entries(motivoCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([motivo, { count, receita }]) => ({ motivo, count, receita }));

  // By CS
  const csCounts: Record<string, number> = {};
  clients.forEach(c => {
    const cs = c.cs_nome || c.cs_email || 'Sem CS';
    csCounts[cs] = (csCounts[cs] || 0) + 1;
  });
  const csData = Object.entries(csCounts).sort((a, b) => b[1] - a[1]).map(([cs, count]) => ({ cs, count }));

  const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatNumber(clients.length)}</p>
            <span className="text-xs text-muted-foreground">Total Inativos</span>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{formatBRL(clients.reduce((s, c) => s + (c.receita || 0), 0))}</p>
            <span className="text-xs text-muted-foreground">Receita Perdida Total</span>
          </CardContent>
        </Card>
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{planData.length}</p>
            <span className="text-xs text-muted-foreground">Planos Afetados</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By plan pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Inativos por Plano</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {planData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By motivo bar */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Motivos de Cancelamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(motivoData.length * 35, 150)}>
              <BarChart data={motivoData.slice(0, 15)} layout="vertical" margin={{ left: 120, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : formatNumber(v)} />
                <Bar dataKey="count" name="Clientes" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* By CS */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Cancelamentos por Último CS ({csData.length})</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(csData.length * 30, 150)}>
            <BarChart data={csData.slice(0, 20)} layout="vertical" margin={{ left: 120, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="cs" tick={{ fontSize: 10 }} width={110} />
              <Tooltip />
              <Bar dataKey="count" name="Clientes" fill="#6b7280" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
