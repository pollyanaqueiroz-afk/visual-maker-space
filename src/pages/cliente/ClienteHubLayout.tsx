import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Home, Palette, Smartphone, LogOut, GraduationCap, Bell, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const navItems = [
  { label: 'Home', icon: Home, path: '/cliente' },
  { label: 'Artes', icon: Palette, path: '/cliente/artes' },
  { label: 'Aplicativo', icon: Smartphone, path: '/cliente/aplicativo' },
  { label: 'SCORM', icon: GraduationCap, path: '/cliente/scorm' },
];

export default function ClienteHubLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const IMAGE_TYPE_LABELS: Record<string, string> = {
    login: 'Área de Login', banner_vitrine: 'Banner Vitrine', product_cover: 'Capa de Produto',
    trail_banner: 'Banner de Trilha', challenge_banner: 'Banner de Desafio',
    community_banner: 'Banner de Comunidade', app_mockup: 'Mockup do Aplicativo',
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ['cliente-notifications', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data: reviewArts } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, created_at, briefing_requests!inner(requester_email)')
        .eq('briefing_requests.requester_email', user!.email!)
        .eq('status', 'review');

      const { data: appNotifs } = await supabase
        .from('app_notificacoes')
        .select('id, titulo, mensagem, created_at, lida')
        .eq('destinatario', user!.email!)
        .eq('lida', false)
        .order('created_at', { ascending: false })
        .limit(10);

      const items: Array<{ id: string; type: 'review' | 'app'; title: string; description: string; date: string; link: string; notifId?: string }> = [
        ...(reviewArts || []).map(a => ({
          id: `art-${a.id}`,
          type: 'review' as const,
          title: 'Arte pronta para aprovação',
          description: `${IMAGE_TYPE_LABELS[a.image_type] || a.image_type}${a.product_name ? ` — ${a.product_name}` : ''}`,
          date: a.created_at,
          link: '/cliente/artes',
        })),
        ...(appNotifs || []).map(n => ({
          id: `notif-${n.id}`,
          type: 'app' as const,
          title: n.titulo,
          description: n.mensagem,
          date: n.created_at,
          link: '/cliente/aplicativo',
          notifId: n.id,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return items;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadCount = notifications.length;

  const markAppNotifRead = async (notifId: string) => {
    await supabase.from('app_notificacoes').update({ lida: true }).eq('id', notifId);
    queryClient.invalidateQueries({ queryKey: ['cliente-notifications'] });
  };

  const { data: pendingArtsCount = 0 } = useQuery({
    queryKey: ['cliente-pending-arts', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data: requests } = await supabase
        .from('briefing_requests')
        .select('id')
        .eq('requester_email', user!.email!);
      if (!requests?.length) return 0;
      const { count } = await supabase
        .from('briefing_images')
        .select('id', { count: 'exact', head: true })
        .in('request_id', requests.map(r => r.id))
        .eq('status', 'review');
      return count || 0;
    },
    staleTime: 30_000,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-white/50" style={{ fontFamily: "'Sora', sans-serif" }}>
        Carregando...
      </div>
    );
  }

  if (!user) return <Navigate to="/cliente/login" replace />;

  const isActive = (path: string) =>
    path === '/cliente' ? location.pathname === '/cliente' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-[#0F172A] text-white dark" style={{ fontFamily: "'Sora', sans-serif" }}>
      {/* Top nav bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-sm font-bold tracking-tight">Portal do Cliente</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => { await signOut(); navigate('/cliente/login'); }}
            className="text-white/50 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom tab bar (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-around h-16">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive(item.path)
                  ? 'text-primary'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.path === '/cliente/artes' && pendingArtsCount > 0 && (
                  <span className="absolute -top-2 -right-3 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                    {pendingArtsCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
