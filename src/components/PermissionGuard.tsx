import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface Props {
  permission: string;
  children: React.ReactNode;
}

export default function PermissionGuard({ permission, children }: Props) {
  const { hasPermission, loading } = usePermissions();
  const toasted = useRef(false);

  const allowed = hasPermission(permission);

  useEffect(() => {
    if (!loading && !allowed && !toasted.current) {
      toasted.current = true;
      toast.error('Você não tem permissão para acessar esta página');
    }
  }, [loading, allowed]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verificando permissões...</div>
      </div>
    );
  }

  if (!allowed) return <Navigate to="/hub" replace />;

  return <>{children}</>;
}
