import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, Search, Loader2, CalendarDays, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CancelRiskClient {
  client_url: string;
  client_name: string | null;
  meeting_date: string;
  loyalty_reason: string | null;
  meeting_title: string;
  created_by_email: string | null;
}

export default function FunilCancelamentoPage() {
  const [clients, setClients] = useState<CancelRiskClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      // Get all completed meetings with loyalty_index = 1
      const { data, error } = await (supabase
        .from('meetings' as any)
        .select('client_url, client_name, meeting_date, loyalty_reason, title, created_by')
        .eq('loyalty_index', 1)
        .eq('status', 'completed')
        .order('meeting_date', { ascending: false }) as any);

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
            client_url: m.client_url || '',
            client_name: m.client_name,
            meeting_date: m.meeting_date,
            loyalty_reason: m.loyalty_reason,
            meeting_title: m.title,
            created_by_email: null,
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
    })();
  }, []);

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

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold text-foreground">{clients.length}</span>
            <span className="text-[11px] text-muted-foreground">Clientes em Risco</span>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row, idx) => (
                  <TableRow key={row.client_url || idx}>
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
                      <span className="text-sm text-muted-foreground">
                        {row.loyalty_reason || '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {row.created_by_email || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-destructive/20 text-destructive">Risco Crítico</Badge>
                    </TableCell>
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
