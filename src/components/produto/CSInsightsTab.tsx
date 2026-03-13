import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb, AlertTriangle, ThumbsUp, ChevronRight, Frown, HelpCircle,
  Video, PenTool, Users, MessageSquareQuote, TrendingDown,
} from 'lucide-react';

const MOCK_CS_INSIGHTS = [
  {
    id: '1',
    title: 'Clientes demoram muito para configurar a gamificação',
    mentions: 12,
    source: 'onboarding',
    sentiment: 'frustrado',
    churn_risk: 'alto',
    feature: 'Gamificação',
    clients: ['EduGame', 'PlayLearn', 'GamifyPro', 'LevelUp', 'QuestEdu'],
    excerpts: [
      { client: 'EduGame', text: '"Já faz 3 semanas e ainda não consegui configurar os badges direito. Tá muito confuso."', sentiment: 'Frustrado' },
      { client: 'PlayLearn', text: '"A documentação da gamificação é muito técnica. Precisei abrir 4 chamados pra entender."', sentiment: 'Confuso' },
    ],
    suggested_actions: ['Propor Redesign de UX', 'Criar Tutorial em Vídeo'],
  },
  {
    id: '2',
    title: 'Relatórios de engajamento não mostram dados úteis',
    mentions: 9,
    source: 'qbr',
    sentiment: 'frustrado',
    churn_risk: 'alto',
    feature: 'Relatórios',
    clients: ['DataEdu', 'MetricLearn', 'AnalyticsSchool'],
    excerpts: [
      { client: 'DataEdu', text: '"Na QBR perguntaram sobre taxa de conclusão por módulo e não consegui gerar isso."', sentiment: 'Frustrado' },
    ],
    suggested_actions: ['Propor Redesign de UX'],
  },
  {
    id: '3',
    title: 'Processo de renovação é manual e demorado',
    mentions: 7,
    source: 'renovação',
    sentiment: 'confuso',
    churn_risk: 'médio',
    feature: 'Billing',
    clients: ['CorpTrain', 'RenewEdu', 'AutoPay'],
    excerpts: [
      { client: 'CorpTrain', text: '"Toda renovação preciso entrar em contato com o suporte. Não tem como automatizar?"', sentiment: 'Confuso' },
    ],
    suggested_actions: ['Criar Tutorial em Vídeo'],
  },
  {
    id: '4',
    title: 'Trilhas de aprendizado são elogiadas como diferencial',
    mentions: 15,
    source: 'onboarding',
    sentiment: 'positivo',
    churn_risk: 'baixo',
    feature: 'Trilhas',
    clients: ['TrailMaster', 'PathLearn', 'SkillTrack', 'LearnPath', 'EduTrail', 'CourseMap'],
    excerpts: [
      { client: 'TrailMaster', text: '"As trilhas são incríveis! É o que nos diferencia de outras plataformas para nossos alunos."', sentiment: 'Positivo' },
    ],
    suggested_actions: [],
  },
  {
    id: '5',
    title: 'Certificados precisam de personalização avançada',
    mentions: 6,
    source: 'qbr',
    sentiment: 'confuso',
    churn_risk: 'médio',
    feature: 'Certificados',
    clients: ['CertPro', 'ComplianceEdu'],
    excerpts: [
      { client: 'CertPro', text: '"Precisamos de certificados com QR code e validação online. Hoje é muito básico."', sentiment: 'Confuso' },
    ],
    suggested_actions: ['Propor Redesign de UX'],
  },
];

const SENTIMENT_ICON: Record<string, typeof Frown> = {
  frustrado: Frown,
  confuso: HelpCircle,
  positivo: ThumbsUp,
};

const SENTIMENT_STYLES: Record<string, string> = {
  frustrado: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  confuso: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  positivo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const CHURN_STYLES: Record<string, string> = {
  alto: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  médio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const SOURCE_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  qbr: 'QBR',
  renovação: 'Renovação',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

export default function CSInsightsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const gargalos = MOCK_CS_INSIGHTS.filter(i => i.sentiment !== 'positivo').length;
  const churnAlto = MOCK_CS_INSIGHTS.filter(i => i.churn_risk === 'alto').length;
  const elogiadas = MOCK_CS_INSIGHTS.filter(i => i.sentiment === 'positivo').length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <Badge variant="secondary" className="text-[10px]">CS</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{gargalos}</p>
            <p className="text-xs text-muted-foreground">Gargalos de Adoção</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold mt-2">{churnAlto}</p>
            <p className="text-xs text-muted-foreground">Risco de Churn por Produto</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Features com risco alto de churn</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <ThumbsUp className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{elogiadas}</p>
            <p className="text-xs text-muted-foreground">Features Mais Elogiadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Insights de Reuniões de CS</h3>
        {MOCK_CS_INSIGHTS.map(insight => {
          const isOpen = expanded === insight.id;
          const SentIcon = SENTIMENT_ICON[insight.sentiment] || HelpCircle;
          return (
            <Card
              key={insight.id}
              className={`cursor-pointer transition-all hover:shadow-md ${isOpen ? 'ring-2 ring-primary/30' : ''}`}
              onClick={() => setExpanded(isOpen ? null : insight.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${insight.sentiment === 'positivo' ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
                    <SentIcon className={`h-4 w-4 ${insight.sentiment === 'positivo' ? 'text-emerald-600' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-sm font-semibold">Insight: {insight.title}</h4>
                      <Badge className={`text-[10px] border-0 ${SENTIMENT_STYLES[insight.sentiment]}`}>
                        {insight.sentiment === 'frustrado' ? 'Frustrado' : insight.sentiment === 'confuso' ? 'Confuso' : 'Positivo'}
                      </Badge>
                      <Badge className={`text-[10px] border-0 ${CHURN_STYLES[insight.churn_risk]}`}>
                        Churn: {insight.churn_risk}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Mencionado em <span className="font-medium text-foreground">{insight.mentions} {SOURCE_LABELS[insight.source] || insight.source}s</span>
                      {' · '}Componente: <span className="font-medium text-foreground">{insight.feature}</span>
                    </p>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" />{insight.clients.length} clientes</span>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Trechos de reuniões:</p>
                        {insight.excerpts.map((e, i) => (
                          <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-md p-2.5">
                            <MessageSquareQuote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-foreground">{e.client}</p>
                                <Badge variant="outline" className="text-[9px]">{e.sentiment}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground italic">{e.text}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <p className="text-[10px] text-muted-foreground">Clientes:</p>
                          <div className="flex flex-wrap gap-1">
                            {insight.clients.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                          </div>
                        </div>
                        {insight.suggested_actions.length > 0 && (
                          <div className="flex gap-2 pt-1">
                            {insight.suggested_actions.includes('Propor Redesign de UX') && (
                              <Button size="sm" className="h-7 text-xs gap-1"><PenTool className="h-3 w-3" /> Propor Redesign de UX</Button>
                            )}
                            {insight.suggested_actions.includes('Criar Tutorial em Vídeo') && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"><Video className="h-3 w-3" /> Criar Tutorial em Vídeo</Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
