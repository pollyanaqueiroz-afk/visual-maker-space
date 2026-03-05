import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PermissionsContextType {
  permissions: Set<string>;
  loading: boolean;
  userRoles: string[];
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// All available permissions grouped by module
export const PERMISSION_MODULES = [
  {
    module: 'briefings',
    label: 'Gestão de Briefings',
    permissions: [
      { key: 'briefings.view', label: 'Visualizar briefings' },
      { key: 'briefings.create', label: 'Criar briefings' },
      { key: 'briefings.edit', label: 'Editar briefings' },
      { key: 'briefings.delete', label: 'Excluir briefings' },
      { key: 'briefings.assign', label: 'Atribuir briefings' },
    ],
  },
  {
    module: 'agendamento',
    label: 'Agendamento',
    permissions: [
      { key: 'agendamento.view', label: 'Visualizar reuniões' },
      { key: 'agendamento.create', label: 'Criar reuniões' },
      { key: 'agendamento.edit', label: 'Editar reuniões' },
      { key: 'agendamento.delete', label: 'Excluir reuniões' },
    ],
  },
  {
    module: 'dashboards',
    label: 'Dashboards',
    permissions: [
      { key: 'dashboards.view', label: 'Visualizar dashboards' },
    ],
  },
  {
    module: 'carteira',
    label: 'Carteira Geral',
    permissions: [
      { key: 'carteira.view', label: 'Visualizar clientes' },
      { key: 'carteira.edit', label: 'Editar clientes' },
      { key: 'carteira.delete', label: 'Excluir clientes' },
      { key: 'carteira.import', label: 'Importar clientes' },
      { key: 'carteira.export', label: 'Exportar clientes' },
      { key: 'carteira.manage_fields', label: 'Gerenciar campos' },
    ],
  },
  {
    module: 'kanban',
    label: 'Kanban',
    permissions: [
      { key: 'kanban.view', label: 'Visualizar kanban' },
      { key: 'kanban.edit', label: 'Mover clientes' },
      { key: 'kanban.manage_columns', label: 'Gerenciar colunas' },
    ],
  },
  {
    module: 'lideranca',
    label: 'Dashboard Liderança',
    permissions: [
      { key: 'lideranca.view', label: 'Visualizar liderança' },
    ],
  },
  {
    module: 'aplicativos',
    label: 'Aplicativos',
    permissions: [
      { key: 'aplicativos.view', label: 'Visualizar aplicativos' },
      { key: 'aplicativos.edit', label: 'Editar dados dos clientes' },
    ],
  },
  {
    module: 'scorm',
    label: 'SCORM',
    permissions: [
      { key: 'scorm.view', label: 'Visualizar SCORMs' },
      { key: 'scorm.create', label: 'Importar SCORMs' },
      { key: 'scorm.delete', label: 'Excluir SCORMs' },
    ],
  },
  {
    module: 'admin',
    label: 'Administração',
    permissions: [
      { key: 'admin.view', label: 'Acessar administração' },
      { key: 'admin.manage_users', label: 'Gerenciar usuários' },
      { key: 'admin.manage_permissions', label: 'Gerenciar permissões' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap(m => m.permissions.map(p => p.key));

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPermissions(new Set());
      setUserRoles([]);
      setLoading(false);
      return;
    }


    // Get user roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles || roles.length === 0) {
      setPermissions(new Set());
      setUserRoles([]);
      setLoading(false);
      return;
    }

    const userRolesList = roles.map(r => r.role);
    setUserRoles(userRolesList);

    // Get permissions for those roles
    const { data: perms } = await (supabase
      .from('role_permissions' as any)
      .select('permission')
      .in('role', userRolesList) as any);

    const permSet = new Set<string>(
      (perms || []).map((p: any) => p.permission)
    );

    setPermissions(permSet);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasPermission = useCallback(
    (permission: string) => permissions.has(permission),
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (...perms: string[]) => perms.some(p => permissions.has(p)),
    [permissions]
  );

  const hasRole = useCallback(
    (role: string) => userRoles.includes(role),
    [userRoles]
  );

  return (
    <PermissionsContext.Provider value={{ permissions, loading, userRoles, hasPermission, hasAnyPermission, hasRole, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionsProvider');
  return ctx;
}
