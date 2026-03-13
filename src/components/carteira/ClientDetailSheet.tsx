import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User, Mail, Globe, DollarSign, Calendar, Activity, HardDrive,
  Cpu, Award, ShoppingCart, BookOpen, Clock, TrendingUp, ExternalLink, TicketCheck, FolderKanban,
} from 'lucide-react';
import ClientTicketsTab from './ClientTicketsTab';
import ClientProjectsTab from './ClientProjectsTab';

interface Props {
  idCurseduca: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  fields: { label: string; key: string; format?: 'gb' | 'currency' | 'link' | 'date' | 'number' | 'percent' }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Identificação',
    icon: <User className="h-4 w-4" />,
    fields: [
      { label: 'Nome', key: 'cliente_nome' },
      { label: 'Email', key: 'cliente_email' },
      { label: 'ID Curseduca', key: 'id_curseduca' },
      { label: 'URL da Plataforma', key: 'url_plataforma', format: 'link' },
    ],
  },
  {
    title: 'Contrato & CS',
    icon: <DollarSign className="h-4 w-4" />,
    fields: [
      { label: 'Status da Assinatura', key: 'status_financeiro' },
      { label: 'Status Inadimplência', key: 'status_financeiro_inadimplencia' },
      { label: 'Status Curseduca', key: 'status_curseduca' },
      { label: 'Fatura Total', key: 'fatura_total', format: 'currency' },
      { label: 'Plano Contratado', key: 'plano_base_consolidada' },
      { label: 'Plano Detalhado', key: 'plano_nome_formatado' },
      { label: 'CS Atual', key: 'cs_atual' },
      { label: 'Email CS Atual', key: 'cs_email_atual' },
      { label: 'CS Original (Base)', key: 'cs_nome' },
      { label: 'Email CS Original', key: 'cs_email' },
      { label: 'Etapa do CS', key: 'etapa_do_cs' },
      { label: 'Origem', key: 'origem' },
    ],
  },
  {
    title: 'Produtos / Uso',
    icon: <HardDrive className="h-4 w-4" />,
    fields: [
      { label: 'Plataforma', key: 'plataforma_nome' },
      { label: 'Métricas Geradas em', key: 'metricas_gerado_em' },
      { label: 'Métricas Processadas em', key: 'metricas_processado_em' },
      { label: 'Banda Contratada', key: 'player_banda_contratada_gb', format: 'gb' },
      { label: 'Banda Utilizada', key: 'player_banda_utilizada_gb', format: 'gb' },
      { label: 'Armazenamento Contratado', key: 'player_armazenamento_contratado_gb', format: 'gb' },
      { label: 'Armazenamento Utilizado', key: 'player_armazenamento_utilizado_gb', format: 'gb' },
    ],
  },
  {
    title: 'IA & Certificados',
    icon: <Cpu className="h-4 w-4" />,
    fields: [
      { label: 'Tokens IA Contratados', key: 'ia_tokens_contratados', format: 'number' },
      { label: 'Tokens IA Utilizados', key: 'ia_tokens_utilizados', format: 'number' },
      { label: 'Certificados MEC Contratados', key: 'certificados_mec_contratados', format: 'number' },
      { label: 'Certificados MEC Utilizados', key: 'certificados_mec_utilizados', format: 'number' },
    ],
  },
  {
    title: 'Leadtime — Compras',
    icon: <ShoppingCart className="h-4 w-4" />,
    fields: [
      { label: '1ª Compra', key: 'compras_data_primeira' },
      { label: '10ª Compra', key: 'compras_data_decima' },
      { label: '50ª Compra', key: 'compras_data_quinquagesima' },
      { label: '100ª Compra', key: 'compras_data_centesima' },
      { label: '200ª Compra', key: 'compras_data_ducentesima' },
    ],
  },
  {
    title: 'Leadtime — Conteúdos',
    icon: <BookOpen className="h-4 w-4" />,
    fields: [
      { label: '1º Finalizado', key: 'conteudos_data_primeiro_finalizado' },
      { label: '10º Finalizado', key: 'conteudos_data_decimo_finalizado' },
      { label: '50º Finalizado', key: 'conteudos_data_quinquagesimo_finalizado' },
      { label: '100º Finalizado', key: 'conteudos_data_centesimo_finalizado' },
      { label: '200º Finalizado', key: 'conteudos_data_ducentesimo_finalizado' },
    ],
  },
  {
    title: 'HubSpot',
    icon: <Calendar className="h-4 w-4" />,
    fields: [
      { label: 'Data do Contrato', key: 'hubspot_data_contrato' },
      { label: 'Métrica de Sucesso', key: 'hubspot_metrica_sucesso_cliente' },
      { label: 'Desconto Concedido', key: 'hubspot_desconto_concedido' },
      { label: 'Processado em', key: 'hubspot_processado_em' },
    ],
  },
  {
    title: 'Engajamento',
    icon: <TrendingUp className="h-4 w-4" />,
    fields: [
      { label: 'Último Login', key: 'data_ultimo_login' },
      { label: 'Dias Desde Último Login', key: 'dias_desde_ultimo_login', format: 'number' },
      { label: 'Tempo Médio de Uso (min)', key: 'tempo_medio_uso_web_minutos', format: 'number' },
      { label: 'Nº de Alunos', key: 'numero_alunos', format: 'number' },
      { label: 'Variação vs Mês Anterior', key: 'variacao_vs_mes_anterior', format: 'percent' },
      { label: 'Média Móvel 2 Meses', key: 'mm_2_meses', format: 'number' },
      { label: 'Média Móvel 3 Meses', key: 'mm_3_meses', format: 'number' },
    ],
  },
];

