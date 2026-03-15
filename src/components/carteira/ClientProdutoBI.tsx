import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, Zap, HardDrive, Wifi, Award } from 'lucide-react';

interface ProdutoData {
  player_bandwidth_hired: number | null;
  player_bandwidth_used: number | null;
  player_bandwidth_pct_uso: number | null;
  player_storage_hired: number | null;
  player_storage_used: number | null;
  player_storage_pct_uso: number | null;
  ai_tokens_hired: number | null;
  ai_tokens_used: number | null;
  ai_tokens_pct_uso: number | null;
  certificates_mec_hired: number | null;
  certificates_mec_used: number | null;
  certificates_mec_pct_uso: number | null;
  cobranca_automatica_banda_excedente: boolean | null;
  cobranca_automatica_token_excedente: boolean | null;
  gatilho_upgrade_100alunos: boolean | null;
}

const dash = (v: any) => (v == null ? '—' : String(v));
const num = (v: number | null) => (v == null ? '—' : v.toLocaleString('pt-BR'));

function barColor(pct: number | null, forceRed: boolean) {
  if (forceRed) return 'bg-destructive';
  if (pct == null) return 'bg-primary';
  if (pct > 100) return 'bg-destructive';
  if (pct > 80) return 'bg-yellow-500';
  return 'bg-primary';
}

function ResourceBar({ label, icon: Icon, used, hired, pctUso, forceRed = false }: {
  label: string;
  icon: React.ElementType;
  used: number | null;
  hired: number | null;
  pctUso: number | null;
  forceRed?: boolean;
}) {
  const pctVal = pctUso != null ? pctUso * 100 : null;
  const color = barColor(pctVal, forceRed);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold">
          {pctVal != null ? `${pctVal.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pctVal ?? 0, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Utilizado: {num(used)}</span>
        <span>Contratado: {num(hired)}</span>
      </div>
    </div>
  );
}

export default function ClientProdutoBI({ idCurseduca }: { idCurseduca: string }) {
  const [data, setData] = useState<ProdutoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!idCurseduca) return;
    (async () => {
      setLoading(true);
      const { data: row } = await supabase
        .from('cliente_engajamento_produto')
        .select('player_bandwidth_hired,player_bandwidth_used,player_bandwidth_pct_uso,player_storage_hired,player_storage_used,player_storage_pct_uso,ai_tokens_hired,ai_tokens_used,ai_tokens_pct_uso,certificates_mec_hired,certificates_mec_used,certificates_mec_pct_uso,cobranca_automatica_banda_excedente,cobranca_automatica_token_excedente,gatilho_upgrade_100alunos')
        .eq('id_curseduca', idCurseduca)
        .maybeSingle();
      setData(row as ProdutoData | null);
      setLoading(false);
    })();
  }, [idCurseduca]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground py-4">Sem dados de produto para este cliente.</p>;

  const alertas = [
    { label: 'Cobrança automática banda excedente', value: data.cobranca_automatica_banda_excedente },
    { label: 'Cobrança automática token excedente', value: data.cobranca_automatica_token_excedente },
    { label: 'Gatilho upgrade 100 alunos', value: data.gatilho_upgrade_100alunos },
  ];

  return (
    <div className="space-y-4">
      {/* Uso de Recursos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Uso de Recursos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ResourceBar
            label="Bandwidth (Player)"
            icon={Wifi}
            used={data.player_bandwidth_used}
            hired={data.player_bandwidth_hired}
            pctUso={data.player_bandwidth_pct_uso}
            forceRed={data.cobranca_automatica_banda_excedente === true}
          />
          <ResourceBar
            label="Storage (Player)"
            icon={HardDrive}
            used={data.player_storage_used}
            hired={data.player_storage_hired}
            pctUso={data.player_storage_pct_uso}
          />
          <ResourceBar
            label="Tokens IA"
            icon={Zap}
            used={data.ai_tokens_used}
            hired={data.ai_tokens_hired}
            pctUso={data.ai_tokens_pct_uso}
            forceRed={data.cobranca_automatica_token_excedente === true}
          />
          <ResourceBar
            label="Certificados MEC"
            icon={Award}
            used={data.certificates_mec_used}
            hired={data.certificates_mec_hired}
            pctUso={data.certificates_mec_pct_uso}
          />
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {alertas.map(a => (
              <Badge
                key={a.label}
                variant={a.value ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {a.label}: {a.value == null ? '—' : a.value ? 'Sim' : 'Não'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
