import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { InfoTip } from '@/components/ui/InfoTip';

interface CSItem {
  cs_nome: string; cs_email: string; total: number; ativos: number;
  cancelados: number; inadimplentes: number; receita: number; media_dias_sem_login: number;
}
interface EtapaItem {
  etapa: string; total: number; inadimplentes: number; receita: number; media_dias_sem_login: number;
}

function extractName(csNome: string, csEmail: string): string {
  if (csNome && csNome !== 'CS') return csNome;
  if (!csEmail) return 'Sem CS';
  const part = csEmail.split('@')[0];
  return part.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function BICustomerSuccessPage({ csEmail, onSelectCS }: { csEmail?: string; onSelectCS: (email: string) => void }) {
  const { data: csData, loading: l1 } = useDashboardBI<CSItem[]>('cs', csEmail);
  const { data: etapasData, loading: l2 } = useDashboardBI<EtapaItem[]>('etapas_cs', csEmail);

  if (l1 || l2) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Carteira por CS
            <InfoTip text="clients.cs_atual — Agrupamento por CS. Total = contagem de id_curseduca. Ativos = status_curseduca=Ativo. Inadimplentes = status_financeiro_inadimplencia=Inadimplente. Receita = soma de cliente_financeiro.valor_contratado (vigencia_assinatura=Ativa). Dias s/ Login = média de cliente_engajamento_produto.dias_desde_ultimo_login." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-3">Clique em uma linha para filtrar todo o dashboard por esse CS.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CS</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Inadimplentes</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Dias s/ Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(csData || []).map((cs, i) => (
                <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => cs.cs_email && onSelectCS(cs.cs_email)}>
                  <TableCell className="font-medium">{extractName(cs.cs_nome, cs.cs_email)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cs.cs_email || '—'}</TableCell>
                  <TableCell className="text-right">{cs.total}</TableCell>
                  <TableCell className="text-right">{cs.ativos}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="border-destructive/30 text-destructive">{cs.inadimplentes}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatBRL(cs.receita)}</TableCell>
                  <TableCell className="text-right">{cs.media_dias_sem_login?.toFixed(1) ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Funil de Etapas do CS
            <InfoTip text="carteirizacao_etapas.nome × clients — Contagem de clientes por etapa do funil CS. Inadimplentes = clients.status_financeiro_inadimplencia = Inadimplente naquela etapa." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {etapasData && etapasData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(400, etapasData.length * 36)}>
              <BarChart data={etapasData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="etapa" width={180} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => name === 'receita' ? formatBRL(v) : formatNumber(v)} />
                <Legend />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="inadimplentes" name="Inadimplentes" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
        </CardContent>
      </Card>
    </div>
  );
}