function formatGb(value: number | null | undefined): string {
  if (value == null) return '—';
  const n = Number(value);
  if (isNaN(n)) return String(value);
  if (n === 0) return '0 GB';
  if (n >= 1024) return `${(n / 1024).toFixed(2)} TB`;
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} GB`;
}

function formatNumber(value: any): string {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatValue(value: any, format?: string, key?: string): React.ReactNode {
  if (key === 'status_financeiro') {
    if (value === 'ATIVA') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Ativa</Badge>;
    if (value === 'INATIVA') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">Inativa</Badge>;
    return <span className="text-muted-foreground">—</span>;
  }
  if (key === 'status_curseduca') {
    if (!value) return <span className="text-muted-foreground">—</span>;
    const colorMap: Record<string, string> = {
      'Ativo': 'bg-emerald-100 text-emerald-700',
      'Risco por Engajamento': 'bg-amber-100 text-amber-700',
      'Implantacao': 'bg-blue-100 text-blue-700',
    };
    const cls = colorMap[value] || 'bg-gray-100 text-gray-700';
    return <Badge className={`${cls} border-0`}>{value}</Badge>;
  }
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  if (format === 'gb') return formatGb(value);
  if (format === 'number') return formatNumber(value);
  if (format === 'percent') {
    const n = Number(value);
    if (!isNaN(n)) return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  }
  if (format === 'currency') {
    const n = Number(value);
    if (!isNaN(n)) return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }
  if (format === 'link') {
    return (
      <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
        {String(value).replace(/^https?:\/\//, '')}
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }
  return String(value);
}

function statusColor(status: string | null): string {
  if (!status) return 'secondary';
  const s = status.toLowerCase();
  if (s.includes('adimplente') && !s.includes('inadimplente')) return 'default';
  if (s.includes('inadimplente')) return 'destructive';
  return 'secondary';
}

export default function ClientDetailSheet({ idCurseduca, open, onOpenChange }: Props) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !idCurseduca) { setData(null); return; }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/fetch-hub-summary?endpoint=clientes&id_curseduca=${encodeURIComponent(idCurseduca)}`,
          { headers: { Authorization: `Bearer ${supabaseKey}`, apikey: supabaseKey } },
        );
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) setData(json.data?.[0] || null);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, idCurseduca]);

  // Filter sections to only show those with at least one populated field
  const visibleSections = data
    ? SECTIONS.filter(section => {
        if (section.title === 'Identificação') return true;
        return section.fields.some(f => {
          const v = data[f.key];
          return v != null && v !== '';
        });
      })
    : SECTIONS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-lg">
            {loading ? 'Carregando...' : data?.cliente_nome || 'Detalhes do Cliente'}
          </SheetTitle>
          {data && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {data.status_financeiro === 'ATIVA' && (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">Ativa</Badge>
              )}
              {data.status_financeiro === 'INATIVA' && (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">Inativa</Badge>
              )}
              {data.status_curseduca && (
                <Badge className={`border-0 ${
                  data.status_curseduca === 'Ativo' ? 'bg-emerald-100 text-emerald-700' :
                  data.status_curseduca === 'Risco por Engajamento' ? 'bg-amber-100 text-amber-700' :
                  data.status_curseduca === 'Implantacao' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{data.status_curseduca}</Badge>
              )}
              {data.status_financeiro_inadimplencia && (
                <Badge variant={data.status_financeiro_inadimplencia === 'Inadimplente' ? 'destructive' : 'default'}>
                  {data.status_financeiro_inadimplencia}
                </Badge>
              )}
              {data.plano_base_consolidada && (
                <Badge variant="outline">{data.plano_base_consolidada}</Badge>
              )}
              {data.etapa_do_cs && (
                <Badge variant="secondary">{data.etapa_do_cs}</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-2 shrink-0">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-1 text-xs"><User className="h-3 w-3" /> Informações</TabsTrigger>
              <TabsTrigger value="tickets" className="flex-1 gap-1 text-xs"><TicketCheck className="h-3 w-3" /> Tickets</TabsTrigger>
              <TabsTrigger value="projects" className="flex-1 gap-1 text-xs"><FolderKanban className="h-3 w-3" /> Projetos</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="info" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4 space-y-6">
                {loading && (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-3/4" />
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive text-center py-8">Erro: {error}</p>
                )}

                {!loading && !error && !data && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado encontrado</p>
                )}

                {!loading && data && visibleSections.map((section, idx) => {
                  const isMain = section.title === 'Identificação';
                  const fieldsToShow = isMain
                    ? section.fields
                    : section.fields.filter(f => data[f.key] != null && data[f.key] !== '');

                  return (
                    <div key={idx}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-primary">{section.icon}</span>
                        <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 ml-6">
                        {fieldsToShow.map(f => (
                          <div key={f.key} className="space-y-0.5">
                            <span className="text-[11px] text-muted-foreground">{f.label}</span>
                            <p className="text-sm text-foreground break-words">
                              {formatValue(data[f.key], f.format, f.key)}
                            </p>
                          </div>
                        ))}
                      </div>
                      {idx < visibleSections.length - 1 && <Separator className="mt-4" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tickets" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                <ClientTicketsTab clientName={data?.cliente_nome || idCurseduca || ''} clientId={idCurseduca || undefined} />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
