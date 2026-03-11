import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import ClienteMigracao from './ClienteMigracao';
import { ClienteImpersonationProvider } from '@/contexts/ClienteImpersonation';
import { Loader2 } from 'lucide-react';

/**
 * Public wrapper for migration form — accessed via portal_token without auth.
 * URL: /migracao/:token
 */
export default function ClienteMigracaoPublic() {
  const { token } = useParams<{ token: string }>();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['migration-by-token', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('migration_projects')
        .select('*')
        .eq('portal_token', token!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold">Link inválido ou expirado</p>
          <p className="text-white/50 text-sm">Verifique o link recebido ou entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white dark" style={{ fontFamily: "'Sora', sans-serif" }}>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-sm font-bold tracking-tight">Formulário de Migração</span>
          <span className="text-xs text-white/40">{project.client_name}</span>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ClienteImpersonationProvider email={project.client_email} clienteName={project.client_name} clienteId={null}>
          <ClienteMigracaoByProject project={project} />
        </ClienteImpersonationProvider>
      </main>
    </div>
  );
}

/** Renders migration form using a project object directly (no auth needed) */
function ClienteMigracaoByProject({ project }: { project: any }) {
  // Re-use the same logic from ClienteMigracao but with project directly
  // We import and render the internal components
  return <ClienteMigracao projectOverride={project} />;
}
