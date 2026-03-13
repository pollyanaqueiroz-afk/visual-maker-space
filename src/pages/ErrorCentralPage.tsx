import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TopScrollableTable } from '@/components/ui/TopScrollableTable';
import { AlertTriangle, Search, Eye, Bug, ShieldAlert, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

interface ErrorLog {
  id: string;
  created_at: string;
  user_email: string | null;
  user_role: string | null;
  module: string | null;
  screen: string | null;
  action: string | null;
  error_message: string;
  stack_trace: string | null;
  request_data: string | null;
  endpoint: string | null;
  severity: string;
  metadata: any;
}

const SEVERITY_BADGE: Record<string, { label: string; className: string; icon: any }> = {
  low: { label: 'Baixa', className: 'bg-blue-500/10 text-blue-600', icon: Info },
  medium: { label: 'Média', className: 'bg-amber-500/10 text-amber-600', icon: AlertTriangle },
  high: { label: 'Alta', className: 'bg-orange-500/10 text-orange-600', icon: ShieldAlert },
  critical: { label: 'Crítica', className: 'bg-destructive/10 text-destructive', icon: Bug },
};

export default function ErrorCentralPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ['system-error-logs', severityFilter, moduleFilter],
    queryFn: async () => {
      let q = supabase
        .from('system_error_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (severityFilter !== 'all') q = q.eq('severity', severityFilter);
      if (moduleFilter !== 'all') q = q.eq('module', moduleFilter);
      const { data } = await (q as any);
      return (data || []) as ErrorLog[];
    },
  });

  const filtered = errors.filter(e =>
    !search ||
    e.error_message?.toLowerCase().includes(search.toLowerCase()) ||
    e.module?.toLowerCase().includes(search.toLowerCase()) ||
    e.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  const modules = [...new Set(errors.map(e => e.module).filter(Boolean))];
  const criticalCount = errors.filter(e => e.severity === 'critical').length;
  const highCount = errors.filter(e => e.severity === 'high').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bug className="h-6 w-6 text-destructive" />
          Central de Erros
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Monitoramento de erros operacionais do sistema.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{errors.length}</p>
          <p className="text-xs text-muted-foreground">Total de Erros</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
          <p className="text-xs text-muted-foreground">Críticos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{highCount}</p>
          <p className="text-xs text-muted-foreground">Alta Severidade</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{modules.length}</p>
          <p className="text-xs text-muted-foreground">Módulos Afetados</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por mensagem, módulo ou usuário..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Severidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítica</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Módulo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {modules.map(m => <SelectItem key={m} value={m!}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <TopScrollableTable deps={[filtered.length]}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Tela</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead className="max-w-[250px]">Erro</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum erro registrado.</TableCell></TableRow>
            ) : filtered.map(err => {
              const sev = SEVERITY_BADGE[err.severity] || SEVERITY_BADGE.medium;
              return (
                <TableRow key={err.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedError(err)}>
                  <TableCell className="text-xs">{format(new Date(err.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                  <TableCell className="text-xs">{err.user_email || 'Sistema'}</TableCell>
                  <TableCell className="text-xs">{err.user_role || '—'}</TableCell>
                  <TableCell className="text-xs">{err.module || '—'}</TableCell>
                  <TableCell className="text-xs">{err.screen || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[150px] truncate">{err.action || '—'}</TableCell>
                  <TableCell className="text-xs max-w-[250px] truncate">{err.error_message}</TableCell>
                  <TableCell><Badge className={`text-xs ${sev.className}`}>{sev.label}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TopScrollableTable>

      {/* Detail Modal */}
      <Dialog open={!!selectedError} onOpenChange={v => { if (!v) setSelectedError(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-destructive" />
                  Detalhes do Erro
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Data:</span><p className="font-medium">{format(new Date(selectedError.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p></div>
                  <div><span className="text-muted-foreground">Severidade:</span><p><Badge className={`${(SEVERITY_BADGE[selectedError.severity] || SEVERITY_BADGE.medium).className}`}>{(SEVERITY_BADGE[selectedError.severity] || SEVERITY_BADGE.medium).label}</Badge></p></div>
                  <div><span className="text-muted-foreground">Usuário:</span><p className="font-medium">{selectedError.user_email || 'Sistema'}</p></div>
                  <div><span className="text-muted-foreground">Perfil:</span><p className="font-medium">{selectedError.user_role || '—'}</p></div>
                  <div><span className="text-muted-foreground">Módulo:</span><p className="font-medium">{selectedError.module || '—'}</p></div>
                  <div><span className="text-muted-foreground">Tela:</span><p className="font-medium">{selectedError.screen || '—'}</p></div>
                </div>
                <div><span className="text-muted-foreground">Ação:</span><p className="font-medium">{selectedError.action || '—'}</p></div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Mensagem de Erro:</p>
                  <p className="text-xs font-mono whitespace-pre-wrap">{selectedError.error_message}</p>
                </div>
                {selectedError.stack_trace && (
                  <div>
                    <p className="text-muted-foreground mb-1">Stack Trace:</p>
                    <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-[200px] overflow-y-auto font-mono">{selectedError.stack_trace}</pre>
                  </div>
                )}
                {selectedError.request_data && (
                  <div>
                    <p className="text-muted-foreground mb-1">Dados da Requisição:</p>
                    <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto max-h-[150px] overflow-y-auto font-mono">{selectedError.request_data}</pre>
                  </div>
                )}
                {selectedError.endpoint && (
                  <div><span className="text-muted-foreground">Endpoint:</span><p className="text-xs font-mono">{selectedError.endpoint}</p></div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
