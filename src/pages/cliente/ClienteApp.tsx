import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import AppClientPortalContent from '@/components/cliente/AppClientPortalContent';

/**
 * Finds the app_clientes record by the authenticated user's email
 * and renders the portal content inline (no separate token needed).
 */
export default function ClienteApp() {
  const { user } = useAuth();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente-app-by-email', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('*')
        .eq('email', user!.email!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20 text-white/50">
        <p className="text-lg font-medium">Nenhum aplicativo encontrado</p>
        <p className="text-sm mt-1">Não encontramos um projeto de app vinculado ao seu e-mail.</p>
      </div>
    );
  }

  return <AppClientPortalContent clienteId={cliente.id} />;
}
