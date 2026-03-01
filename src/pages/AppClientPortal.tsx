import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppClientPortalContent from '@/components/cliente/AppClientPortalContent';

export default function AppClientPortal() {
  const { token } = useParams();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['portal-cliente-token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('id')
        .eq('portal_token', token!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white/60" style={{ fontFamily: "'Sora', sans-serif" }}>Carregando...</div>;
  if (!cliente) return <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white/60" style={{ fontFamily: "'Sora', sans-serif" }}>Portal não encontrado</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white" style={{ fontFamily: "'Sora', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <AppClientPortalContent clienteId={cliente.id} />
      </div>
    </div>
  );
}
