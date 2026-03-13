import { Construction, HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProdutoEntregasPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Entregas de Produto</h1>
      
      <Card className="border-dashed border-2 border-muted-foreground/30">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Construction className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <HardHat className="h-5 w-5 text-amber-500" />
            Área em Construção
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground mb-2">
            Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
          </p>
          <p className="text-sm text-muted-foreground">
            O time de produto está trabalhando para entregar a melhor experiência para você.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
