import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb, DollarSign, ShieldAlert, ChevronRight, TrendingDown,
  MessageSquareQuote, Plus, Users,
} from 'lucide-react';

const MOCK_VENDAS_INSIGHTS = [
  {
    id: '1',
    title: 'Integração nativa com RD Station',
    mentions: 8,
    lost_revenue: 186000,
    sentiment: 'decisivo',
    leads: ['TechCorp', 'EduMais', 'Acadêmica Digital', 'FutureLearn', 'SkillUp', 'LearnHub', 'EduVita', 'ProSkill'],
    excerpts: [
      { lead: 'TechCorp', text: '"Se tivesse integração com RD Station, a gente fecharia na hora. Nosso time de marketing vive lá."' },
      { lead: 'EduMais', text: '"Precisamos de RD Station nativo, senão vamos ter que usar Zapier e isso adiciona custo."' },
    ],
  },
  {
    id: '2',
    title: 'App white-label com PWA offline',
    mentions: 6,
    lost_revenue: 142000,
    sentiment: 'decisivo',
    leads: ['MobilEdu', 'CampoTech', 'RuralLearn', 'OfflineFirst', 'ConnectEdu', 'AppMaster'],
    excerpts: [
      { lead: 'CampoTech', text: '"Nossos alunos ficam em áreas sem internet. Sem modo offline, não tem como usar."' },
      { lead: 'MobilEdu', text: '"Já perdemos alunos por não conseguirem acessar o conteúdo offline no app."' },
    ],
  },
  {
    id: '3',
    title: 'Suporte a múltiplos idiomas no painel do aluno',
    mentions: 5,
    lost_revenue: 98000,
    sentiment: 'importante',
    leads: ['GlobalEdu', 'LatamLearn', 'WorldClass', 'MultiLang', 'InterEdu'],
    excerpts: [
      { lead: 'GlobalEdu', text: '"Temos alunos em 4 países. Se o painel não for em inglês e espanhol, não funciona."' },
    ],
  },
  {
    id: '4',
    title: 'Relatórios customizáveis com exportação em Excel',
    mentions: 4,
    lost_revenue: 67000,
    sentiment: 'desejável',
    leads: ['DataDriven', 'CorpTrain', 'MetricaEdu', 'ReportPro'],
    excerpts: [
      { lead: 'CorpTrain', text: '"O RH precisa de relatórios específicos. Se não exportar pra Excel, nosso compliance reprova."' },
    ],
  },
  {
    id: '5',
    title: 'SSO com Azure AD / SAML',
    mentions: 3,
    lost_revenue: 210000,
    sentiment: 'decisivo',
    leads: ['EnterpriseCo', 'BigCorp', 'SecureLearn'],
    excerpts: [
      { lead: 'EnterpriseCo', text: '"Sem SSO corporativo, o TI não aprova a compra. É requisito obrigatório pra gente."' },
    ],
  },
];

const SENTIMENT_STYLES: Record<string, string> = {
  decisivo: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  importante: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  desejável: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

export default function VendasInsightsTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalLostRevenue = MOCK_VENDAS_INSIGHTS.reduce((s, i) => s + i.lost_revenue, 0);
  const totalMentions = MOCK_VENDAS_INSIGHTS.reduce((s, i) => s + i.mentions, 0);
  const topObjeccoes = 3;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Lightbulb className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-[10px]">Vendas</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{MOCK_VENDAS_INSIGHTS.length}</p>
            <p className="text-xs text-muted-foreground">Features Mais Pedidas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{totalMentions} menções em reuniões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingDown className="h-5 w-5 text-destructive" />
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{fmt(totalLostRevenue)}</p>
            <p className="text-xs text-muted-foreground">Receita Perdida por Falta de Feature</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{topObjeccoes}</p>
            <p className="text-xs text-muted-foreground">Principais Objeções Técnicas</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">SSO, Offline, Integrações</p>
          </CardContent>
        </Card>
      </div>

      {/* Insights list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Insights de Reuniões de Vendas</h3>
        {MOCK_VENDAS_INSIGHTS.map(insight => {
          const isOpen = expanded === insight.id;
          return (
            <Card
              key={insight.id}
              className={`cursor-pointer transition-all hover:shadow-md ${isOpen ? 'ring-2 ring-primary/30' : ''}`}
              onClick={() => setExpanded(isOpen ? null : insight.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="text-sm font-semibold">Insight: {insight.title}</h4>
                      <Badge className={`text-[10px] border-0 ${SENTIMENT_STYLES[insight.sentiment]}`}>
                        {insight.sentiment === 'decisivo' ? 'Decisivo p/ fechar' : insight.sentiment === 'importante' ? 'Importante' : 'Desejável'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Mencionada em <span className="font-medium text-foreground">{insight.mentions} reuniões perdidas</span>
                    </p>
                    <div className="flex items-center gap-4 text-[11px]">
                      <span className="text-muted-foreground">Receita perdida: <span className="font-medium text-destructive">{fmt(insight.lost_revenue)}</span></span>
                      <span className="text-muted-foreground"><Users className="h-3 w-3 inline mr-0.5" />{insight.leads.length} leads</span>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Trechos de reuniões:</p>
                        {insight.excerpts.map((e, i) => (
                          <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-md p-2.5">
                            <MessageSquareQuote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-foreground">{e.lead}</p>
                              <p className="text-xs text-muted-foreground italic">{e.text}</p>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 pt-1">
                          <p className="text-[10px] text-muted-foreground">Leads:</p>
                          <div className="flex flex-wrap gap-1">
                            {insight.leads.map(l => <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>)}
                          </div>
                        </div>
                        <Button size="sm" className="h-7 text-xs gap-1">
                          <Plus className="h-3 w-3" /> Adicionar ao Roadmap de Produto
                        </Button>
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
