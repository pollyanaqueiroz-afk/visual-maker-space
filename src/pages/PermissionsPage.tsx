import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PERMISSION_MODULES, ALL_PERMISSION_KEYS } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Save } from 'lucide-react';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'gerente_cs', label: 'Gerente CS' },
  { value: 'gerente_implantacao', label: 'Gerente Impl.' },
  { value: 'cs', label: 'CS' },
  { value: 'implantacao', label: 'Implantação' },
  { value: 'designer', label: 'Designer' },
  { value: 'member', label: 'Membro' },
];

type PermMap = Record<string, Set<string>>; // role -> set of permissions

export default function PermissionsPage() {
  const [permMap, setPermMap] = useState<PermMap>({});
  const [original, setOriginal] = useState<PermMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPermissions = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('role_permissions' as any)
      .select('role, permission') as any);

    if (error) { toast.error('Erro ao carregar permissões'); setLoading(false); return; }

    const map: PermMap = {};
    for (const r of ROLES) map[r.value] = new Set();
    for (const row of (data || [])) {
      if (!map[row.role]) map[row.role] = new Set();
      map[row.role].add(row.permission);
    }

    setPermMap(JSON.parse(JSON.stringify(map, replacer), reviver));
    setOriginal(JSON.parse(JSON.stringify(map, replacer), reviver));
    setLoading(false);
  };

  useEffect(() => { loadPermissions(); }, []);

  // Set serialization helpers
  const replacer = (_: string, v: any) => v instanceof Set ? { __set: [...v] } : v;
  const reviver = (_: string, v: any) => v && v.__set ? new Set(v.__set) : v;

  const toggle = (role: string, perm: string) => {
    setPermMap(prev => {
      const next = { ...prev };
      const s = new Set(next[role]);
      if (s.has(perm)) s.delete(perm); else s.add(perm);
      next[role] = s;
      return next;
    });
  };

  const toggleAllForRole = (role: string, checked: boolean) => {
    setPermMap(prev => {
      const next = { ...prev };
      next[role] = checked ? new Set(ALL_PERMISSION_KEYS) : new Set();
      return next;
    });
  };

  const toggleAllForPerm = (perm: string, checked: boolean) => {
    setPermMap(prev => {
      const next = { ...prev };
      for (const r of ROLES) {
        const s = new Set(next[r.value]);
        if (checked) s.add(perm); else s.delete(perm);
        next[r.value] = s;
      }
      return next;
    });
  };

  const hasChanges = () => {
    for (const r of ROLES) {
      const a = permMap[r.value] || new Set();
      const b = original[r.value] || new Set();
      if (a.size !== b.size) return true;
      for (const p of a) if (!b.has(p)) return true;
    }
    return false;
  };

  const save = async () => {
    setSaving(true);
    try {
      // Compute diff: deletions and insertions
      const toDelete: { role: string; permission: string }[] = [];
      const toInsert: { role: string; permission: string }[] = [];

      for (const r of ROLES) {
        const curr = permMap[r.value] || new Set();
        const orig = original[r.value] || new Set();
        for (const p of orig) if (!curr.has(p)) toDelete.push({ role: r.value, permission: p });
        for (const p of curr) if (!orig.has(p)) toInsert.push({ role: r.value, permission: p });
      }

      // Execute deletions
      for (const d of toDelete) {
        await (supabase
          .from('role_permissions' as any)
          .delete()
          .eq('role', d.role)
          .eq('permission', d.permission) as any);
      }

      // Execute insertions
      if (toInsert.length > 0) {
        const { error } = await (supabase
          .from('role_permissions' as any)
          .insert(toInsert) as any);
        if (error) throw error;
      }

      toast.success(`Permissões salvas (${toInsert.length} adicionadas, ${toDelete.length} removidas)`);
      await loadPermissions();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Permissões por Perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Defina quais relatórios e ações cada perfil pode acessar
          </p>
        </div>
        <Button onClick={save} disabled={saving || !hasChanges()} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[200px] sticky left-0 bg-muted/30 z-10">
                  Módulo / Ação
                </th>
                {ROLES.map(r => (
                  <th key={r.value} className="px-3 py-3 text-center min-w-[90px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{r.label}</span>
                      <Checkbox
                        checked={ALL_PERMISSION_KEYS.every(p => permMap[r.value]?.has(p))}
                        onCheckedChange={(checked) => toggleAllForRole(r.value, !!checked)}
                        className="h-3.5 w-3.5"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MODULES.map(mod => (
                <>
                  <tr key={mod.module} className="bg-muted/10 border-t">
                    <td colSpan={ROLES.length + 1} className="px-4 py-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {mod.label}
                      </span>
                    </td>
                  </tr>
                  {mod.permissions.map(perm => {
                    const allChecked = ROLES.every(r => permMap[r.value]?.has(perm.key));
                    return (
                      <tr key={perm.key} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 sticky left-0 bg-background z-10">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allChecked}
                              onCheckedChange={(checked) => toggleAllForPerm(perm.key, !!checked)}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-sm">{perm.label}</span>
                          </div>
                        </td>
                        {ROLES.map(r => (
                          <td key={r.value} className="px-3 py-2.5 text-center">
                            <Checkbox
                              checked={permMap[r.value]?.has(perm.key) || false}
                              onCheckedChange={() => toggle(r.value, perm.key)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
