import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import TablePagination from '@/components/carteira/TablePagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Search, Pencil, X, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';

type Client = {
  id: string;
  id_curseduca: string | null;
  cliente: string | null;
  cs_atual: string | null;
  cs_anterior: string | null;
  fatura: string | null;
  plano: string | null;
  data_da_carga: string | null;
};

type UserProfile = { user_id: string; email: string | null; display_name: string | null };

const PER_PAGE = 50;

export default function ClientesTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlano, setFilterPlano] = useState('__all__');
  const [filterCsAtual, setFilterCsAtual] = useState('__all__');
  const [filterCsAnterior, setFilterCsAnterior] = useState('__all__');
  const [page, setPage] = useState(1);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuery, setEditQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Bulk move state
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkMode, setBulkMode] = useState<'plano' | 'cs'>('plano');
  const [bulkSource, setBulkSource] = useState('');
  const [bulkTargetQuery, setBulkTargetQuery] = useState('');
  const [bulkTargetName, setBulkTargetName] = useState('');
  const [showBulkSuggestions, setShowBulkSuggestions] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const bulkSugRef = useRef<HTMLDivElement>(null);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('cliente', { ascending: true });
    if (!error && data) {
      setClients(data as Client[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClients(); }, []);

  // Fetch user profiles for autocomplete
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users-api`, {
          headers: {
            'Authorization': 'Basic WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq',
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const json = await res.json();
          setUserProfiles((json.users || []).map((u: any) => ({
            user_id: u.id,
            email: u.email,
            display_name: u.display_name,
          })));
        }
      } catch (e) {
        console.error('Failed to fetch users', e);
      }
    };
    fetchProfiles();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (bulkSugRef.current && !bulkSugRef.current.contains(e.target as Node)) setShowBulkSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filterUsersFor = (query: string) => {
    const q = query.toLowerCase();
    if (!q) return userProfiles.slice(0, 10);
    return userProfiles.filter(u =>
      u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    ).slice(0, 10);
  };

  const filteredUsers = useMemo(() => filterUsersFor(editQuery), [editQuery, userProfiles]);
  const bulkFilteredUsers = useMemo(() => filterUsersFor(bulkTargetQuery), [bulkTargetQuery, userProfiles]);

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setEditQuery(client.cs_atual || '');
    setShowSuggestions(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditQuery('');
    setShowSuggestions(false);
  };

  const selectUser = async (clientId: string, displayName: string) => {
    setSaving(true);
    const client = clients.find(c => c.id === clientId);
    const oldCs = client?.cs_atual || null;
    const { error } = await supabase
      .from('clients')
      .update({ cs_atual: displayName, cs_anterior: oldCs } as any)
      .eq('id', clientId);
    if (error) {
      toast.error('Erro ao atualizar CS');
    } else {
      toast.success('CS atualizado');
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, cs_atual: displayName, cs_anterior: oldCs } : c));
    }
    setSaving(false);
    cancelEdit();
  };

  // Bulk move
  const openBulkDialog = () => {
    setBulkMode('plano');
    setBulkSource('');
    setBulkTargetQuery('');
    setBulkTargetName('');
    setBulkDialog(true);
  };

  // moved bulkSourceOptions below planos/csAtuais declarations

  const executeBulkMove = async () => {
    if (!bulkSource || !bulkTargetName) {
      toast.error('Selecione a origem e o novo CS');
      return;
    }

    setBulkSaving(true);

    // Find affected clients
    const affected = clients.filter(c => {
      if (bulkMode === 'plano') return c.plano === bulkSource;
      return c.cs_atual === bulkSource;
    });

    if (affected.length === 0) {
      toast.error('Nenhum cliente encontrado com esse filtro');
      setBulkSaving(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process in batches of 50
    for (let i = 0; i < affected.length; i += 50) {
      const batch = affected.slice(i, i + 50);
      const ids = batch.map(c => c.id);

      // For each client, cs_anterior = old cs_atual
      // We need to update individually to set cs_anterior correctly per client
      for (const client of batch) {
        const { error } = await supabase
          .from('clients')
          .update({ cs_atual: bulkTargetName, cs_anterior: client.cs_atual } as any)
          .eq('id', client.id);
        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      }
    }

    // Update local state
    setClients(prev => prev.map(c => {
      const isAffected = affected.find(a => a.id === c.id);
      if (isAffected) {
        return { ...c, cs_anterior: c.cs_atual, cs_atual: bulkTargetName };
      }
      return c;
    }));

    toast.success(`${successCount} clientes movidos para ${bulkTargetName}${errorCount > 0 ? ` (${errorCount} erros)` : ''}`);
    setBulkSaving(false);
    setBulkDialog(false);
  };

  // Extract unique values for filters
  const planos = useMemo(() => [...new Set(clients.map(c => c.plano).filter(Boolean))].sort() as string[], [clients]);
  const csAtuais = useMemo(() => [...new Set(clients.map(c => c.cs_atual).filter(Boolean))].sort() as string[], [clients]);
  const csAnteriores = useMemo(() => [...new Set(clients.map(c => c.cs_anterior).filter(Boolean))].sort() as string[], [clients]);

  const bulkSourceOptions = useMemo(() => {
    if (bulkMode === 'plano') return planos;
    return csAtuais;
  }, [bulkMode, planos, csAtuais]);

  const filtered = useMemo(() => {
    let result = clients;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.cliente?.toLowerCase().includes(q) ||
        c.id_curseduca?.toLowerCase().includes(q) ||
        c.cs_atual?.toLowerCase().includes(q)
      );
    }
    if (filterPlano !== '__all__') result = result.filter(c => c.plano === filterPlano);
    if (filterCsAtual !== '__all__') result = result.filter(c => c.cs_atual === filterCsAtual);
    if (filterCsAnterior !== '__all__') result = result.filter(c => c.cs_anterior === filterCsAnterior);
    return result;
  }, [clients, search, filterPlano, filterCsAtual, filterCsAnterior]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Count affected for preview
  const bulkAffectedCount = useMemo(() => {
    if (!bulkSource) return 0;
    return clients.filter(c => {
      if (bulkMode === 'plano') return c.plano === bulkSource;
      return c.cs_atual === bulkSource;
    }).length;
  }, [bulkSource, bulkMode, clients]);

  useEffect(() => { setPage(1); }, [search, filterPlano, filterCsAtual, filterCsAnterior]);

  const formatFatura = (v: string | null) => {
    if (!v) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (loading) return <TableSkeleton rows={10} columns={7} />;

  return (
    <div className="space-y-4">
      {/* Filters + Bulk action */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou ID..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterPlano} onValueChange={setFilterPlano}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os planos</SelectItem>
            {planos.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCsAtual} onValueChange={setFilterCsAtual}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="CS Atual" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos CS Atual</SelectItem>
            {csAtuais.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCsAnterior} onValueChange={setFilterCsAnterior}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="CS Anterior" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos CS Anterior</SelectItem>
            {csAnteriores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={openBulkDialog}>
          <ArrowRightLeft className="h-3.5 w-3.5" /> Mover em lote
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 p-0">
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
                <TableHead>ID Curseduca</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>CS Atual</TableHead>
                <TableHead>CS Anterior</TableHead>
                <TableHead className="text-right">Fatura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                paged.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.id_curseduca || '—'}</TableCell>
                    <TableCell className="font-medium">{c.cliente || '—'}</TableCell>
                    <TableCell>{c.plano || '—'}</TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <div className="relative" ref={suggestionsRef}>
                          <div className="flex items-center gap-1">
                            <Input
                              value={editQuery}
                              onChange={e => {
                                setEditQuery(e.target.value);
                                setShowSuggestions(true);
                              }}
                              onFocus={() => setShowSuggestions(true)}
                              placeholder="Buscar CS..."
                              className="h-7 text-xs w-40"
                              autoFocus
                              disabled={saving}
                            />
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {showSuggestions && filteredUsers.length > 0 && (
                            <div className="absolute z-50 top-full left-0 mt-1 w-64 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                              {filteredUsers.map(u => (
                                <button
                                  key={u.user_id}
                                  type="button"
                                  className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent text-sm"
                                  onClick={() => selectUser(c.id, u.display_name || u.email || '')}
                                >
                                  <span className="font-medium text-xs">{u.display_name || u.email}</span>
                                  {u.display_name && <span className="text-[10px] text-muted-foreground">{u.email}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span>{c.cs_atual || '—'}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => startEdit(c)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{c.cs_anterior || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatFatura(c.fatura)}</TableCell>
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

      {/* Bulk Move Dialog */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Clientes em Lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mover por</Label>
              <Select value={bulkMode} onValueChange={v => { setBulkMode(v as any); setBulkSource(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plano">Plano</SelectItem>
                  <SelectItem value="cs">CS Atual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{bulkMode === 'plano' ? 'Selecione o plano' : 'Selecione o CS atual'}</Label>
              <Select value={bulkSource} onValueChange={setBulkSource}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {bulkSourceOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              {bulkSource && (
                <p className="text-xs text-muted-foreground">
                  <Badge variant="secondary" className="mr-1">{bulkAffectedCount}</Badge>
                  clientes serão movidos
                </p>
              )}
            </div>

            <div className="space-y-1.5 relative" ref={bulkSugRef}>
              <Label>Novo CS responsável</Label>
              <Input
                value={bulkTargetQuery}
                onChange={e => {
                  setBulkTargetQuery(e.target.value);
                  setBulkTargetName('');
                  setShowBulkSuggestions(true);
                }}
                onFocus={() => setShowBulkSuggestions(true)}
                placeholder="Buscar por nome..."
                autoComplete="off"
              />
              {bulkTargetName && (
                <Badge variant="default" className="mt-1">{bulkTargetName}</Badge>
              )}
              {showBulkSuggestions && bulkFilteredUsers.length > 0 && !bulkTargetName && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                  {bulkFilteredUsers.map(u => (
                    <button
                      key={u.user_id}
                      type="button"
                      className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent text-sm"
                      onClick={() => {
                        const name = u.display_name || u.email || '';
                        setBulkTargetName(name);
                        setBulkTargetQuery(name);
                        setShowBulkSuggestions(false);
                      }}
                    >
                      <span className="font-medium">{u.display_name || u.email}</span>
                      {u.display_name && <span className="text-xs text-muted-foreground">{u.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <strong>Nota:</strong> O CS Anterior será automaticamente preenchido com o valor que estava no CS Atual antes da movimentação.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)} disabled={bulkSaving}>Cancelar</Button>
            <Button onClick={executeBulkMove} disabled={bulkSaving || !bulkSource || !bulkTargetName}>
              {bulkSaving ? 'Movendo...' : `Mover ${bulkAffectedCount} clientes`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
