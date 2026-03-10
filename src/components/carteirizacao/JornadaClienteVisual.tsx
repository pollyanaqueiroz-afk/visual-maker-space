import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Plano = { id: string; nome: string };
type Etapa = { id: string; nome: string };
type CsConfig = { id: string; etapa_id: string; plano_id: string | null; user_email: string; user_name: string | null; peso: number; ativo: boolean };

interface Props {
  planos: Plano[];
  etapas: Etapa[];
  csConfigs: CsConfig[];
}

export default function JornadaClienteVisual({ planos, etapas, csConfigs }: Props) {
  if (planos.length === 0 || etapas.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Jornada do Cliente Curseduca</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-semibold text-muted-foreground border-b border-border min-w-[140px]">
                  Plano
                </th>
                {etapas.map(etapa => (
                  <th
                    key={etapa.id}
                    className="p-2 text-center font-semibold border-b border-border min-w-[160px]"
                  >
                    <span className="inline-block px-3 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                      {etapa.nome}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planos.map((plano, pi) => {
                const csForPlano = csConfigs.filter(c => c.plano_id === plano.id && c.ativo);
                return (
                  <tr key={plano.id} className={pi % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="p-2 border-b border-border/50">
                      <span className="inline-block px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                        {plano.nome}
                      </span>
                    </td>
                    {etapas.map(etapa => {
                      const csForCell = csForPlano.filter(c => c.etapa_id === etapa.id);
                      return (
                        <td key={etapa.id} className="p-2 border-b border-border/50 align-top">
                          {csForCell.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {csForCell.map(cs => (
                                <span
                                  key={cs.id}
                                  className="inline-block px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium"
                                >
                                  {cs.user_name || cs.user_email.split('@')[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
