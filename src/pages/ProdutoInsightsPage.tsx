import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Lightbulb, Bug, DollarSign, TrendingUp, Flame, BookOpen,
  ChevronRight, RefreshCw, CheckCircle2, BarChart3, Users, AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Mock data generator for product insights (will be replaced by real Jira aggregation)
function generateMockInsights() {
  const insights = [
    { id: '1', title: 'Dificuldade na configuração de certificados', tickets: 15, trend: '+40%', severity: 'high', component: 'Certificados', mrr_impact: 28500, suggested_action: 'improvement', clients: ['Escola Alpha', 'UniCorp', 'AcademiaPro', 'TechLearn'] },
    { id: '2', title: 'Player de vídeo travando em iOS 17', tickets: 12, trend: '+25%', severity: 'critical', component: 'Player de Vídeo', mrr_impact: 42000, suggested_action: 'bug_fix', clients: ['MegaCursos', 'EduStream', 'PlayLearn'] },
    { id: '3', title: 'Lentidão na exportação de relatórios', tickets: 9, trend: '+15%', severity: 'medium', component: 'Relatórios', mrr_impact: 18000, suggested_action: 'improvement', clients: ['DataEdu', 'ReportPro'] },
    { id: '4', title: 'Erro no cálculo de progresso de trilhas compostas', tickets: 8, trend: '+60%', severity: 'high', component: 'Trilhas', mrr_impact: 35000, suggested_action: 'bug_fix', clients: ['TrailMaster', 'CursoPro', 'EduPath'] },
    { id: '5', title: 'Integração com Google Analytics 4 falhando', tickets: 7, trend: '-10%', severity: 'medium', component: 'Integrações', mrr_impact: 12000, suggested_action: 'bug_fix', clients: ['AnalyticsEdu'] },
    { id: '6', title: 'Solicitação de dark mode no painel admin', tickets: 6, trend: '+100%', severity: 'low', component: 'UI/UX', mrr_impact: 55000, suggested_action: 'feature', clients: ['ModernEdu', 'DarkLearn', 'NightSchool', 'TechEdu', 'ProLearn'] },
    { id: '7', title: 'Problemas com notificações push Android', tickets: 5, trend: '0%', severity: 'high', component: 'Mobile', mrr_impact: 22000, suggested_action: 'bug_fix', clients: ['AppEdu', 'MobileLearn'] },
    { id: '8', title: 'SCORM 2004 4th Edition não suportado', tickets: 4, trend: '+33%', severity: 'medium', component: 'SCORM', mrr_impact: 31000, suggested_action: 'feature', clients: ['ScormPro', 'ComplianceEdu', 'GovLearn'] },
  ];

  const componentChart = [
    { name: 'Certificados', count: 15, fill: 'hsl(var(--primary))' },
    { name: 'Player', count: 12, fill: 'hsl(var(--destructive))' },
    { name: 'Relatórios', count: 9, fill: 'hsl(var(--chart-3))' },
    { name: 'Trilhas', count: 8, fill: 'hsl(var(--chart-4))' },
    { name: 'Integrações', count: 7, fill: 'hsl(var(--chart-5))' },
    { name: 'UI/UX', count: 6, fill: 'hsl(var(--chart-1))' },
    { name: 'Mobile', count: 5, fill: 'hsl(var(--chart-2))' },
    { name: 'SCORM', count: 4, fill: 'hsl(var(--chart-3))' },
  ];

  return {
    kpis: {
      total_suggestions: 14,
      critical_bugs: 3,
      mrr_at_risk: 243500,
      tickets_this_week: 28,
    },
    insights,
    componentChart,
    prioritized: [...insights].sort((a, b) => b.mrr_impact - a.mrr_impact),
  };
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const ACTION_LABELS: Record<string, { label: string; icon: typeof Bug }> = {
  bug_fix: { label: 'Correção de Bug', icon: Bug },
  improvement: { label: 'Melhoria', icon: TrendingUp },
  feature: { label: 'Nova Feature', icon: Lightbulb },
};

export default function ProdutoInsightsPage() {
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['produto-insights'],
    queryFn: async () => {
      // In production, this would aggregate from Jira via the edge function
      return generateMockInsights();
    },
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const { kpis, insights, componentChart, prioritized } = data!;

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Produto — Insights & Melhorias</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise automatizada de tickets para identificar padrões e priorizar melhorias</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          Sincronizado com Jira
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Lightbulb className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-[10px]">IA</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{kpis.total_suggestions}</p>
            <p className="text-xs text-muted-foreground">Sugestões de Melhoria</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Bug className="h-5 w-5 text-destructive" />
              <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Urgente</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{kpis.critical_bugs}</p>
            <p className="text-xs text-muted-foreground">Bugs Críticos em Aberto</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <DollarSign className="h-5 w-5 text-amber-500" />
              <Flame className="h-4 w-4 text-orange-400" />
            </div>
            <p className="text-2xl font-bold mt-2">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis.mrr_at_risk)}
            </p>
            <p className="text-xs text-muted-foreground">MRR em Risco</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <BarChart3 className="h-5 w-5 text-chart-1" />
            </div>
            <p className="text-2xl font-bold mt-2">{kpis.tickets_this_week}</p>
            <p className="text-xs text-muted-foreground">Tickets esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="insights" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Insights por IA</TabsTrigger>
          <TabsTrigger value="priority" className="gap-1"><DollarSign className="h-3.5 w-3.5" /> Priorização por Impacto</TabsTrigger>
          <TabsTrigger value="components" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Por Componente</TabsTrigger>
        </TabsList>

        {/* AI Insights Tab */}
        <TabsContent value="insights" className="space-y-3">
          {insights.map(insight => {
            const ActionInfo = ACTION_LABELS[insight.suggested_action] || ACTION_LABELS.improvement;
            const ActionIcon = ActionInfo.icon;
            const isSelected = selectedInsight === insight.id;

            return (
              <Card
                key={insight.id}
                className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary/30' : ''}`}
                onClick={() => setSelectedInsight(isSelected ? null : insight.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <ActionIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold">Insight: {insight.title}</h4>
                        <Badge className={`text-[10px] border-0 ${SEVERITY_BADGE[insight.severity]}`}>
                          {insight.severity === 'critical' ? 'Crítico' : insight.severity === 'high' ? 'Alto' : insight.severity === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        <span className="font-medium text-foreground">{insight.tickets} tickets</span> abertos sobre esse tema
                        {insight.trend !== '0%' && (
                          <span className={`ml-1 ${insight.trend.startsWith('+') ? 'text-red-500' : 'text-emerald-500'}`}>({insight.trend} vs semana anterior)</span>
                        )}
                      </p>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-muted-foreground">Componente: <span className="font-medium text-foreground">{insight.component}</span></span>
                        <span className="text-muted-foreground">MRR impactado: <span className="font-medium text-amber-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(insight.mrr_impact)}
                        </span></span>
                        <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" />{insight.clients.length} clientes</span>
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <p className="text-xs text-muted-foreground">Clientes afetados:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {insight.clients.map(c => (
                              <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" className="h-7 text-xs gap-1">
                              <Lightbulb className="h-3 w-3" /> Sugerir Melhoria ao Produto
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <BookOpen className="h-3 w-3" /> Criar Artigo na Base de Conhecimento
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Priority Tab */}
        <TabsContent value="priority" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Priorização Inteligente por Impacto Financeiro</CardTitle>
              <p className="text-xs text-muted-foreground">Ranking baseado no cruzamento entre volume de tickets e LTV/Plano dos clientes impactados</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {prioritized.map((item, idx) => {
                const maxMrr = prioritized[0].mrr_impact;
                const pct = (item.mrr_impact / maxMrr) * 100;
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6 text-right">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{item.title}</span>
                        <span className="text-xs font-bold text-amber-600 whitespace-nowrap ml-2">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(item.mrr_impact)}
                        </span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{item.tickets} tickets</span>
                        <span>{item.clients.length} clientes</span>
                        <Badge className={`text-[9px] px-1 py-0 border-0 ${SEVERITY_BADGE[item.severity]}`}>
                          {item.severity}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição de Tickets por Componente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={componentChart} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number) => [`${value} tickets`, 'Quantidade']}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {componentChart.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
