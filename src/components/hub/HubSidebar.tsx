import { useState, useEffect } from 'react';
import { FileImage, LayoutDashboard, LogOut, CalendarDays, Crown, Briefcase, BarChart3, Package, Headset, Home, Settings, Users, ShieldCheck, Smartphone, ExternalLink, Database, AlertTriangle, GraduationCap, PieChart, TrendingDown, ClipboardCheck, Activity, ArrowRightLeft, Construction } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const implantacaoModules = [
  { title: 'Gestão de Briefings', url: '/hub/briefings', icon: FileImage, permission: 'briefings.view', badgeKey: 'pendingArts' as const },
  { title: 'Gestão de Aplicativos', url: '/hub/aplicativos', icon: Smartphone, permission: 'aplicativos.view', badgeKey: 'pendingApps' as const },
  { title: 'SCORM', url: '/hub/scorm', icon: GraduationCap, permission: 'scorm.view', badgeKey: null },
];

const csModules = [
  { title: 'Agendamento', url: '/hub/agendamento', icon: CalendarDays, permission: 'agendamento.view', badgeKey: null },
  { title: 'Ajuste de Briefings', url: '/hub/ajuste-briefings', icon: FileImage, permission: 'briefings.view', badgeKey: null },
  { title: 'Processos de Implantação', url: '/hub/processos-implantacao', icon: ClipboardCheck, permission: null, badgeKey: null },
  { title: 'Dashboards', url: '/hub/dashboards', icon: BarChart3, permission: 'dashboards.view', badgeKey: null },
  { title: 'Carteira Geral', url: '/hub/carteira', icon: Briefcase, permission: 'carteira.view', badgeKey: null },
  { title: 'Dashboard Liderança', url: '/hub/lideranca', icon: Crown, permission: 'lideranca.view', badgeKey: null },
  { title: 'Funil de Cancelamento', url: '/hub/funil-cancelamento', icon: AlertTriangle, permission: 'funil.view', badgeKey: null },
  { title: 'BI', url: '/hub/bi', icon: PieChart, permission: 'dashboards.view', badgeKey: null },
  { title: 'Churn & Upsell', url: '/hub/churn-upsell', icon: TrendingDown, permission: 'dashboards.view', badgeKey: null },
];

const auditoriaModules = [
  { title: 'Auditoria', url: '/hub/auditoria', icon: ClipboardCheck, permission: 'admin.view', badgeKey: null },
  { title: 'Pipeline', url: '/hub/pipeline', icon: Activity, permission: 'admin.view', badgeKey: null },
];

const adminModules = [
  { title: 'Usuários e Permissões', url: '/hub/admin/usuarios', icon: Users, permission: 'admin.view', badgeKey: null },
  { title: 'Gestão Gerencial', url: '/hub/admin/gerencial', icon: Crown, permission: 'admin.view', badgeKey: null },
  { title: 'Carteirização', url: '/hub/admin/carteirizacao', icon: Briefcase, permission: 'admin.view', badgeKey: null },
  { title: 'Permissões por Perfil', url: '/hub/admin/permissoes', icon: ShieldCheck, permission: 'admin.manage_permissions', badgeKey: null },
  { title: 'Campos da Carteira', url: '/hub/admin/campos', icon: Database, permission: 'carteira.manage_fields', badgeKey: null },
  { title: 'Hub do Cliente', url: '/cliente', icon: ExternalLink, permission: 'admin.view', badgeKey: null },
];

type BadgeCounts = {
  pendingArts: number;
  pendingApps: number;
};

export function HubSidebar() {
  const { state } = useSidebar();
  const { signOut, user } = useAuth();
  const { hasPermission, hasRole, loading: permsLoading } = usePermissions();
  const location = useLocation();
  const collapsed = state === 'collapsed';
  const [badges, setBadges] = useState<BadgeCounts>({ pendingArts: 0, pendingApps: 0 });

  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      const [artsRes, appsRes] = await Promise.all([
        supabase.from('briefing_images').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('app_clientes').select('id', { count: 'exact', head: true }).neq('status', 'concluido'),
      ]);
      setBadges({
        pendingArts: artsRes.count ?? 0,
        pendingApps: appsRes.count ?? 0,
      });
    };
    fetchCounts();
  }, [user]);

  const isInGroup = (items: typeof implantacaoModules) =>
    items.some(i => location.pathname.startsWith(i.url));

  const hasVisibleItems = (items: typeof csModules) =>
    items.some(i => i.permission === null || hasPermission(i.permission));

  const renderItems = (items: typeof implantacaoModules) => {
    const visible = items.filter(i => i.permission === null ? !hasRole('cliente') : hasPermission(i.permission));
    if (visible.length === 0) return null;
    return (
      <SidebarMenu>
        {visible.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                end
                className="hover:bg-white/5 rounded-lg transition-all duration-200"
                activeClassName="bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-medium border-l-2 border-primary"
              >
                <item.icon className="mr-2 h-4 w-4 opacity-60 group-[.active]:opacity-100" />
                {!collapsed && (
                  <span className="flex items-center justify-between flex-1">
                    <span>{item.title}</span>
                    {item.badgeKey && badges[item.badgeKey] > 0 && (
                      <Badge variant="secondary" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold bg-primary/10 text-primary">
                        {badges[item.badgeKey]}
                      </Badge>
                    )}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  };

  const renderGroup = (
    label: string,
    icon: React.ElementType,
    items: typeof implantacaoModules,
  ) => {
    if (!hasVisibleItems(items)) return null;
    const active = isInGroup(items);
    return (
      <SidebarGroup>
        <Collapsible defaultOpen={active}>
          <CollapsibleTrigger className="w-full">
            <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
              <span className="flex items-center gap-2">
                {(() => { const Icon = icon; return <Icon className="h-3.5 w-3.5 opacity-60" />; })()}
                {!collapsed && label}
              </span>
              {!collapsed && <ChevronDown className="h-3.5 w-3.5 opacity-40 transition-transform [[data-state=open]_&]:rotate-180" />}
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>
              {renderItems(items)}
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/30">
      <SidebarContent>
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground shadow-lg shadow-primary/20">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Hub de Operações</span>
              <span className="text-[11px] text-muted-foreground">Curseduca Design</span>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="mx-4 h-px bg-border/30" />

        {/* Home */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/hub"
                  end
                  className="hover:bg-white/5 rounded-lg transition-all duration-200"
                  activeClassName="bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-medium border-l-2 border-primary"
                >
                  <Home className="mr-2 h-4 w-4 opacity-60" />
                  {!collapsed && <span>Home</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {renderGroup('Implantação', Package, implantacaoModules)}
        {renderGroup('CS', Headset, csModules)}
        {renderGroup('Operações', ClipboardCheck, auditoriaModules)}
        {renderGroup('Administração', Settings, adminModules)}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
