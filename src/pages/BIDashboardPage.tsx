import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDashboardBI } from '@/hooks/useDashboardBI';
import { RefreshCw, X, BarChart3, DollarSign, Headset, Activity, UserPlus, Construction } from 'lucide-react';
import BIOverviewPage from './bi/BIOverviewPage';
import BIFinanceiroPage from './bi/BIFinanceiroPage';
import BICustomerSuccessPage from './bi/BICustomerSuccessPage';
import BIEngajamentoPage from './bi/BIEngajamentoPage';
import BIOrigensPage from './bi/BIOrigensPage';
import BINovosClientesPage from './bi/BINovosClientesPage';
import BIImplantacaoPage from './bi/BIImplantacaoPage';

interface CSItem { cs_nome: string; cs_email: string; total: number; }

export default function BIDashboardPage() {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard BI</h1>
          <p className="text-sm text-muted-foreground">Visão analítica da operação CS Curseduca</p>
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

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Visão Geral</TabsTrigger>
          <TabsTrigger value="novos" className="text-xs gap-1.5"><UserPlus className="h-3.5 w-3.5" />Novos Clientes</TabsTrigger>
          <TabsTrigger value="implantacao" className="text-xs gap-1.5"><Construction className="h-3.5 w-3.5" />Implantação</TabsTrigger>
          <TabsTrigger value="financeiro" className="text-xs gap-1.5"><DollarSign className="h-3.5 w-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="cs" className="text-xs gap-1.5"><Headset className="h-3.5 w-3.5" />Customer Success</TabsTrigger>
          <TabsTrigger value="engajamento" className="text-xs gap-1.5"><Activity className="h-3.5 w-3.5" />Engajamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><BIOverviewPage csEmail={csEmail} /></TabsContent>
        <TabsContent value="novos"><BINovosClientesPage csEmail={csEmail} /></TabsContent>
        <TabsContent value="implantacao"><BIImplantacaoPage csEmail={csEmail} /></TabsContent>
        <TabsContent value="financeiro"><BIFinanceiroPage csEmail={csEmail} /></TabsContent>
        <TabsContent value="cs"><BICustomerSuccessPage csEmail={csEmail} onSelectCS={(email) => setCsFilter(email)} /></TabsContent>
        <TabsContent value="engajamento"><BIEngajamentoPage csEmail={csEmail} /></TabsContent>
      </Tabs>
    </div>
  );
}
