import { ReactNode } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { HubSidebar } from './HubSidebar';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <button
      onClick={toggleSidebar}
      className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </button>
  );
}

interface Props {
  children: ReactNode;
}

export default function HubLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <HubSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/40 px-4">
            <SidebarToggleButton />
          </header>
          <main className="flex-1 p-6 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
