import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboardBI, formatBRL, formatNumber } from '@/hooks/useDashboardBI';
import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OrigemItem { origem: string; total: number; ativos: number; cancelados: number; receita: number; }

const COLORS = ['hsl(160, 60%, 38%)', '#3b82f6', '#f97316', '#ef4444', '#6b7280'];

export default function BIOrigensPage({ csEmail }: { csEmail?: string }) {
  const { data, loading } = useDashboardBI<OrigemItem[]>('origens', csEmail);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Distribuição por Origem</CardTitle></CardHeader>
          <CardContent>
            {data && data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={data} dataKey="total" nameKey="origem" cx="50%" cy="50%" outerRadius={110} paddingAngle={2}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [formatNumber(v), name]} />
                  <Legend formatter={v => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Sem dados</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Detalhamento</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ativos</TableHead>
                  <TableHead className="text-right">Cancelados</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data || []).map((o, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{o.origem}</TableCell>
                    <TableCell className="text-right">{o.total}</TableCell>
                    <TableCell className="text-right">{o.ativos}</TableCell>
                    <TableCell className="text-right">{o.cancelados}</TableCell>
                    <TableCell className="text-right">{formatBRL(o.receita)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
