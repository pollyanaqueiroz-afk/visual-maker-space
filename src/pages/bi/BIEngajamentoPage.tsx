import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardBI, formatBRL, formatNumber, formatPct } from '@/hooks/useDashboardBI';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
  PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { Progress } from '@/components/ui/progress';

interface EngajItem { faixa: string; total: number; receita_em_risco: number; }
interface MembrosItem { faixa_alunos: string; total: number; receita: number; }
interface UsoData {
  total_ativos: number;
  media_banda_contratada_gb: number; media_banda_utilizada_gb: number;
  media_storage_contratado_gb: number; media_storage_utilizado_gb: number;
  media_tokens_contratados: number; media_tokens_utilizados: number;
  pct_uso_banda: number; pct_uso_storage: number; pct_uso_tokens: number;
}
interface AdocaoItem { recurso: string; usando: number; pct: number; }
interface RetencaoData {
  total: number;
  media_retencao_cliente: number | null; media_retencao_membro: number | null;
  media_ativacao_cliente: number | null; media_ativacao_membro: number | null;
  media_adocao_app: number | null; media_tempo_uso_min: number | null;
}
interface VariacaoItem { faixa: string; total: number; }
interface RecorrenciaItem { recorrencia: string; total: number; }
interface ExcedenteItem { recurso: string; excedentes: number; receita: number; }

const FAIXA_COLORS: Record<string, string> = {
  '0-7 dias': '#22c55e', '8-30 dias': '#84cc16', '31-60 dias': '#f97316', '61-90 dias': '#ef4444', 'Sem dado': '#6b7280',
};
const VAR_COLORS: Record<string, string> = {
  'Queda > 50%': '#dc2626', 'Queda 20-50%': '#ef4444', 'Queda 1-20%': '#f97316',
  'Estável': '#6b7280', 'Crescimento 1-20%': '#84cc16', 'Crescimento 20-50%': '#22c55e',
  'Crescimento > 50%': '#16a34a', 'Sem dado': '#9ca3af',
};
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4', '#6b7280'];

