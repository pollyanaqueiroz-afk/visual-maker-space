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
  fields: { label: string; key: string; format?: 'bytes' | 'currency' | 'link' | 'date' | 'number' }[];
}

const SECTIONS: Section[] = [
  {
    title: 'Dados do Cliente',
    icon: <User className="h-4 w-4" />,
    fields: [
      { label: 'Nome', key: 'client_name' },
      { label: 'Email', key: 'email_do_cliente' },
      { label: 'ID Curseduca', key: 'id_curseduca' },
      { label: 'URL da Plataforma', key: 'client_url', format: 'link' },
      { label: 'Nome da Plataforma', key: 'nome_da_plataforma' },
      { label: 'Status Financeiro', key: 'status_financeiro' },
      { label: 'Valor Mensal', key: 'valor_mensal', format: 'currency' },
      { label: 'Plano Contratado', key: 'plano_contratado' },
      { label: 'Plano Detalhado', key: 'plano_detalhado' },
      { label: 'Origem do Dado', key: 'origem_do_dado' },
    ],
  },
  {
    title: 'Customer Success',
    icon: <Activity className="h-4 w-4" />,
    fields: [
      { label: 'CS Responsável', key: 'nome_do_cs_atual' },
      { label: 'Email CS', key: 'email_do_cs_atual' },
      { label: 'Etapa do CS', key: 'etapa_antiga_sensedata' },
    ],
  },
  {
    title: 'Engajamento',
    icon: <TrendingUp className="h-4 w-4" />,
    fields: [
      { label: 'Último Login', key: 'data_do_ultimo_login' },
      { label: 'Dias Desde Último Login', key: 'dias_desde_o_ultimo_login' },
      { label: 'Tempo Médio de Uso (min)', key: 'tempo_medio_de_uso_em_min' },
      { label: 'Membros Mês Atual', key: 'membros_do_mes_atual' },
      { label: 'Variação Membros', key: 'variacao_de_quantidade_de_membros_por_mes' },
    ],
  },
  {
    title: 'Consumo de Recursos',
    icon: <HardDrive className="h-4 w-4" />,
    fields: [
      { label: 'Banda Contratada', key: 'banda_contratada', format: 'bytes' },
      { label: 'Banda Utilizada', key: 'banda_utilizada', format: 'bytes' },
      { label: 'Armazenamento Contratado', key: 'armazenamento_contratado', format: 'bytes' },
      { label: 'Armazenamento Utilizado', key: 'armazenamento_utilizado', format: 'bytes' },
    ],
  },
  {
    title: 'IA & Certificados',
    icon: <Cpu className="h-4 w-4" />,
    fields: [
      { label: 'Tokens IA Contratados', key: 'token_de_ia_contratado', format: 'number' },
      { label: 'Tokens IA Utilizados', key: 'token_de_ia_utilizado', format: 'number' },
      { label: 'Certificados MEC Contratados', key: 'certificado_mec_contratado', format: 'number' },
      { label: 'Certificados MEC Utilizados', key: 'certificado_mec_utilizado', format: 'number' },
    ],
  },
  {
    title: 'Marcos de Compras',
    icon: <ShoppingCart className="h-4 w-4" />,
    fields: [
      { label: '1ª Compra', key: 'data_da_primeira_compra' },
      { label: '10ª Compra', key: 'data_da_10_compra' },
      { label: '50ª Compra', key: 'data_da_50_compra' },
      { label: '100ª Compra', key: 'data_da_100_compra' },
      { label: '200ª Compra', key: 'data_da_200_compra' },
    ],
  },
  {
    title: 'Marcos de Conteúdos',
    icon: <BookOpen className="h-4 w-4" />,
    fields: [
      { label: '1º Finalizado', key: 'data_do_primeiro_conteudo_finalizado' },
      { label: '10º Finalizado', key: 'data_do_10_conteudo_finalizado' },
      { label: '50º Finalizado', key: 'data_do_50_conteudo_finalizado' },
      { label: '100º Finalizado', key: 'data_do_100_conteudo_finalizado' },
      { label: '200º Finalizado', key: 'data_do_200_conteudo_finalizado' },
    ],
  },
  {
    title: 'HubSpot',
    icon: <Calendar className="h-4 w-4" />,
    fields: [
      { label: 'Data do Contrato', key: 'data_do_fechamento_do_contrato' },
      { label: 'Métrica de Sucesso', key: 'metrica_de_sucesso_acordada_na_venda' },
      { label: 'Desconto Concedido', key: 'desconto_concedido' },
    ],
  },
  {
    title: 'Métricas',
    icon: <Clock className="h-4 w-4" />,
    fields: [
      { label: 'Dados Gerados em', key: 'data_do_dado' },
      { label: 'Dados Processados em', key: 'data_do_processamento_do_dado' },
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

function formatNumber(value: any): string {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return new Intl.NumberFormat('pt-BR').format(n);
}

function formatValue(value: any, format?: string): React.ReactNode {
  if (value == null || value === '') return <span className="text-muted-foreground">—</span>;
  if (format === 'bytes') return formatBytes(value);
  if (format === 'number') return formatNumber(value);
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

  // Filter sections to only show those with at least one populated field
  const visibleSections = data
    ? SECTIONS.filter(section => {
        if (section.title === 'Dados do Cliente') return true;
        return section.fields.some(f => data[f.key] != null && data[f.key] !== '');
      })
    : SECTIONS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-lg">
            {loading ? 'Carregando...' : data?.client_name || 'Detalhes do Cliente'}
          </SheetTitle>
          {data && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {data.status_financeiro && (
                <Badge variant={statusColor(data.status_financeiro) as any}>
                  {data.status_financeiro}
                </Badge>
              )}
              {data.plano_detalhado && (
                <Badge variant="outline">{data.plano_detalhado}</Badge>
              )}
              {data.etapa_antiga_sensedata && (
                <Badge variant="secondary">{data.etapa_antiga_sensedata}</Badge>
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

            {!loading && data && visibleSections.map((section, idx) => {
              // For "Dados do Cliente", show all fields; for others, only show populated ones
              const isMain = section.title === 'Dados do Cliente';
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
                          {formatValue(data[f.key], f.format)}
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
      </SheetContent>
    </Sheet>
  );
}
