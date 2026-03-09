import { useParams, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ClienteImpersonationProvider } from '@/contexts/ClienteImpersonation';
import { Home, Palette, Smartphone, GraduationCap, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export default function ClientePreviewWrapper() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente-preview-data', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('id, nome, empresa, email')
        .eq('id', clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!user) {
    navigate('/login');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white/50">
        <p>Cliente não encontrado.</p>
      </div>
    );
  }

  const basePath = `/hub/cliente-preview/${clienteId}`;
  const navItems = [
    { label: 'Home', icon: Home, path: basePath },
    { label: 'Artes', icon: Palette, path: `${basePath}/artes` },
    { label: 'Aplicativo', icon: Smartphone, path: `${basePath}/aplicativo` },
    { label: 'SCORM', icon: GraduationCap, path: `${basePath}/scorm` },
  ];

  const isActive = (path: string) =>
    path === basePath ? location.pathname === basePath : location.pathname.startsWith(path);

  return (
    <ClienteImpersonationProvider
      email={cliente.email}
      clienteName={cliente.nome}
      clienteId={cliente.id}
    >
      <div className="min-h-screen bg-[#0F172A] text-white dark" style={{ fontFamily: "'Sora', sans-serif" }}>
        {/* CS Impersonation Banner */}
        <div className="sticky top-0 z-[60] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="text-sm font-semibold truncate">
              Modo CS — Visualizando portal de <strong>{cliente.nome}</strong> ({cliente.empresa})
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 bg-amber-600/20 border-amber-700/40 text-amber-950 hover:bg-amber-600/30 hover:text-amber-950"
            onClick={() => navigate('/hub/processos-implantacao')}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Voltar ao Hub
          </Button>
        </div>

        {/* Top nav bar */}
        <header className="sticky top-[40px] z-50 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
            <span className="text-sm font-bold tracking-tight">Portal do Cliente (Preview)</span>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
          <Outlet />
        </main>

        {/* Bottom tab bar */}
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto flex items-center justify-around h-16">
            {navItems.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                  isActive(item.path) ? 'text-primary' : 'text-white/40 hover:text-white/70'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ClienteImpersonationProvider>
  );
}
