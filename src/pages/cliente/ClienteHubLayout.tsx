import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Home, Palette, Smartphone, LogOut, GraduationCap, Bell, Eye, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ClienteImpersonationProvider } from '@/contexts/ClienteImpersonation';
import { useClienteEmail } from '@/hooks/useClienteEmail';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/cliente/LanguageSwitcher';

export default function ClienteHubLayout() {
  return (
    <LanguageProvider>
      <ClienteHubLayoutInner />
    </LanguageProvider>
  );
}

function ClienteHubLayoutInner() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();

  const navItems = [
    { label: t('nav.home'), icon: Home, path: '/cliente' },
    { label: t('nav.arts'), icon: Palette, path: '/cliente/artes' },
    { label: t('nav.app'), icon: Smartphone, path: '/cliente/aplicativo' },
    { label: t('nav.migration'), icon: ArrowRightLeft, path: '/cliente/migracao' },
    { label: t('nav.scorm'), icon: GraduationCap, path: '/cliente/scorm' },
  ];

  const IMAGE_TYPE_LABELS: Record<string, string> = {
    login: t('img.login'), banner_vitrine: t('img.banner_vitrine'), product_cover: t('img.product_cover'),
    trail_banner: t('img.trail_banner'), challenge_banner: t('img.challenge_banner'),
    community_banner: t('img.community_banner'), app_mockup: t('img.app_mockup'),
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ['cliente-notifications', user?.email, language],
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
          title: t('portal.art_ready'),
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
        {t('loading')}
      </div>
    );
  }

  if (!user) return <Navigate to="/cliente/login" replace />;

  const isActive = (path: string) =>
    path === '/cliente' ? location.pathname === '/cliente' : location.pathname.startsWith(path);

  const dateLocale = language === 'en' ? enUS : ptBR;

  return (
    <ClienteImpersonationProvider email={null} clienteName={null} clienteId={null}>
    <div className="min-h-screen bg-[#0F172A] text-white dark" style={{ fontFamily: "'Sora', sans-serif" }}>
      {/* Top nav bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="text-sm font-bold tracking-tight">{t('portal.title')}</span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 bg-[#1E293B] border-white/10" align="end" sideOffset={8}>
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold text-white">{t('portal.notifications')}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-white/40 text-center py-6">{t('portal.no_notifications')}</p>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                        onClick={() => {
                          if (n.notifId) markAppNotifRead(n.notifId);
                          navigate(n.link);
                        }}
                      >
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${n.type === 'review' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                          {n.type === 'review' ? <Eye className="h-3.5 w-3.5 text-amber-400" /> : <Smartphone className="h-3.5 w-3.5 text-blue-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{n.title}</p>
                          <p className="text-[11px] text-white/50 truncate">{n.description}</p>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {formatDistanceToNow(new Date(n.date), { addSuffix: true, locale: dateLocale })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t border-white/10">
                    <button
                      className="text-xs text-primary hover:underline w-full text-center"
                      onClick={() => navigate('/cliente/artes')}
                    >
                      {t('portal.view_all_arts')}
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { await signOut(); navigate('/cliente/login'); }}
              className="text-white/50 hover:text-white hover:bg-white/10"
            >
              <LogOut className="h-4 w-4 mr-1" /> {t('portal.logout')}
            </Button>
          </div>
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
    </ClienteImpersonationProvider>
  );
}
