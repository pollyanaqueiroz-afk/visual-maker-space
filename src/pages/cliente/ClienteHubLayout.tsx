import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Home, Palette, Smartphone, LogOut, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors',
                isActive(item.path)
                  ? 'text-primary'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
