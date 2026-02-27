import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { HubSidebar } from './HubSidebar';

interface Props {
  children: ReactNode;
}

export default function HubLayout({ children }: Props) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <HubSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border/50 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
            <SidebarTrigger className="mr-3" />
            <span className="text-sm font-medium text-muted-foreground">Hub de Operações</span>
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
