import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EngajamentoData {
  data_ultimo_login: string | null;
  dias_desde_ultimo_login: number | null;
  alerta_inatividade: boolean | null;
  tempo_medio_uso_web_minutos: number | null;
  recorrencia_acesso: string | null;
  membros_mes_m4: number | null;
  membros_mes_m3: number | null;
  membros_mes_m2: number | null;
  membros_mes_m1: number | null;
  membros_mes_atual: number | null;
  variacao_m3_vs_m4: number | null;
  variacao_m2_vs_m3: number | null;
  variacao_m1_vs_m2: number | null;
  variacao_m0_vs_m1: number | null;
  taxa_retencao_cliente: number | null;
  taxa_retencao_membro: number | null;
  taxa_ativacao_cliente: number | null;
  taxa_ativacao_membro: number | null;
  taxa_adocao_app: number | null;
}

const dash = (v: any) => (v == null ? '—' : String(v));
const pct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

function formatDate(d: string | null) {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function VarBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const pctVal = (value * 100).toFixed(1);
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{pctVal}%
    </span>
  );
}

export default function ClientEngajamentoBI({ idCurseduca }: { idCurseduca: string }) {
  const [data, setData] = useState<EngajamentoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idCurseduca) return;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('cliente_engajamento_produto')
        .select('data_ultimo_login,dias_desde_ultimo_login,alerta_inatividade,tempo_medio_uso_web_minutos,recorrencia_acesso,membros_mes_m4,membros_mes_m3,membros_mes_m2,membros_mes_m1,membros_mes_atual,variacao_m3_vs_m4,variacao_m2_vs_m3,variacao_m1_vs_m2,variacao_m0_vs_m1,taxa_retencao_cliente,taxa_retencao_membro,taxa_ativacao_cliente,taxa_ativacao_membro,taxa_adocao_app')
        .eq('id_curseduca', idCurseduca)
        .maybeSingle();
      setData(row as EngajamentoData | null);
      setLoading(false);
    })();
  }, [idCurseduca]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground py-4">Sem dados de engajamento para este cliente.</p>;

  const membrosChart = [
    { label: 'M-4', value: data.membros_mes_m4, var: null as number | null },
    { label: 'M-3', value: data.membros_mes_m3, var: data.variacao_m3_vs_m4 },
    { label: 'M-2', value: data.membros_mes_m2, var: data.variacao_m2_vs_m3 },
    { label: 'M-1', value: data.membros_mes_m1, var: data.variacao_m1_vs_m2 },
    { label: 'Atual', value: data.membros_mes_atual, var: data.variacao_m0_vs_m1 },
  ];

  const taxas = [
    { label: 'Retenção Cliente', value: data.taxa_retencao_cliente },
    { label: 'Retenção Membro', value: data.taxa_retencao_membro },
    { label: 'Ativação Cliente', value: data.taxa_ativacao_cliente },
    { label: 'Ativação Membro', value: data.taxa_ativacao_membro },
    { label: 'Adoção App', value: data.taxa_adocao_app },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Último Login</p>
            <p className="text-sm font-semibold">{formatDate(data.data_ultimo_login)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Dias sem Login</p>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">{dash(data.dias_desde_ultimo_login)}</p>
              {data.dias_desde_ultimo_login != null && data.dias_desde_ultimo_login > 30 && (
                <Badge variant="destructive" className="text-[9px] px-1 py-0">Alerta</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Inatividade</p>
            {data.alerta_inatividade ? (
              <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Inativo</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">OK</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Tempo Médio Web</p>
            <p className="text-sm font-semibold">{data.tempo_medio_uso_web_minutos != null ? `${data.tempo_medio_uso_web_minutos} min` : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground mb-1">Recorrência</p>
            <p className="text-sm font-semibold">{dash(data.recorrencia_acesso)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Evolução de Membros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolução de Membros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 items-end">
            <div className="flex-1" style={{ minHeight: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={membrosChart}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v: number) => v?.toLocaleString('pt-BR')} />
                  <Bar dataKey="value" name="Membros" radius={[4, 4, 0, 0]}>
                    {membrosChart.map((_, i) => (
                      <Cell key={i} fill="hsl(var(--primary))" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 min-w-[100px]">
              {membrosChart.map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <VarBadge value={m.var} />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Taxas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Taxas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {taxas.map(t => (
              <div key={t.label} className="text-center">
                <p className="text-lg font-bold text-foreground">{pct(t.value)}</p>
                <p className="text-[10px] text-muted-foreground">{t.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
