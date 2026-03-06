import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardBI } from '@/hooks/useDashboardBI';
import { RefreshCw, X, TrendingDown, Rocket } from 'lucide-react';
import BIChurnPage from './bi/BIChurnPage';
import BIUpsellPage from './bi/BIUpsellPage';

interface CSItem { cs_nome: string; cs_email: string; total: number; }

export default function ChurnUpsellPage() {
  const [csFilter, setCsFilter] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: csOptions } = useDashboardBI<CSItem[]>('cs');

  const csEmail = csFilter || undefined;

  const extractName = (csNome: string, csEmail: string): string => {
    if (csNome && csNome !== 'CS') return csNome;
    if (!csEmail) return 'Sem CS';
    return csEmail.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="space-y-6" key={refreshKey}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Churn & Upsell</h1>
          <p className="text-sm text-muted-foreground">Análise de risco de cancelamento e oportunidades de expansão</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={csFilter} onValueChange={v => setCsFilter(v === '__clear__' ? '' : v)}>
            <SelectTrigger className="w-[220px] h-8 text-sm">
              <SelectValue placeholder="Filtrar por CS..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__clear__">Todos os CSs</SelectItem>
              {(csOptions || []).filter(c => c.cs_email).map(cs => (
                <SelectItem key={cs.cs_email} value={cs.cs_email}>
                  {extractName(cs.cs_nome, cs.cs_email)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {csFilter && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs cursor-pointer" onClick={() => setCsFilter('')}>
              Filtro: {csFilter.split('@')[0]} <X className="h-3 w-3" />
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)} className="h-8">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="churn" className="w-full">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="churn" className="text-xs gap-1.5"><TrendingDown className="h-3.5 w-3.5" />Churn</TabsTrigger>
          <TabsTrigger value="upsell" className="text-xs gap-1.5"><Rocket className="h-3.5 w-3.5" />Upsell</TabsTrigger>
        </TabsList>

        <TabsContent value="churn"><BIChurnPage csEmail={csEmail} /></TabsContent>
        <TabsContent value="upsell"><BIUpsellPage csEmail={csEmail} /></TabsContent>
      </Tabs>
    </div>
  );
}
