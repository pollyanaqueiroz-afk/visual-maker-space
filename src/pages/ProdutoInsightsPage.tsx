import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ticket, Handshake, HeadphonesIcon } from 'lucide-react';
import TicketsInsightsTab from '@/components/produto/TicketsInsightsTab';
import VendasInsightsTab from '@/components/produto/VendasInsightsTab';
import CSInsightsTab from '@/components/produto/CSInsightsTab';

export default function ProdutoInsightsPage() {
  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Insights de Produto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Central de melhorias — insights automáticos de tickets, vendas e CS
        </p>
      </div>

      <Tabs defaultValue="tickets" className="space-y-4">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="tickets" className="gap-1.5">
            <Ticket className="h-4 w-4" /> Insights de Tickets
          </TabsTrigger>
          <TabsTrigger value="vendas" className="gap-1.5">
            <Handshake className="h-4 w-4" /> Reuniões de Vendas
          </TabsTrigger>
          <TabsTrigger value="cs" className="gap-1.5">
            <HeadphonesIcon className="h-4 w-4" /> Reuniões de CS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tickets">
          <TicketsInsightsTab />
        </TabsContent>
        <TabsContent value="vendas">
          <VendasInsightsTab />
        </TabsContent>
        <TabsContent value="cs">
          <CSInsightsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
