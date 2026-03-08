import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Trash2, Search, Users, ShieldCheck, Plus, Loader2, LogIn, AlertTriangle } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

const ALL_ROLES = [
  { value: 'admin', label: 'Admin', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  { value: 'gerente_implantacao', label: 'Gerente Implantação', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
  { value: 'gerente_cs', label: 'Gerente CS', color: 'bg-violet-500/10 text-violet-600 border-violet-200' },
  { value: 'implantacao', label: 'Implantação', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { value: 'cs', label: 'CS', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  { value: 'designer', label: 'Designer', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  { value: 'member', label: 'Membro', color: 'bg-secondary text-secondary-foreground border-border' },
  { value: 'cliente', label: 'Cliente', color: 'bg-cyan-500/10 text-cyan-600 border-cyan-200' },
];

function getRoleConfig(role: string) {
  return ALL_ROLES.find(r => r.value === role) || { value: role, label: role, color: 'bg-muted text-muted-foreground border-border' };
}

export default function AdminUsersPage() {
  const { user, signOut } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [search, setSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [addRoleUser, setAddRoleUser] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRoleOpen, setBulkRoleOpen] = useState(false);
  const [bulkRole, setBulkRole] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [filterRole, setFilterRole] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users?action=list', {
        method: 'GET',
      });
      if (error) {
        // Check for session/auth errors
        const msg = typeof error === 'object' ? (error as any)?.message || JSON.stringify(error) : String(error);
        if (msg.includes('Unauthorized') || msg.includes('401') || msg.includes('session')) {
          setSessionExpired(true);
          return;
        }
        throw error;
      }
      if (data?.error === 'Unauthorized') {
        setSessionExpired(true);
        return;
      }
      setUsers(data.users || []);
    } catch (err: any) {
      const msg = err?.message || 'Erro desconhecido';
      if (msg.includes('Unauthorized') || msg.includes('401')) {
        setSessionExpired(true);
      } else {
        toast.error('Erro ao carregar usuários: ' + msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleRole = async (userId: string, role: string, hasRole: boolean) => {
    try {
      const action = hasRole ? 'remove-role' : 'add-role';
      const { error } = await supabase.functions.invoke(`manage-users?action=${action}`, {
        body: { user_id: userId, role },
      });
      if (error) throw error;
      toast.success(hasRole ? `Papel "${getRoleConfig(role).label}" removido` : `Papel "${getRoleConfig(role).label}" adicionado`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleAddRole = async () => {
    if (!addRoleUser || !selectedRole) return;
    const previousRoles = [...addRoleUser.roles];
    try {
      for (const r of previousRoles) {
        await supabase.functions.invoke(`manage-users?action=remove-role`, {
          body: { user_id: addRoleUser.id, role: r },
        });
      }
      const { error } = await supabase.functions.invoke(`manage-users?action=add-role`, {
        body: { user_id: addRoleUser.id, role: selectedRole },
      });
      if (error) throw error;
      toast.success(`Perfil alterado para "${getRoleConfig(selectedRole).label}"`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro ao alterar perfil. Restaurando papéis anteriores...');
      for (const r of previousRoles) {
        await supabase.functions.invoke(`manage-users?action=add-role`, {
          body: { user_id: addRoleUser.id, role: r },
        }).catch(() => {});
      }
      await fetchUsers();
    }
    setAddRoleUser(null);
    setSelectedRole('');
  };

  const handleRemoveAllRoles = async () => {
    if (!addRoleUser) return;
    try {
      for (const role of addRoleUser.roles) {
        await supabase.functions.invoke(`manage-users?action=remove-role`, {
          body: { user_id: addRoleUser.id, role },
        });
      }
      toast.success('Perfil removido com sucesso');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    }
    setAddRoleUser(null);
  };

  const handleBulkAssign = async () => {
    if (!bulkRole || selectedIds.size === 0) return;
    setBulkSaving(true);
    const targetUsers = filtered.filter(u => selectedIds.has(u.id));
    const results = await Promise.allSettled(
      targetUsers.map(async (u) => {
        for (const r of u.roles)
          await supabase.functions.invoke('manage-users?action=remove-role', { body: { user_id: u.id, role: r } });
        const { error } = await supabase.functions.invoke('manage-users?action=add-role', { body: { user_id: u.id, role: bulkRole } });
        if (error) throw error;
      })
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    toast.success(`Perfil atribuído a ${ok} usuário(s)${fail > 0 ? `. ${fail} falharam.` : ''}`);
    setBulkSaving(false);
    setBulkRoleOpen(false);
    setBulkRole('');
    setSelectedIds(new Set());
    fetchUsers();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(u => u.id)));
    }
  };

  const handleInvite = async () => {
    const raw = inviteEmail.trim();
    if (!raw) return;
    // Split by commas, semicolons, spaces or newlines
    const emails = raw
      .split(/[\s,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.filter(e => !emailRegex.test(e));
    if (invalid.length > 0) {
      toast.error(`E-mails inválidos: ${invalid.join(', ')}`);
      return;
    }

    const unique = [...new Set(emails)];
    if (unique.length === 0) return;

    setInviting(true);
    let success = 0;
    let errors: string[] = [];

    for (const email of unique) {
      try {
        const { error } = await supabase.functions.invoke('manage-users?action=invite', {
          body: { email },
        });
        if (error) throw error;
        success++;
      } catch (err: any) {
        errors.push(`${email}: ${err.message || 'Erro'}`);
      }
    }

    if (success > 0) toast.success(`${success} convite(s) enviado(s) com sucesso`);
    if (errors.length > 0) toast.error(`Falha em ${errors.length}: ${errors.join('; ')}`);

    setInviteEmail('');
    setInviteOpen(false);
    fetchUsers();
    setInviting(false);
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    try {
      const { error } = await supabase.functions.invoke('manage-users?action=delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      toast.success(`Usuário ${email} removido`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground text-sm">Administre usuários e seus perfis de acesso</p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar usuários</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Insira um ou mais e-mails separados por vírgula, espaço ou um por linha.
              </p>
              <Textarea
                placeholder={"email1@curseduca.com\nemail2@curseduca.com\nemail3@curseduca.com"}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                rows={4}
              />
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="w-full gap-2">
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                {inviting ? 'Enviando...' : 'Enviar Convites'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{users.length}</p>
              <p className="text-[11px] text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        {['admin', 'cs', 'designer', 'implantacao'].map(role => {
          const cfg = getRoleConfig(role);
          const count = users.filter(u => u.roles.includes(role)).length;
          return (
            <Card key={role}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.color.split(' ')[0]}`}>
                  <ShieldCheck className={`h-4 w-4 ${cfg.color.split(' ')[1]}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">{count}</p>
                  <p className="text-[11px] text-muted-foreground">{cfg.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Perfis:</span>
        {ALL_ROLES.map(r => (
          <Badge key={r.value} variant="outline" className={`text-[10px] ${r.color}`}>
            {r.label}
          </Badge>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); }}
          className="pl-9"
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
          <Dialog open={bulkRoleOpen} onOpenChange={setBulkRoleOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Atribuir Perfil
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Atribuir perfil a {selectedIds.size} usuário(s)</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  O perfil anterior de cada usuário será substituído.
                </p>
                <Select value={bulkRole} onValueChange={setBulkRole}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleBulkAssign} disabled={!bulkRole || bulkSaving} className="w-full gap-2">
                  {bulkSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {bulkSaving ? 'Atribuindo...' : 'Atribuir Perfil'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {sessionExpired ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-amber-500/10 p-4">
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold">Sessão expirada</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Sua sessão de autenticação expirou. Faça login novamente para continuar gerenciando os usuários.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={fetchUsers}>
                  Tentar novamente
                </Button>
                <Button onClick={() => signOut()} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Fazer login novamente
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-pulse text-muted-foreground">Carregando usuários...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfis</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = u.id === user?.id;
                  const availableRoles = ALL_ROLES.filter(r => !u.roles.includes(r.value));

                  return (
                    <TableRow key={u.id} className={selectedIds.has(u.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(u.id)}
                          onCheckedChange={() => toggleSelect(u.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.display_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5 flex-wrap items-center">
                          {u.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">sem perfil</span>
                          )}
                          {u.roles.map(role => {
                            const cfg = getRoleConfig(role);
                            const isAdminSelf = role === 'admin' && isSelf;
                            return (
                              <Badge
                                key={role}
                                variant="outline"
                                className={`text-[10px] cursor-pointer hover:opacity-70 transition-opacity ${cfg.color} ${isAdminSelf ? 'cursor-not-allowed opacity-50' : ''}`}
                                onClick={() => !isAdminSelf && (() => { setAddRoleUser(u); setSelectedRole(''); })()}
                                title={isAdminSelf ? 'Não é possível alterar seu próprio admin' : `Clique para alterar perfil`}
                              >
                                {cfg.label} ✎
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {u.last_sign_in_at
                            ? new Date(u.last_sign_in_at).toLocaleDateString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              })
                            : 'Nunca'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {u.roles.length === 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setAddRoleUser(u); setSelectedRole(''); }}
                              title="Definir perfil"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja remover <strong>{u.email}</strong>? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(u.id, u.email || '')}>
                                    Remover
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={!!addRoleUser} onOpenChange={(v) => { if (!v) setAddRoleUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{addRoleUser?.roles.length ? 'Alterar Perfil' : 'Definir Perfil'}</DialogTitle>
          </DialogHeader>
          {addRoleUser && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Usuário: <strong>{addRoleUser.display_name || addRoleUser.email}</strong>
              </p>
              {addRoleUser.roles.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Perfil atual: <Badge variant="outline" className={`text-[10px] ${getRoleConfig(addRoleUser.roles[0]).color}`}>{getRoleConfig(addRoleUser.roles[0]).label}</Badge>
                </p>
              )}
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um perfil..." />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.filter(r => !addRoleUser.roles.includes(r.value)).map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddRole} disabled={!selectedRole} className="w-full">
                {addRoleUser.roles.length > 0 ? 'Alterar Perfil' : 'Definir Perfil'}
              </Button>
              {addRoleUser.roles.length > 0 && (
                <Button variant="outline" onClick={handleRemoveAllRoles} className="w-full text-destructive hover:text-destructive">
                  Remover Perfil
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
