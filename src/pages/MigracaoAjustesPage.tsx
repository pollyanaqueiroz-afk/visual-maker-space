import { Construction } from 'lucide-react';

export default function MigracaoAjustesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
        <Construction className="h-8 w-8 text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold">Ambiente em construção</h1>
      <p className="text-muted-foreground max-w-md">
        O módulo de Ajustes de Migração está sendo desenvolvido e estará disponível em breve.
        Esse módulo será usado para solicitações de ajustes pós-migração.
      </p>
    </div>
  );
}
