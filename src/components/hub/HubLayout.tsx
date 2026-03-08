import { ReactNode } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { HubSidebar } from './HubSidebar';
import { PanelLeftClose, PanelLeftOpen, Bell, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <button
      onClick={toggleSidebar}
      className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['hub-notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user!.id);
      const userRoles = (roles || []).map((r: any) => r.role);

      const destinatarios: string[] = [];
      if (userRoles.includes('analista_implantacao') || userRoles.includes('admin') || userRoles.includes('implantacao')) destinatarios.push('analista');
      if (userRoles.includes('gerente_implantacao') || userRoles.includes('admin')) destinatarios.push('gerente');

      if (destinatarios.length === 0) return [];

      const { data, error } = await (supabase
        .from('app_notificacoes')
        .select('*')
        .in('destinatario', destinatarios)
        .eq('canal', 'portal') as any)
        .eq('lida', false)
        .order('agendado_para', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: slaAlerts = 0 } = useQuery({
    queryKey: ['sla-alerts-count'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from('briefing_images')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'in_progress'])
        .lt('deadline', now);
      return count || 0;
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const totalBadge = notifications.length + slaAlerts;

  const markAsRead = async (id: string) => {
    await (supabase.from('app_notificacoes').update({ lida: true } as any) as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['hub-notifications'] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer">
          <Bell className="h-4 w-4" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[9px] font-bold text-white px-1 shadow-lg shadow-red-500/30 animate-pulse">
              {totalBadge > 9 ? '9+' : totalBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-card border-border/30 shadow-2xl" align="end">
        <div className="p-3 border-b border-border/20">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {slaAlerts > 0 && (
            <p className="text-[10px] text-destructive mt-0.5">⚠️ {slaAlerts} arte(s) com prazo vencido</p>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && slaAlerts === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
          ) : notifications.map((n: any) => (
            <div
              key={n.id}
              className="p-3 border-b border-border/10 hover:bg-white/[0.03] cursor-pointer transition-colors"
              onClick={() => markAsRead(n.id)}
            >
              <p className="text-sm font-medium">{n.titulo}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {n.agendado_para ? format(new Date(n.agendado_para), "dd/MM 'às' HH:mm") : ''}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  children: ReactNode;
}

export default function HubLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full dark bg-background text-foreground">
        <HubSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border/30 px-4 gap-3 bg-card/50 backdrop-blur-sm sticky top-0 z-40">
            <SidebarToggleButton />
            <div className="flex-1" />

            {/* Search placeholder */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30 text-muted-foreground text-sm cursor-pointer hover:bg-muted/80 transition-colors">
              <Search className="h-3.5 w-3.5" />
              <span>Buscar...</span>
              <kbd className="ml-4 text-[10px] bg-background/50 px-1.5 py-0.5 rounded border border-border/30">⌘K</kbd>
            </div>

            <NotificationBell />
          </header>
          <main className="flex-1 p-6 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
