import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { AlertTriangle, Search, Loader2, CalendarDays, User, Pencil, Save, StickyNote } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';

const FUNIL_STATUSES = [
  { value: 'risco', label: 'Risco Crítico', color: 'bg-destructive/20 text-destructive' },
  { value: 'em_tratamento', label: 'Em Tratamento', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  { value: 'resolvido', label: 'Resolvido', color: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  { value: 'cancelou', label: 'Cancelou', color: 'bg-muted text-muted-foreground' },
];

interface CancelRiskClient {
  meeting_id: string;
  client_url: string;
  client_name: string | null;
  meeting_date: string;
  loyalty_reason: string | null;
  meeting_title: string;
  created_by_email: string | null;
  funil_status: string | null;
  funil_notas: string | null;
}

export default function FunilCancelamentoPage() {
  const [clients, setClients] = useState<CancelRiskClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('funil.edit');

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, client_url, client_name, meeting_date, loyalty_reason, title, created_by, funil_status, funil_notas')
      .eq('loyalty_index', 1)
      .eq('status', 'completed')
      .order('meeting_date', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar funil de cancelamento');
      setLoading(false);
      return;
    }

    const meetings = (data || []) as any[];

    // Deduplicate by client_url, keeping the most recent meeting
    const seen = new Map<string, CancelRiskClient>();
    for (const m of meetings) {
      const key = m.client_url || m.client_name || m.title;
      if (!seen.has(key)) {
        seen.set(key, {
          meeting_id: m.id,
          client_url: m.client_url || '',
          client_name: m.client_name,
          meeting_date: m.meeting_date,
          loyalty_reason: m.loyalty_reason,
          meeting_title: m.title,
          created_by_email: null,
          funil_status: m.funil_status,
          funil_notas: m.funil_notas,
        });
      }
    }

    // Get CS names from profiles
    const userIds = [...new Set(meetings.map((m: any) => m.created_by).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name || p.email]));

      for (const m of meetings) {
        const key = m.client_url || m.client_name || m.title;
        const entry = seen.get(key);
        if (entry && !entry.created_by_email && m.created_by) {
          entry.created_by_email = profileMap.get(m.created_by) || null;
        }
      }
    }

    setClients(Array.from(seen.values()));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateMeeting = async (meetingId: string, field: string, value: string | null) => {
    const { error } = await (supabase
      .from('meetings' as any)
      .update({ [field]: value } as any)
      .eq('id', meetingId) as any);

    if (error) {
      toast.error('Erro ao salvar alteração');
      return false;
    }
    return true;
  };

  const handleStatusChange = async (row: CancelRiskClient, newStatus: string) => {
    const ok = await updateMeeting(row.meeting_id, 'funil_status', newStatus);
    if (ok) {
      setClients(prev => prev.map(c => c.meeting_id === row.meeting_id ? { ...c, funil_status: newStatus } : c));
      toast.success('Status atualizado');
    }
  };

  const handleReasonSave = async (row: CancelRiskClient, newReason: string) => {
    const ok = await updateMeeting(row.meeting_id, 'loyalty_reason', newReason);
    if (ok) {
      setClients(prev => prev.map(c => c.meeting_id === row.meeting_id ? { ...c, loyalty_reason: newReason } : c));
      toast.success('Motivo atualizado');
    }
  };

  const handleNotasSave = async (row: CancelRiskClient, newNotas: string) => {
    const ok = await updateMeeting(row.meeting_id, 'funil_notas', newNotas || null);
    if (ok) {
      setClients(prev => prev.map(c => c.meeting_id === row.meeting_id ? { ...c, funil_notas: newNotas || null } : c));
      toast.success('Observações salvas');
    }
  };

  const getStatusBadge = (status: string | null) => {
    const s = FUNIL_STATUSES.find(fs => fs.value === status);
    if (!s) return <Badge className="bg-destructive/20 text-destructive">Risco Crítico</Badge>;
    return <Badge className={s.color}>{s.label}</Badge>;
  };

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      (c.client_name || '').toLowerCase().includes(q) ||
      (c.client_url || '').toLowerCase().includes(q) ||
      (c.created_by_email || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Funil de Cancelamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Clientes com índice de fidelidade igual a 1 em reuniões concluídas — risco de cancelamento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 max-w-2xl">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-foreground">{clients.length}</span>
            <span className="text-[11px] text-muted-foreground">Total em Risco</span>
          </CardContent>
        </Card>
        {FUNIL_STATUSES.slice(0, 3).map(s => {
          const count = clients.filter(c => (c.funil_status || 'risco') === s.value).length;
          return (
            <Card key={s.value}>
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <span className="text-2xl font-bold text-foreground">{count}</span>
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Clientes no Funil ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum cliente com índice de fidelidade 1 encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Última Reunião</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>CS Responsável</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {canEdit && <TableHead>Observações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, idx) => (
                  <TableRow key={row.meeting_id || idx}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {row.client_name && (
                          <span className="text-sm font-medium text-foreground">{row.client_name}</span>
                        )}
                        {row.client_url ? (
                          <a
                            href={row.client_url.startsWith('http') ? row.client_url : `https://${row.client_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline truncate max-w-[200px]"
                          >
                            {row.client_url}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem URL</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {format(parseISO(row.meeting_date), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <EditableReasonCell value={row.loyalty_reason || ''} onSave={(v) => handleReasonSave(row, v)} />
                      ) : (
                        <span className="text-sm text-muted-foreground">{row.loyalty_reason || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.created_by_email || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {canEdit ? (
                        <Select value={row.funil_status || 'risco'} onValueChange={(v) => handleStatusChange(row, v)}>
                          <SelectTrigger className="h-7 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FUNIL_STATUSES.map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(row.funil_status)
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <EditableNotasCell value={row.funil_notas || ''} onSave={(v) => handleNotasSave(row, v)} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EditableReasonCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button onClick={() => { setDraft(value); setEditing(true); }} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground group">
        <span>{value || '—'}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input value={draft} onChange={e => setDraft(e.target.value)} className="h-7 text-xs w-[160px]" autoFocus onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }} />
      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { onSave(draft); setEditing(false); }}>
        <Save className="h-3 w-3" />
      </Button>
    </div>
  );
}

function EditableNotasCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o && draft !== value) onSave(draft); setOpen(o); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <StickyNote className="h-3 w-3" />
          {value ? 'Ver notas' : 'Adicionar'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Observações sobre este caso..."
          rows={4}
          className="text-sm"
        />
        <Button size="sm" className="mt-2 w-full h-7 text-xs" onClick={() => { onSave(draft); setOpen(false); }}>
          <Save className="h-3 w-3 mr-1" /> Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
