import { ReactNode, useState } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { HubSidebar } from './HubSidebar';
import { PanelLeftClose, PanelLeftOpen, Bell, Check, Eye, EyeOff, Trash2, X } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <button
      onClick={toggleSidebar}
      className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedNotif, setSelectedNotif] = useState<any>(null);

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
        .order('agendado_para', { ascending: false })
        .limit(30);
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

  const unreadCount = notifications.filter((n: any) => !n.lida).length + slaAlerts;

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await (supabase.from('app_notificacoes').update({ lida: true } as any) as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['hub-notifications'] });
  };

  const markAsUnread = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await (supabase.from('app_notificacoes').update({ lida: false } as any) as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['hub-notifications'] });
  };

  const deleteNotif = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await (supabase.from('app_notificacoes').delete() as any).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['hub-notifications'] });
    toast.success('Notificação excluída');
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n: any) => !n.lida).map((n: any) => n.id);
    if (unreadIds.length === 0) return;
    await (supabase.from('app_notificacoes').update({ lida: true } as any) as any).in('id', unreadIds);
    queryClient.invalidateQueries({ queryKey: ['hub-notifications'] });
    toast.success('Todas marcadas como lidas');
  };

  const openNotification = (n: any) => {
    setSelectedNotif(n);
    if (!n.lida) {
      markAsRead(n.id);
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button className="relative h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-[9px] font-bold text-white px-1 shadow-lg shadow-red-500/30 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0 bg-white border-gray-200 shadow-2xl" align="end">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
              {slaAlerts > 0 && (
                <p className="text-[10px] text-red-600 mt-0.5">⚠️ {slaAlerts} arte(s) com prazo vencido</p>
              )}
            </div>
            {notifications.some((n: any) => !n.lida) && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-gray-500 hover:text-gray-900" onClick={markAllRead}>
                <Check className="h-3 w-3 mr-1" /> Ler todas
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 && slaAlerts === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma notificação</p>
            ) : notifications.map((n: any) => (
              <div
                key={n.id}
                className={cn(
                  'group relative p-3 cursor-pointer transition-colors',
                  n.lida ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/40 hover:bg-blue-50/60'
                )}
                onClick={() => openNotification(n)}
              >
                {!n.lida && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
                )}
                <div className="pl-3">
                  <p className={cn('text-sm', n.lida ? 'text-gray-700' : 'font-semibold text-gray-900')}>{n.titulo}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensagem}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {n.agendado_para ? format(new Date(n.agendado_para), "dd/MM 'às' HH:mm") : ''}
                  </p>
                </div>
                {/* Action buttons on hover */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-0.5 py-0.5">
                  {n.lida ? (
                    <button
                      onClick={(e) => markAsUnread(n.id, e)}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      title="Marcar como não lida"
                    >
                      <EyeOff className="h-3 w-3" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => markAsRead(n.id, e)}
                      className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                      title="Marcar como lida"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => deleteNotif(n.id, e)}
                    className="h-6 w-6 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification detail dialog */}
      <Dialog open={!!selectedNotif} onOpenChange={(v) => { if (!v) setSelectedNotif(null); }}>
        <DialogContent className="sm:max-w-md">
          {selectedNotif && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  {selectedNotif.titulo}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedNotif.agendado_para ? format(new Date(selectedNotif.agendado_para), "dd/MM/yyyy 'às' HH:mm") : ''}
                  {selectedNotif.tipo && ` · ${selectedNotif.tipo.replace(/_/g, ' ')}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedNotif.mensagem}</p>
                <div className="flex items-center gap-2 pt-2">
                  {selectedNotif.lida ? (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { markAsUnread(selectedNotif.id); setSelectedNotif({ ...selectedNotif, lida: false }); }}>
                      <EyeOff className="h-3 w-3" /> Marcar como não lida
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { markAsRead(selectedNotif.id); setSelectedNotif({ ...selectedNotif, lida: true }); }}>
                      <Eye className="h-3 w-3" /> Marcar como lida
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    onClick={() => { deleteNotif(selectedNotif.id); setSelectedNotif(null); }}
                  >
                    <Trash2 className="h-3 w-3" /> Excluir
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface Props {
  children: ReactNode;
}

export default function HubLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-[#F8FAFC]">
        {/* Sidebar stays dark */}
        <div className="dark">
          <HubSidebar />
        </div>
        {/* Content area is light */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-gray-200 px-4 gap-3 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
            <SidebarToggleButton />
            <div className="flex-1" />

            <GlobalSearch />

            <NotificationBell />
          </header>
          <main className="flex-1 p-6 min-w-0 text-gray-900">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
