import { ReactNode } from 'react';
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar';
import { HubSidebar } from './HubSidebar';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function SidebarToggleArrow() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <button
      onClick={toggleSidebar}
      className={cn(
        'fixed z-30 top-1/2 -translate-y-1/2 flex items-center justify-center',
        'h-10 w-5 rounded-r-lg bg-primary text-primary-foreground shadow-lg',
        'hover:w-7 hover:bg-primary/90 transition-all duration-200 cursor-pointer',
        collapsed ? 'left-[var(--sidebar-width-icon)]' : 'left-[var(--sidebar-width)]'
      )}
      aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
    >
      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
        <SidebarToggleArrow />
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
