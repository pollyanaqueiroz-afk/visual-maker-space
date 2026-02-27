import { FileImage, LayoutDashboard, LogOut, CalendarDays, Crown, Briefcase, BarChart3, Package, Headset } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
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
  { title: 'Gestão de Briefings', url: '/hub/briefings', icon: FileImage },
];

const csModules = [
  { title: 'Agendamento', url: '/hub/agendamento', icon: CalendarDays },
  { title: 'Dashboards', url: '/hub/dashboards', icon: BarChart3 },
  { title: 'Carteira Geral', url: '/hub/carteira', icon: Briefcase },
  { title: 'Dashboard Liderança', url: '/hub/lideranca', icon: Crown },
];

export function HubSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const location = useLocation();
  const collapsed = state === 'collapsed';

  const isInGroup = (items: typeof implantacaoModules) =>
    items.some(i => location.pathname.startsWith(i.url));

  const renderItems = (items: typeof implantacaoModules) => (
    <SidebarMenu>
      {items.map((item) => (
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

        {/* Implantação Group */}
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

        {/* CS Group */}
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
