import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboardBI, formatBRL, formatNumber, formatPct } from '@/hooks/useDashboardBI';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';

interface EngajItem { faixa: string; total: number; receita_em_risco: number; }
interface MembrosItem { faixa_alunos: string; total: number; receita: number; }
interface UsoData {
  total_ativos: number;
  media_banda_contratada_gb: number; media_banda_utilizada_gb: number;
  media_storage_contratado_gb: number; media_storage_utilizado_gb: number;
  media_tokens_contratados: number; media_tokens_utilizados: number;
  media_certs_contratados: number | null; media_certs_utilizados: number | null;
  pct_uso_banda: number; pct_uso_storage: number; pct_uso_tokens: number;
}

const FAIXA_COLORS: Record<string, string> = {
  '0-7 dias': '#22c55e',
  '8-30 dias': '#84cc16',
  '31-60 dias': '#f97316',
  '61-90 dias': '#ef4444',
  'Sem dado': '#6b7280',
};

export default function BIEngajamentoPage({ csEmail }: { csEmail?: string }) {
  const { data: engData, loading: l1 } = useDashboardBI<EngajItem[]>('engajamento', csEmail);
  const { data: membrosData, loading: l2 } = useDashboardBI<MembrosItem[]>('membros', csEmail);
  const { data: usoData, loading: l3 } = useDashboardBI<UsoData>('uso_recursos', csEmail);

  if (l1 || l2 || l3) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const gauges = usoData ? [
    { label: 'Banda', pct: (usoData.pct_uso_banda * 100), contratado: `${usoData.media_banda_contratada_gb?.toFixed(0)} GB`, utilizado: `${usoData.media_banda_utilizada_gb?.toFixed(0)} GB` },
    { label: 'Storage', pct: (usoData.pct_uso_storage * 100), contratado: `${usoData.media_storage_contratado_gb?.toFixed(0)} GB`, utilizado: `${usoData.media_storage_utilizado_gb?.toFixed(0)} GB` },
    { label: 'Tokens IA', pct: (usoData.pct_uso_tokens * 100), contratado: formatNumber(usoData.media_tokens_contratados), utilizado: formatNumber(usoData.media_tokens_utilizados) },
  ] : [];

  const CustomTooltipEng = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-card p-3 shadow-md text-sm">
        <p className="font-semibold">{d.faixa}</p>
        <p>Clientes: {d.total}</p>
        <p>Receita em risco: {formatBRL(d.receita_em_risco)}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Engagement Bands */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Faixas de Engajamento (dias sem login)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">⚠️ "Sem dado" indica clientes sem informação de login disponível.</p>
          {engData && engData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip content={<CustomTooltipEng />} />
                <Bar dataKey="total" name="Clientes" radius={[4, 4, 0, 0]}>
                  {engData.map((e, i) => <Cell key={i} fill={FAIXA_COLORS[e.faixa] || '#9ca3af'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
        </CardContent>
      </Card>

      {/* Members Distribution */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Distribuição por Alunos (Ativos)</CardTitle></CardHeader>
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
          ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
        </CardContent>
      </Card>

      {/* Resource Usage Gauges */}
      {usoData && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Uso de Recursos (Média entre Ativos — {usoData.total_ativos} clientes)</CardTitle></CardHeader>
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