export default function BIEngajamentoPage({ csEmail }: { csEmail?: string }) {
  const { data: engData, loading: l1 } = useDashboardBI<EngajItem[]>('engajamento', csEmail);
  const { data: membrosData, loading: l2 } = useDashboardBI<MembrosItem[]>('membros', csEmail);
  const { data: usoData, loading: l3 } = useDashboardBI<UsoData>('uso_recursos', csEmail);
  const { data: adocaoData } = useDashboardBI<AdocaoItem[]>('eng_adocao_produto', csEmail);
  const { data: retencaoData } = useDashboardBI<RetencaoData>('eng_retencao', csEmail);
  const { data: variacaoData } = useDashboardBI<VariacaoItem[]>('eng_variacao_membros', csEmail);
  const { data: recorrenciaData } = useDashboardBI<RecorrenciaItem[]>('eng_recorrencia_acesso', csEmail);
  const { data: excedenteData } = useDashboardBI<ExcedenteItem[]>('eng_uso_excedente', csEmail);

  if (l1 || l2 || l3) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // KPI cards from retencao
  const ret = retencaoData;

  // Resource usage gauges
  const gauges = usoData ? [
    { label: 'Banda', pct: (usoData.pct_uso_banda * 100), contratado: `${usoData.media_banda_contratada_gb?.toFixed(0)} GB`, utilizado: `${usoData.media_banda_utilizada_gb?.toFixed(0)} GB` },
    { label: 'Storage', pct: (usoData.pct_uso_storage * 100), contratado: `${usoData.media_storage_contratado_gb?.toFixed(0)} GB`, utilizado: `${usoData.media_storage_utilizado_gb?.toFixed(0)} GB` },
    { label: 'Tokens IA', pct: (usoData.pct_uso_tokens * 100), contratado: formatNumber(usoData.media_tokens_contratados), utilizado: formatNumber(usoData.media_tokens_utilizados) },
  ] : [];

  // Adocao radar
  const radarData = (adocaoData || []).map(d => ({ recurso: d.recurso, pct: Math.round(d.pct * 100) }));

  // Recorrencia pie
  const recPie = (recorrenciaData || []).map((d, i) => ({ name: d.recorrencia, value: d.total, fill: PIE_COLORS[i % PIE_COLORS.length] }));

  return (
    <div className="space-y-6">
      {/* KPI Row: Retention & Activation */}
      {ret && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Retenção Cliente', value: ret.media_retencao_cliente, pct: true },
            { label: 'Retenção Membro', value: ret.media_retencao_membro, pct: true },
            { label: 'Ativação Cliente', value: ret.media_ativacao_cliente, pct: true },
            { label: 'Ativação Membro', value: ret.media_ativacao_membro, pct: true },
            { label: 'Adoção App', value: ret.media_adocao_app, pct: true },
            { label: 'Tempo Uso (min)', value: ret.media_tempo_uso_min, pct: false },
          ].map(k => (
            <Card key={k.label} className="border-none shadow-[var(--shadow-kpi)]">
              <CardContent className="p-4 text-center">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-extrabold">
                  {k.value != null ? (k.pct ? formatPct(k.value, true) : k.value.toFixed(1)) : '—'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Row: Engagement Bands + Member Variation */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Faixas de Engajamento (dias sem login)</CardTitle></CardHeader>
          <CardContent>
            {engData && engData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={engData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card p-3 shadow-md text-sm">
                        <p className="font-semibold">{d.faixa}</p>
                        <p>Clientes: {d.total}</p>
                        <p>Receita: {formatBRL(d.receita_em_risco)}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="total" name="Clientes" radius={[4, 4, 0, 0]}>
                    {engData.map((e, i) => <Cell key={i} fill={FAIXA_COLORS[e.faixa] || '#9ca3af'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Variação de Membros (MoM)</CardTitle></CardHeader>
          <CardContent>
            {variacaoData && variacaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={variacaoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" name="Clientes" radius={[4, 4, 0, 0]}>
                    {variacaoData.map((e, i) => <Cell key={i} fill={VAR_COLORS[e.faixa] || '#9ca3af'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row: Members Distribution + Access Recurrence */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Distribuição por Alunos Ativos</CardTitle></CardHeader>
          <CardContent>
            {membrosData && membrosData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={membrosData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="faixa_alunos" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : v} />
                  <Legend />
                  <Bar dataKey="total" name="Clientes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Recorrência de Acesso</CardTitle></CardHeader>
          <CardContent>
            {recPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={recPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {recPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Row: Product Adoption Radar + Excedentes */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Adoção de Produto (%)</CardTitle></CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="recurso" tick={{ fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Adoção %" dataKey="pct" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Clientes com Uso Excedente</CardTitle></CardHeader>
          <CardContent>
            {excedenteData && excedenteData.length > 0 ? (
              <div className="space-y-4 pt-2">
                {excedenteData.map(e => (
                  <div key={e.recurso} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{e.recurso}</span>
                      <span className="text-destructive font-bold">{e.excedentes} clientes</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>MRR desses clientes</span>
                      <span>{formatBRL(e.receita)}</span>
                    </div>
                    <Progress value={Math.min((e.excedentes / (usoData?.total_ativos || 1)) * 100, 100)} className="h-2" />
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Clientes com uso {">"} 100% do recurso contratado. Oportunidade de upsell.
                </p>
              </div>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Sem dados</p>}
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage Gauges */}
      {usoData && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Uso Médio de Recursos ({usoData.total_ativos} clientes ativos)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {gauges.map(g => (
                <div key={g.label} className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium text-sm">{g.label}</span>
                    <span className="text-lg font-bold">{g.pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(g.pct, 100)} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Utilizado: {g.utilizado}</span>
                    <span>Contratado: {g.contratado}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
