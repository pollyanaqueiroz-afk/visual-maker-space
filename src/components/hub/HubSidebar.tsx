import { FileImage, LayoutDashboard, LogOut, CalendarDays, Crown, Briefcase, BarChart3, Package, Headset, Home, Settings, Users, Kanban, ShieldCheck, Smartphone, ExternalLink, Database, AlertTriangle, GraduationCap, PieChart, TrendingDown, ClipboardCheck, Activity } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useLocation } from 'react-router-dom';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const implantacaoModules = [
  { title: 'Gestão de Briefings', url: '/hub/briefings', icon: FileImage, permission: 'briefings.view' },
  { title: 'Gestão de Aplicativos', url: '/hub/aplicativos', icon: Smartphone, permission: 'aplicativos.view' },
  { title: 'SCORM', url: '/hub/scorm', icon: GraduationCap, permission: 'scorm.view' },
];

const csModules = [
  { title: 'Agendamento', url: '/hub/agendamento', icon: CalendarDays, permission: 'agendamento.view' },
  { title: 'Dashboards', url: '/hub/dashboards', icon: BarChart3, permission: 'dashboards.view' },
  { title: 'Carteira Geral', url: '/hub/carteira', icon: Briefcase, permission: 'carteira.view' },
  { title: 'Kanban', url: '/hub/kanban', icon: Kanban, permission: 'kanban.view' },
  { title: 'Dashboard Liderança', url: '/hub/lideranca', icon: Crown, permission: 'lideranca.view' },
  { title: 'Funil de Cancelamento', url: '/hub/funil-cancelamento', icon: AlertTriangle, permission: 'funil.view' },
  { title: 'BI', url: '/hub/bi', icon: PieChart, permission: 'dashboards.view' },
  { title: 'Churn & Upsell', url: '/hub/churn-upsell', icon: TrendingDown, permission: 'dashboards.view' },
];

const auditoriaModules = [
  { title: 'Auditoria', url: '/hub/auditoria', icon: ClipboardCheck, permission: 'admin.view' },
  { title: 'Pipeline', url: '/hub/pipeline', icon: Activity, permission: 'admin.view' },
];

const adminModules = [
  { title: 'Usuários e Permissões', url: '/hub/admin/usuarios', icon: Users, permission: 'admin.view' },
  { title: 'Permissões por Perfil', url: '/hub/admin/permissoes', icon: ShieldCheck, permission: 'admin.manage_permissions' },
  { title: 'Campos da Carteira', url: '/hub/admin/campos', icon: Database, permission: 'carteira.manage_fields' },
  { title: 'Hub do Cliente', url: '/cliente', icon: ExternalLink, permission: 'admin.view' },
];

export function HubSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  const isInGroup = (items: typeof implantacaoModules) =>
    items.some(i => location.pathname.startsWith(i.url));

  const hasVisibleItems = (items: typeof implantacaoModules) =>
    items.some(i => hasPermission(i.permission));

  const renderItems = (items: typeof implantacaoModules) => {
    const visible = items.filter(i => hasPermission(i.permission));
    if (visible.length === 0) return null;
    return (
      <SidebarMenu>
        {visible.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink
                to={item.url}
                end
                className="hover:bg-muted/50"
                activeClassName="bg-muted text-primary font-medium"
              >
                <item.icon className="mr-2 h-4 w-4" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarContent>
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">Hub de Operações</span>
              <span className="text-[11px] text-muted-foreground">Curseduca Design</span>
            </div>
          )}
        </div>

        {/* Home */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/hub"
                  end
                  className="hover:bg-muted/50"
                  activeClassName="bg-muted text-primary font-medium"
                >
                  <Home className="mr-2 h-4 w-4" />
                  {!collapsed && <span>Home</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Implantação Group */}
        {hasVisibleItems(implantacaoModules) && (
        <SidebarGroup>
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5" />
                  {!collapsed && 'Implantação'}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderItems(implantacaoModules)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* CS Group */}
        {hasVisibleItems(csModules) && (
        <SidebarGroup>
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <Headset className="h-3.5 w-3.5" />
                  {!collapsed && 'CS'}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderItems(csModules)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* Auditoria Group */}
        {hasVisibleItems(auditoriaModules) && (
        <SidebarGroup>
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {!collapsed && 'Operações'}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderItems(auditoriaModules)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}

        {/* Administração Group */}
        {hasVisibleItems(adminModules) && (
        <SidebarGroup>
          <Collapsible defaultOpen={true}>
            <CollapsibleTrigger className="w-full">
              <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-foreground transition-colors">
                <span className="flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5" />
                  {!collapsed && 'Administração'}
                </span>
                {!collapsed && <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]_&]:rotate-180" />}
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                {renderItems(adminModules)}
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
