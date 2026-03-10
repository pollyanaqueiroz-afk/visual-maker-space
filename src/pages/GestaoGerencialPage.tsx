import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Users, Search, UserCheck, ChevronRight, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface UserInfo {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
}

interface ManagerAssignment {
  user_id: string;
  manager_id: string;
}

const MANAGER_ROLES = ['gerente_cs', 'gerente_implantacao', 'admin'];

const roleLabelMap: Record<string, string> = {
  admin: 'Admin',
  gerente_cs: 'Gerente CS',
  gerente_implantacao: 'Gerente Implantação',
  cs: 'CS',
  implantacao: 'Implantação',
  member: 'Membro',
  designer: 'Designer',
  cliente: 'Cliente',
  analista_implantacao: 'Analista Implantação',
};

export default function GestaoGerencialPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState<UserInfo | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSubordinates, setPendingSubordinates] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'name' | 'email' | 'role' | 'members'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, assignmentsRes] = await Promise.all([
        supabase.functions.invoke('manage-users', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          body: undefined,
        }).then(async (res) => {
          // Fallback: use the edge function with action query param
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=list`,
            {
              headers: {
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
            }
          );
          return response.json();
        }),
        supabase.from('user_managers' as any).select('*'),
      ]);

      setUsers(usersRes.users || []);
      setAssignments((assignmentsRes.data || []) as unknown as ManagerAssignment[]);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const managersRaw = users.filter(u => u.roles.some(r => MANAGER_ROLES.includes(r)));
  const nonManagerUsers = users.filter(u => !u.roles.some(r => MANAGER_ROLES.includes(r)));

  const getSubordinates = (managerId: string) => {
    const subIds = assignments.filter(a => a.manager_id === managerId).map(a => a.user_id);
    return users.filter(u => subIds.includes(u.id));
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const managers = [...managersRaw].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'name': return dir * a.display_name.localeCompare(b.display_name);
      case 'email': return dir * a.email.localeCompare(b.email);
      case 'role': return dir * (a.roles.join(',').localeCompare(b.roles.join(',')));
      case 'members': return dir * (getSubordinates(a.id).length - getSubordinates(b.id).length);
      default: return 0;
    }
  });

  const openManagerDialog = (manager: UserInfo) => {
    setSelectedManager(manager);
    const currentSubs = assignments.filter(a => a.manager_id === manager.id).map(a => a.user_id);
    setPendingSubordinates(new Set(currentSubs));
    setSearch('');
    setDialogOpen(true);
  };

  const toggleSubordinate = (userId: string) => {
    setPendingSubordinates(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const saveAssignments = async () => {
    if (!selectedManager) return;
    setSaving(true);
    try {
      // Remove existing assignments for this manager
      await (supabase.from('user_managers' as any) as any)
        .delete()
        .eq('manager_id', selectedManager.id);

      // Insert new ones
      if (pendingSubordinates.size > 0) {
        const rows = Array.from(pendingSubordinates).map(uid => ({
          user_id: uid,
          manager_id: selectedManager.id,
        }));
        const { error } = await (supabase.from('user_managers' as any) as any).insert(rows);
        if (error) throw error;
      }

      toast.success('Vínculos atualizados com sucesso');
      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      if (err?.message?.includes('unique') || err?.code === '23505') {
        toast.error('Um usuário já está vinculado a outro gerente. Remova o vínculo anterior primeiro.');
      } else {
        toast.error('Erro ao salvar vínculos');
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = nonManagerUsers.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gestão Gerencial</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vincule membros da equipe aos seus gerentes responsáveis
        </p>
      </div>

      {managers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum gerente encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Atribua o perfil "Gerente CS" ou "Gerente Implantação" a um usuário
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                    <span className="inline-flex items-center">Nome <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                    <span className="inline-flex items-center">E-mail <SortIcon col="email" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('role')}>
                    <span className="inline-flex items-center">Perfil <SortIcon col="role" /></span>
                  </TableHead>
                  <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('members')}>
                    <span className="inline-flex items-center justify-center">Membros vinculados <SortIcon col="members" /></span>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map(manager => {
                  const subs = getSubordinates(manager.id);
                  return (
                    <TableRow
                      key={manager.id}
                      className="cursor-pointer group"
                      onClick={() => openManagerDialog(manager)}
                    >
                      <TableCell className="font-medium">{manager.display_name}</TableCell>
                      <TableCell className="text-muted-foreground">{manager.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {manager.roles.map(r => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {roleLabelMap[r] || r}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <UserCheck className="h-4 w-4" />
                          <span>{subs.length}</span>
                        </div>
                        {subs.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1 justify-center">
                            {subs.slice(0, 3).map(s => (
                              <Badge key={s.id} variant="outline" className="text-[10px] font-normal">
                                {s.display_name}
                              </Badge>
                            ))}
                            {subs.length > 3 && (
                              <Badge variant="outline" className="text-[10px] font-normal">
                                +{subs.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog to assign subordinates */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gerenciar equipe de {selectedManager?.display_name}
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const checked = pendingSubordinates.has(user.id);
                    // Check if already assigned to another manager
                    const otherManager = assignments.find(
                      a => a.user_id === user.id && a.manager_id !== selectedManager?.id
                    );
                    const otherManagerUser = otherManager
                      ? managers.find(m => m.id === otherManager.manager_id)
                      : null;

                    return (
                      <TableRow
                        key={user.id}
                        className="cursor-pointer"
                        onClick={() => toggleSubordinate(user.id)}
                      >
                        <TableCell>
                          <Checkbox checked={checked} />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{user.display_name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.roles.map(r => (
                              <Badge key={r} variant="outline" className="text-[10px] w-fit">
                                {roleLabelMap[r] || r}
                              </Badge>
                            ))}
                            {otherManagerUser && !checked && (
                              <span className="text-[10px] text-destructive">
                                Vinculado a {otherManagerUser.display_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {pendingSubordinates.size} selecionado{pendingSubordinates.size !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveAssignments} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar vínculos'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
