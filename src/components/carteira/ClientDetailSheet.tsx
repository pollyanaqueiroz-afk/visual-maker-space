import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, Mail, Globe, DollarSign, Calendar, Activity, HardDrive,
  Cpu, Award, ShoppingCart, BookOpen, Clock, TrendingUp, ExternalLink,
} from 'lucide-react';

interface Props {
  idCurseduca: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Section {
  title: string;
  icon: React.ReactNode;
  fields: { label: string; key: string; format?: 'bytes' | 'currency' | 'link' | 'date' }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Dados do Cliente',
    icon: <User className="h-4 w-4" />,
    fields: [
      { label: 'Nome', key: 'cliente_nome' },
      { label: 'Email', key: 'cliente_email' },
      { label: 'ID Curseduca', key: 'id_curseduca' },
      { label: 'URL da Plataforma', key: 'url_plataforma', format: 'link' },
      { label: 'Nome da Plataforma', key: 'plataforma_nome' },
      { label: 'Status Financeiro', key: 'status_financeiro' },
      { label: 'Valor da Fatura', key: 'fatura_total', format: 'currency' },
      { label: 'Plano Base', key: 'plano_base_consolidada' },
      { label: 'Plano Formatado', key: 'plano_nome_formatado' },
      { label: 'Origem', key: 'origem' },
    ],
  },
  {
    title: 'Customer Success',
    icon: <Activity className="h-4 w-4" />,
    fields: [
      { label: 'CS Responsável', key: 'cs_nome' },
      { label: 'Email CS', key: 'cs_email' },
      { label: 'Etapa do CS', key: 'etapa_do_cs' },
    ],
  },
  {
    title: 'Engajamento',
    icon: <TrendingUp className="h-4 w-4" />,
    fields: [
      { label: 'Último Login', key: 'data_ultimo_login', format: 'date' },
      { label: 'Dias Desde Último Login', key: 'dias_desde_ultimo_login' },
      { label: 'Tempo Médio de Uso (min)', key: 'tempo_medio_uso_web_minutos' },
      { label: 'Membros Mês Atual', key: 'membros_mes_atual' },
      { label: 'Variação Membros (M0 vs M1)', key: 'variacao_m0_vs_m1' },
    ],
  },
  {
    title: 'Consumo de Recursos',
    icon: <HardDrive className="h-4 w-4" />,
    fields: [
      { label: 'Banda Contratada', key: 'player_banda_contratada', format: 'bytes' },
      { label: 'Banda Utilizada', key: 'player_banda_utilizada', format: 'bytes' },
      { label: 'Armazenamento Contratado', key: 'player_armazenamento_contratado', format: 'bytes' },
      { label: 'Armazenamento Utilizado', key: 'player_armazenamento_utilizado', format: 'bytes' },
    ],
  },
  {
    title: 'IA & Certificados',
    icon: <Cpu className="h-4 w-4" />,
    fields: [
      { label: 'Tokens IA Contratados', key: 'ia_tokens_contratados' },
      { label: 'Tokens IA Utilizados', key: 'ia_tokens_utilizados' },
      { label: 'Certificados MEC Contratados', key: 'certificados_mec_contratados' },
      { label: 'Certificados MEC Utilizados', key: 'certificados_mec_utilizados' },
    ],
  },
  {
    title: 'Marcos de Compras',
    icon: <ShoppingCart className="h-4 w-4" />,
    fields: [
      { label: '1ª Compra', key: 'compras_data_primeira', format: 'date' },
      { label: '10ª Compra', key: 'compras_data_decima', format: 'date' },
      { label: '50ª Compra', key: 'compras_data_quinquagesima', format: 'date' },
      { label: '100ª Compra', key: 'compras_data_centesima', format: 'date' },
      { label: '200ª Compra', key: 'compras_data_ducentesima', format: 'date' },
    ],
  },
  {
    title: 'Marcos de Conteúdos',
    icon: <BookOpen className="h-4 w-4" />,
    fields: [
      { label: '1º Conteúdo Finalizado', key: 'conteudos_data_primeiro_finalizado', format: 'date' },
      { label: '10º Conteúdo Finalizado', key: 'conteudos_data_decimo_finalizado', format: 'date' },
      { label: '50º Conteúdo Finalizado', key: 'conteudos_data_quinquagesimo_finalizado', format: 'date' },
      { label: '100º Conteúdo Finalizado', key: 'conteudos_data_centesimo_finalizado', format: 'date' },
      { label: '200º Conteúdo Finalizado', key: 'conteudos_data_ducentesimo_finalizado', format: 'date' },
    ],
  },
  {
    title: 'HubSpot',
    icon: <Calendar className="h-4 w-4" />,
    fields: [
      { label: 'Data do Contrato', key: 'hubspot_data_contrato', format: 'date' },
      { label: 'Métrica de Sucesso', key: 'hubspot_metrica_sucesso_cliente' },
      { label: 'Desconto Concedido', key: 'hubspot_desconto_concedido' },
      { label: 'Processado em', key: 'hubspot_processado_em', format: 'date' },
    ],
  },
  {
    title: 'Métricas',
    icon: <Clock className="h-4 w-4" />,
    fields: [
      { label: 'Métricas Geradas em', key: 'metricas_gerado_em', format: 'date' },
      { label: 'Métricas Processadas em', key: 'metricas_processado_em', format: 'date' },
    ],
  },
];

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  const n = Number(bytes);
  if (isNaN(n)) return String(bytes);
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatValue(value: any, format?: string): React.ReactNode {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  if (format === 'bytes') return formatBytes(value);
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
          `${supabaseUrl}/functions/v1/fetch-visao360?id_curseduca=${encodeURIComponent(idCurseduca)}`,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-lg">
            {loading ? 'Carregando...' : data?.cliente_nome || 'Detalhes do Cliente'}
          </SheetTitle>
          {data && (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={statusColor(data.status_financeiro) as any}>
                {data.status_financeiro || 'N/A'}
              </Badge>
              {data.plano_nome_formatado && (
                <Badge variant="outline">{data.plano_nome_formatado}</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
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

            {!loading && data && SECTIONS.map((section, idx) => {
              const hasData = section.fields.some(f => data[f.key] != null && data[f.key] !== '');
              return (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-primary">{section.icon}</span>
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                  </div>
                  {!hasData ? (
                    <p className="text-xs text-muted-foreground ml-6 mb-2">Sem dados disponíveis</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 ml-6">
                      {section.fields.map(f => (
                        <div key={f.key} className="space-y-0.5">
                          <span className="text-[11px] text-muted-foreground">{f.label}</span>
                          <p className="text-sm text-foreground break-words">
                            {formatValue(data[f.key], f.format)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {idx < SECTIONS.length - 1 && <Separator className="mt-4" />}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
