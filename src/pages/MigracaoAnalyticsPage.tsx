import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2,
  FileText, ArrowLeft, Filter,
} from 'lucide-react';
import { format, differenceInDays, differenceInHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';

const PLATFORM_OPTIONS = [
  'Todas', 'Hotmart', 'Academi', 'Kiwify', 'Memberkit', 'Greenn',
  'The Members', 'Eduzz', 'Alpha Class', 'Outros',
];

const STATUS_LABELS: Record<string, string> = {
  waiting_form: 'Aguardando Formulário',
  analysis: 'Análise Inicial',
  rejected: 'Invalidado',
  extraction: 'Extração de Dados',
  in_progress: 'Em Andamento',
  completed: 'Concluído',
};

const STATUS_COLORS: Record<string, string> = {
  waiting_form: '#94a3b8',
  analysis: '#f59e0b',
  rejected: '#ef4444',
  extraction: '#3b82f6',
  in_progress: '#8b5cf6',
  completed: '#10b981',
};

export default function MigracaoAnalyticsPage() {
  const navigate = useNavigate();
  const [platformFilter, setPlatformFilter] = useState('Todas');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['migration-analytics-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('migration_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: statusHistory = [] } = useQuery({
    queryKey: ['migration-status-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('migration_status_history')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return projects.filter((p: any) => {
      if (platformFilter !== 'Todas' && p.platform_origin !== platformFilter) return false;
      if (dateFrom && p.created_at < dateFrom) return false;
      if (dateTo) {
        const toEnd = dateTo + 'T23:59:59';
        if (p.created_at > toEnd) return false;
      }
      return true;
    });
  }, [projects, platformFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const p of filtered) {
      const s = p.migration_status || 'waiting_form';
      byStatus[s] = (byStatus[s] || 0) + 1;
    }

    const openStatuses = ['waiting_form', 'analysis', 'extraction', 'in_progress'];
    const open = openStatuses.reduce((sum, s) => sum + (byStatus[s] || 0), 0);

    return {
      total: filtered.length,
      open,
      rejected: byStatus['rejected'] || 0,
      inProgress: byStatus['in_progress'] || 0,
      extraction: byStatus['extraction'] || 0,
      completed: byStatus['completed'] || 0,
      analysis: byStatus['analysis'] || 0,
      byStatus,
    };
  }, [filtered]);

  // Calculate average time per phase
  const phaseTimings = useMemo(() => {
    const filteredIds = new Set(filtered.map((p: any) => p.id));
    const projectHistories: Record<string, any[]> = {};

    for (const h of statusHistory) {
      if (!filteredIds.has(h.project_id)) continue;
      if (!projectHistories[h.project_id]) projectHistories[h.project_id] = [];
      projectHistories[h.project_id].push(h);
    }

    const phaseDurations: Record<string, number[]> = {};

    for (const [, history] of Object.entries(projectHistories)) {
      const sorted = history.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      for (let i = 0; i < sorted.length - 1; i++) {
        const phase = sorted[i].to_status;
        const start = new Date(sorted[i].created_at);
        const end = new Date(sorted[i + 1].created_at);
        const hours = differenceInHours(end, start);
        if (hours >= 0 && hours < 10000) {
          if (!phaseDurations[phase]) phaseDurations[phase] = [];
          phaseDurations[phase].push(hours);
        }
      }
    }

    return Object.entries(phaseDurations).map(([phase, durations]) => {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const days = Math.floor(avg / 24);
      const hours = Math.round(avg % 24);
      return {
        phase,
        label: STATUS_LABELS[phase] || phase,
        avgHours: Math.round(avg),
        display: days > 0 ? `${days}d ${hours}h` : `${hours}h`,
        count: durations.length,
      };
    }).sort((a, b) => {
      const order = ['analysis', 'rejected', 'extraction', 'in_progress', 'completed'];
      return order.indexOf(a.phase) - order.indexOf(b.phase);
    });
  }, [filtered, statusHistory]);

  const statusChartData = useMemo(() => {
    return Object.entries(stats.byStatus).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8',
    }));
  }, [stats]);

  // Platform distribution
  const platformChartData = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    for (const p of filtered) {
      const pl = p.platform_origin || 'Outros';
      byPlatform[pl] = (byPlatform[pl] || 0) + 1;
    }
    return Object.entries(byPlatform)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const kpis = [
    { label: 'Em Aberto', value: stats.open, icon: FileText, color: 'text-amber-500', bg: 'from-amber-500/10 to-amber-500/5' },
    { label: 'Invalidadas', value: stats.rejected, icon: XCircle, color: 'text-red-500', bg: 'from-red-500/10 to-red-500/5' },
    { label: 'Em Andamento', value: stats.inProgress + stats.extraction, icon: Clock, color: 'text-blue-500', bg: 'from-blue-500/10 to-blue-500/5' },
    { label: 'Concluídas', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-emerald-500/5' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/hub/migracao')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Analytics de Migrações
            </h1>
            <p className="text-sm text-muted-foreground">Acompanhe indicadores e tempos por fase</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filtros</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Plataforma de origem</Label>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 h-9" />
            </div>
            {(platformFilter !== 'Todas' || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setPlatformFilter('Todas'); setDateFrom(''); setDateTo(''); }}>
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`p-4 rounded-xl bg-gradient-to-br ${kpi.bg} border border-border/30`}>
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color} opacity-70`} />
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
            <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Status distribution */}
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Status</h3>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {statusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>

        {/* Platform distribution */}
        <Card>
          <CardContent className="pt-5 pb-4 px-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição por Plataforma</h3>
            {platformChartData.length > 0 ? (
              <div className="space-y-2">
                {platformChartData.map(p => {
                  const pct = stats.total > 0 ? Math.round((p.value / stats.total) * 100) : 0;
                  return (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="text-sm text-foreground w-28 truncate">{p.name}</span>
                      <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground w-10 text-right">{p.value}</span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase timing */}
      <Card>
        <CardContent className="pt-5 pb-4 px-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Tempo Médio por Fase</h3>
          <p className="text-xs text-muted-foreground mb-4">Calculado com base no histórico de movimentações entre status</p>
          {phaseTimings.length > 0 ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
              {phaseTimings.map(pt => (
                <div key={pt.phase} className="p-3 rounded-lg border border-border/30 bg-muted/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[pt.phase] || '#94a3b8' }} />
                    <span className="text-xs font-medium text-foreground">{pt.label}</span>
                  </div>
                  <p className="text-xl font-bold text-foreground">{pt.display}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{pt.count} transição(ões)</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sem dados de transição entre fases ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Os tempos serão calculados conforme os projetos avançam pelas etapas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total summary */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        Total de {stats.total} projeto{stats.total !== 1 ? 's' : ''} de migração
        {platformFilter !== 'Todas' && ` · Plataforma: ${platformFilter}`}
        {dateFrom && ` · De: ${format(parseISO(dateFrom), 'dd/MM/yyyy', { locale: ptBR })}`}
        {dateTo && ` · Até: ${format(parseISO(dateTo), 'dd/MM/yyyy', { locale: ptBR })}`}
      </div>
    </div>
  );
}
