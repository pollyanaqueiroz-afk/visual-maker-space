import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TablePagination from '@/components/carteira/TablePagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Search, Pencil, Check, X, Users, Plus, Loader2, Filter } from 'lucide-react';
import { toast } from 'sonner';

type ClientRecord = {
  id: string;
  id_curseduca: string | null;
  nome: string | null;
  email: string | null;
  email_alternativo: string | null;
  telefone_alternativo: string | null;
  plano: string | null;
  cs_atual: string | null;
  status_financeiro: string | null;
  status_curseduca: string | null;
  indice_fidelidade: number | null;
  data_criacao: string | null;
};

const EMPTY_FORM = {
  id_curseduca: '',
  nome: '',
  email: '',
  email_alternativo: '',
  telefone_alternativo: '',
  plano: '',
  cs_atual: '',
  status_financeiro: '',
  status_curseduca: '',
};

const PER_PAGE = 50;

export default function CadastroTab() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ nome: '', email: '', email_alternativo: '', telefone_alternativo: '' });
  const [saving, setSaving] = useState(false);

  // New client dialog
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Filters
  const [filterPlano, setFilterPlano] = useState<string>('all');
  const [filterCs, setFilterCs] = useState<string>('all');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id, id_curseduca, nome, email, email_alternativo, telefone_alternativo, plano, cs_atual, status_financeiro, status_curseduca, indice_fidelidade, data_criacao')
      .order('nome', { ascending: true });
    if (!error && data) {
      setClients(data as ClientRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const filtered = useMemo(() => {
    let result = clients;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.nome?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.id_curseduca?.toLowerCase().includes(q)
      );
    }
    if (filterPlano !== 'all') {
      result = result.filter(c => c.plano === filterPlano);
    }
    if (filterCs !== 'all') {
      result = result.filter(c => c.cs_atual === filterCs);
    }
    return result;
  }, [clients, search, filterPlano, filterCs]);

  // Unique values for filter dropdowns
  const uniquePlanos = useMemo(() => [...new Set(clients.map(c => c.plano).filter(Boolean))].sort() as string[], [clients]);
  const uniqueCs = useMemo(() => [...new Set(clients.map(c => c.cs_atual).filter(Boolean))].sort() as string[], [clients]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  useEffect(() => { setPage(1); }, [search]);

  const startEdit = (c: ClientRecord) => {
    setEditingId(c.id);
    setEditData({
      nome: c.nome || '',
      email: c.email || '',
      email_alternativo: c.email_alternativo || '',
      telefone_alternativo: c.telefone_alternativo || '',
    });
  };

  const cancelEdit = () => { setEditingId(null); };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await supabase
      .from('clients')
      .update({
        nome: editData.nome || null,
        email: editData.email || null,
        email_alternativo: editData.email_alternativo || null,
        telefone_alternativo: editData.telefone_alternativo || null,
      })
      .eq('id', editingId);

    if (error) {
      toast.error('Erro ao salvar alterações');
    } else {
      toast.success('Cadastro atualizado');
      setClients(prev => prev.map(c =>
        c.id === editingId
          ? { ...c, nome: editData.nome || null, email: editData.email || null, email_alternativo: editData.email_alternativo || null, telefone_alternativo: editData.telefone_alternativo || null }
          : c
      ));
    }
    setSaving(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newForm.id_curseduca.trim()) {
      toast.error('ID Curseduca é obrigatório');
      return;
    }
    setCreating(true);
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(newForm)) {
      if (v.trim()) payload[k] = v.trim();
    }
    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select('id, id_curseduca, nome, email, email_alternativo, telefone_alternativo, plano, cs_atual, status_financeiro, status_curseduca, indice_fidelidade, data_criacao')
      .single();

    if (error) {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    } else if (data) {
      toast.success('Cliente criado com sucesso');
      setClients(prev => [data as ClientRecord, ...prev]);
      setShowNew(false);
      setNewForm(EMPTY_FORM);
    }
    setCreating(false);
  };

  if (loading) return <TableSkeleton rows={10} columns={7} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email ou ID..."
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="secondary" className="text-xs">{filtered.length} clientes</Badge>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* New Client Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ID Curseduca *</Label>
                <Input value={newForm.id_curseduca} onChange={e => setNewForm(p => ({ ...p, id_curseduca: e.target.value }))} placeholder="Ex: 12345" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={newForm.nome} onChange={e => setNewForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email Alternativo</Label>
                <Input type="email" value={newForm.email_alternativo} onChange={e => setNewForm(p => ({ ...p, email_alternativo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Telefone</Label>
                <Input value={newForm.telefone_alternativo} onChange={e => setNewForm(p => ({ ...p, telefone_alternativo: e.target.value }))} placeholder="(11) 99999-0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Input value={newForm.plano} onChange={e => setNewForm(p => ({ ...p, plano: e.target.value }))} placeholder="Premium, Basic..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">CS Atual</Label>
                <Input value={newForm.cs_atual} onChange={e => setNewForm(p => ({ ...p, cs_atual: e.target.value }))} placeholder="email do CS" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status Financeiro</Label>
                <Input value={newForm.status_financeiro} onChange={e => setNewForm(p => ({ ...p, status_financeiro: e.target.value }))} placeholder="Adimplente, Inadimplente" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status Curseduca</Label>
              <Input value={newForm.status_curseduca} onChange={e => setNewForm(p => ({ ...p, status_curseduca: e.target.value }))} placeholder="Ativo, Inativo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Cadastro de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
            className="px-4 py-2 border-b border-border/40"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] uppercase">ID Curseduca</TableHead>
                <TableHead className="text-[11px] uppercase">Nome</TableHead>
                <TableHead className="text-[11px] uppercase">Email</TableHead>
                <TableHead className="text-[11px] uppercase">Email Alternativo</TableHead>
                <TableHead className="text-[11px] uppercase">Telefone Alternativo</TableHead>
                <TableHead className="text-[11px] uppercase">Plano</TableHead>
                <TableHead className="text-[11px] uppercase">CS Atual</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(c => (
                  <TableRow key={c.id} className="group">
                    <TableCell className="font-mono text-xs">{c.id_curseduca || '—'}</TableCell>
                    {editingId === c.id ? (
                      <>
                        <TableCell>
                          <Input value={editData.nome} onChange={e => setEditData(p => ({ ...p, nome: e.target.value }))} className="h-7 text-xs w-40" disabled={saving} />
                        </TableCell>
                        <TableCell>
                          <Input value={editData.email} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} className="h-7 text-xs w-44" disabled={saving} />
                        </TableCell>
                        <TableCell>
                          <Input value={editData.email_alternativo} onChange={e => setEditData(p => ({ ...p, email_alternativo: e.target.value }))} className="h-7 text-xs w-44" disabled={saving} />
                        </TableCell>
                        <TableCell>
                          <Input value={editData.telefone_alternativo} onChange={e => setEditData(p => ({ ...p, telefone_alternativo: e.target.value }))} className="h-7 text-xs w-36" disabled={saving} />
                        </TableCell>
                        <TableCell className="text-xs">{c.plano || '—'}</TableCell>
                        <TableCell className="text-xs">{c.cs_atual || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit} disabled={saving}>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-xs font-medium">{c.nome || '—'}</TableCell>
                        <TableCell className="text-xs">{c.email || '—'}</TableCell>
                        <TableCell className="text-xs">{c.email_alternativo || '—'}</TableCell>
                        <TableCell className="text-xs">{c.telefone_alternativo || '—'}</TableCell>
                        <TableCell className="text-xs">{c.plano || '—'}</TableCell>
                        <TableCell className="text-xs">{c.cs_atual || '—'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={filtered.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
            className="px-4 py-2 border-t border-border/40"
          />
        </CardContent>
      </Card>
    </div>
  );
}
