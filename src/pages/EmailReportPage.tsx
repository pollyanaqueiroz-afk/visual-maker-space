import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TopScrollableTable } from '@/components/ui/TopScrollableTable';
import { Mail, Search, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface EmailLog {
  id: string;
  created_at: string;
  sender_name: string | null;
  sender_type: string;
  recipient_email: string;
  client_name: string | null;
  client_url: string | null;
  subject: string | null;
  html_body: string | null;
  send_type: string;
  origin: string | null;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  metadata: any;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  sent: { label: 'Enviado', className: 'bg-green-500/10 text-green-600' },
  failed: { label: 'Falha', className: 'bg-destructive/10 text-destructive' },
  pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-600' },
  bounced: { label: 'Retornado', className: 'bg-orange-500/10 text-orange-600' },
};

const ORIGIN_LABELS: Record<string, string> = {
  delivery: 'Entrega de Artes',
  migration: 'Finalização de Migração',
  app_delivery: 'Entrega de Aplicativo',
  manual: 'Envio Manual',
  csat: 'CSAT',
  reminder: 'Lembrete',
  briefing: 'Briefing',
  adjustment: 'Ajuste',
  revision: 'Revisão',
};

export default function EmailReportPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['email-logs', statusFilter, originFilter],
    queryFn: async () => {
      let q = supabase
        .from('email_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      if (originFilter !== 'all') q = q.eq('origin', originFilter);
      const { data } = await (q as any);
      return (data || []) as EmailLog[];
    },
  });

  const filtered = logs.filter(l =>
    !search ||
    l.recipient_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    l.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSent = logs.filter(l => l.status === 'sent').length;
  const totalFailed = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          Relatório de Envios de E-mail
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Rastreamento completo de e-mails enviados pelo sistema.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalSent}</p>
          <p className="text-xs text-muted-foreground">Enviados</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{totalFailed}</p>
          <p className="text-xs text-muted-foreground">Falhas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.filter(l => l.send_type === 'automatic').length}</p>
          <p className="text-xs text-muted-foreground">Automáticos</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por e-mail, cliente ou assunto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="sent">Enviados</SelectItem>
            <SelectItem value="failed">Falhas</SelectItem>
            <SelectItem value="bounced">Retornados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Origem" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="delivery">Entrega de Artes</SelectItem>
            <SelectItem value="migration">Migração</SelectItem>
            <SelectItem value="app_delivery">Aplicativo</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="csat">CSAT</SelectItem>
            <SelectItem value="reminder">Lembrete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <TopScrollableTable deps={[filtered.length]}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data/Hora</TableHead>
              <TableHead>Remetente</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
            ) : filtered.map(log => {
              const sb = STATUS_BADGE[log.status] || STATUS_BADGE.pending;
              return (
                <TableRow key={log.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedLog(log)}>
                  <TableCell className="text-xs">{format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-xs">{log.sender_type === 'system' ? 'Sistema' : log.sender_name || '—'}</TableCell>
                  <TableCell className="text-xs font-mono">{log.recipient_email}</TableCell>
                  <TableCell className="text-xs">{log.client_name || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[200px] truncate">{log.subject || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{log.send_type === 'automatic' ? 'Auto' : 'Manual'}</Badge></TableCell>
                  <TableCell className="text-xs">{ORIGIN_LABELS[log.origin || ''] || log.origin || '—'}</TableCell>
                  <TableCell><Badge className={`text-xs ${sb.className}`}>{sb.label}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TopScrollableTable>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={v => { if (!v) setSelectedLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedLog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Detalhes do E-mail
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Data:</span><p className="font-medium">{format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p></div>
                  <div><span className="text-muted-foreground">Status:</span><p><Badge className={`${(STATUS_BADGE[selectedLog.status] || STATUS_BADGE.pending).className}`}>{(STATUS_BADGE[selectedLog.status] || STATUS_BADGE.pending).label}</Badge></p></div>
                  <div><span className="text-muted-foreground">Remetente:</span><p className="font-medium">{selectedLog.sender_type === 'system' ? 'Sistema (automático)' : selectedLog.sender_name}</p></div>
                  <div><span className="text-muted-foreground">Destinatário:</span><p className="font-medium font-mono">{selectedLog.recipient_email}</p></div>
                  <div><span className="text-muted-foreground">Cliente:</span><p className="font-medium">{selectedLog.client_name || '—'}</p></div>
                  <div><span className="text-muted-foreground">Origem:</span><p className="font-medium">{ORIGIN_LABELS[selectedLog.origin || ''] || selectedLog.origin || '—'}</p></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Assunto:</span>
                  <p className="font-medium">{selectedLog.subject || '—'}</p>
                </div>
                {selectedLog.error_message && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-destructive">Erro:</p>
                    <p className="text-xs">{selectedLog.error_message}</p>
                  </div>
                )}
                {selectedLog.resend_id && (
                  <div><span className="text-muted-foreground text-xs">ID Resend:</span><p className="text-xs font-mono">{selectedLog.resend_id}</p></div>
                )}
                {selectedLog.html_body && (
                  <div>
                    <p className="text-muted-foreground mb-1">Preview do E-mail:</p>
                    <div className="border rounded-lg p-4 bg-background max-h-[300px] overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: selectedLog.html_body }} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
