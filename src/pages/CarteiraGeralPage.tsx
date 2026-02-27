import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval, differenceInDays } from 'date-fns';
import {
  Globe, Users, CheckCircle, XCircle, Clock, Star, TrendingUp, Search, Loader2, CalendarDays, Upload,
} from 'lucide-react';
import ImportClientsDialog from '@/components/carteira/ImportClientsDialog';

interface MeetingRow {
  id: string;
  meeting_date: string;
  status: string;
  client_url: string | null;
  client_name: string | null;
  meeting_reason: string | null;
  loyalty_index: number | null;
  duration_minutes: number;
  created_by: string | null;
}

interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface ClientRecord {
  client_url: string;
  client_name: string | null;
  loyalty_index: number | null;
  cs_user_id: string | null;
}

interface ClientRow {
  url: string;
  clientName: string;
  total: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  avgLoyalty: string;
  currentLoyalty: number | null;
  totalHours: number;
  lastMeeting: string;
  daysSinceLast: number;
  responsibles: string[];
  csName: string;
  topReason: string;
}

export default function CarteiraGeralPage() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'total' | 'lastMeeting' | 'loyalty'>('total');
  const [importOpen, setImportOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
      const [meetingsRes, profilesRes, clientsRes] = await Promise.all([
        supabase.from('meetings' as any)
          .select('id, meeting_date, status, client_url, client_name, meeting_reason, loyalty_index, duration_minutes, created_by')
          .order('meeting_date', { ascending: false }) as any,
        supabase.from('profiles').select('user_id, email, display_name'),
        supabase.from('clients' as any).select('client_url, client_name, loyalty_index, cs_user_id') as any,
      ]);

      if (meetingsRes.error) {
        console.error(meetingsRes.error);
        toast.error('Erro ao carregar dados');
      } else {
        setMeetings((meetingsRes.data || []) as MeetingRow[]);
      }

      if (!profilesRes.error && profilesRes.data) {
        setProfiles(profilesRes.data as Profile[]);
      }

      if (!clientsRes.error && clientsRes.data) {
        setClientRecords((clientsRes.data || []) as ClientRecord[]);
      }

      setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const profileMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach(p => { map[p.user_id] = p; });
    return map;
  }, [profiles]);

  const getCreatorLabel = (uid: string | null) => {
    if (!uid) return 'Desconhecido';
    const p = profileMap[uid];
    return p?.display_name || p?.email || uid.slice(0, 8);
  };

  const filtered = useMemo(() => {
    if (periodFilter === 'all') return meetings;
    const now = new Date();
    let start: Date, end: Date;
    if (periodFilter === 'current') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      const prev = subMonths(now, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
    }
    return meetings.filter(m => {
      const d = parseISO(m.meeting_date);
      return isWithinInterval(d, { start, end });
    });
  }, [meetings, periodFilter]);

  const clientRecordMap = useMemo(() => {
    const map: Record<string, ClientRecord> = {};
    clientRecords.forEach(c => { map[c.client_url] = c; });
    return map;
  }, [clientRecords]);

  const clients = useMemo(() => {
    const map: Record<string, {
      url: string; clientName: string; total: number; completed: number; scheduled: number; cancelled: number;
      loyaltySum: number; loyaltyCount: number; totalMinutes: number; lastDate: string;
      responsibles: Set<string>; reasons: Record<string, number>;
    }> = {};

    for (const m of filtered) {
      const url = m.client_url || 'Sem URL';
      if (!map[url]) {
        map[url] = {
          url,
          clientName: m.client_name || '',
          total: 0, completed: 0, scheduled: 0, cancelled: 0,
          loyaltySum: 0, loyaltyCount: 0, totalMinutes: 0, lastDate: '',
          responsibles: new Set(), reasons: {},
        };
      }
      const c = map[url];
      c.total++;
      if (m.client_name && !c.clientName) c.clientName = m.client_name;
      if (m.status === 'completed') { c.completed++; c.totalMinutes += m.duration_minutes; }
      else if (m.status === 'scheduled') c.scheduled++;
      else if (m.status === 'cancelled') c.cancelled++;
      if (m.loyalty_index) { c.loyaltySum += m.loyalty_index; c.loyaltyCount++; }
      if (m.meeting_date > c.lastDate) c.lastDate = m.meeting_date;
      if (m.created_by) c.responsibles.add(m.created_by);
      if (m.meeting_reason) c.reasons[m.meeting_reason] = (c.reasons[m.meeting_reason] || 0) + 1;
    }

    const now = new Date();
    return Object.values(map).map(c => {
      const topReason = Object.entries(c.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
      const cr = clientRecordMap[c.url];
      const csUid = cr?.cs_user_id || null;
      return {
        url: c.url,
        clientName: c.clientName,
        total: c.total,
        completed: c.completed,
        scheduled: c.scheduled,
        cancelled: c.cancelled,
        avgLoyalty: c.loyaltyCount > 0 ? (c.loyaltySum / c.loyaltyCount).toFixed(1) : '—',
        currentLoyalty: cr?.loyalty_index ?? null,
        totalHours: Math.round(c.totalMinutes / 60),
        lastMeeting: c.lastDate,
        daysSinceLast: c.lastDate ? differenceInDays(now, parseISO(c.lastDate)) : 999,
        responsibles: Array.from(c.responsibles).map(uid => getCreatorLabel(uid)),
        csName: getCreatorLabel(csUid),
        topReason,
      } as ClientRow;
    });
  }, [filtered, profileMap, clientRecordMap]);

  const sorted = useMemo(() => {
    let list = clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.url.toLowerCase().includes(q) ||
        c.clientName.toLowerCase().includes(q) ||
        c.responsibles.some(r => r.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'total') return [...list].sort((a, b) => b.total - a.total);
    if (sortBy === 'lastMeeting') return [...list].sort((a, b) => a.daysSinceLast - b.daysSinceLast);
    if (sortBy === 'loyalty') return [...list].sort((a, b) => {
      const la = a.avgLoyalty === '—' ? -1 : parseFloat(a.avgLoyalty);
      const lb = b.avgLoyalty === '—' ? -1 : parseFloat(b.avgLoyalty);
      return lb - la;
    });
    return list;
  }, [clients, search, sortBy]);

  const globalStats = useMemo(() => {
    const totalClients = clients.length;
    const totalMeetings = clients.reduce((s, c) => s + c.total, 0);
    const totalCompleted = clients.reduce((s, c) => s + c.completed, 0);
    const activeClients = clients.filter(c => c.daysSinceLast <= 30).length;
    const inactiveClients = clients.filter(c => c.daysSinceLast > 60 && c.daysSinceLast < 999).length;
    return { totalClients, totalMeetings, totalCompleted, activeClients, inactiveClients };
  }, [clients]);

  const getHealthBadge = (days: number) => {
    if (days <= 14) return <Badge className="bg-success/20 text-success text-[10px]">Ativo</Badge>;
    if (days <= 30) return <Badge className="bg-info/20 text-info text-[10px]">Regular</Badge>;
    if (days <= 60) return <Badge className="bg-warning/20 text-warning text-[10px]">Atenção</Badge>;
    return <Badge className="bg-destructive/20 text-destructive text-[10px]">Inativo</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira Geral</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todos os clientes e suas métricas de relacionamento</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Importar CSV
        </Button>
      </div>

      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={loadData} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total de Clientes', value: globalStats.totalClients, icon: Globe, color: 'text-foreground' },
          { label: 'Total de Reuniões', value: globalStats.totalMeetings, icon: CalendarDays, color: 'text-primary' },
          { label: 'Realizadas', value: globalStats.totalCompleted, icon: CheckCircle, color: 'text-success' },
          { label: 'Ativos (30d)', value: globalStats.activeClients, icon: TrendingUp, color: 'text-info' },
          { label: 'Inativos (60d+)', value: globalStats.inactiveClients, icon: XCircle, color: 'text-destructive' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-1">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <span className="text-2xl font-bold text-foreground">{kpi.value}</span>
              <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por URL, nome ou responsável..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mês atual</SelectItem>
            <SelectItem value="previous">Mês anterior</SelectItem>
            <SelectItem value="all">Todo o período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total">Mais reuniões</SelectItem>
            <SelectItem value="lastMeeting">Última interação</SelectItem>
            <SelectItem value="loyalty">Maior fidelidade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes ({sorted.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
          ) : (
            <div className="overflow-x-auto">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente / URL</TableHead>
                    <TableHead>CS Responsável</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Realizadas</TableHead>
                    <TableHead className="text-center">Agendadas</TableHead>
                    <TableHead className="text-center">Canceladas</TableHead>
                    <TableHead className="text-center">Fidelidade Atual</TableHead>
                    <TableHead className="text-center">Fid. Média</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead>Principal Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(row => (
                    <TableRow key={row.url}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {row.clientName && <span className="text-sm font-medium text-foreground">{row.clientName}</span>}
                          {row.url !== 'Sem URL' ? (
                            <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate max-w-[200px]">{row.url}</a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem URL</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-normal">{row.csName}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{getHealthBadge(row.daysSinceLast)}</TableCell>
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-success/20 text-success">{row.completed}</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-info/20 text-info">{row.scheduled}</Badge></TableCell>
                      <TableCell className="text-center"><Badge className="bg-destructive/20 text-destructive">{row.cancelled}</Badge></TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 text-warning" />
                          {row.currentLoyalty ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Star className="h-3 w-3 text-muted-foreground" />
                          {row.avgLoyalty}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{row.totalHours}h</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{row.topReason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
