import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Search, FileImage, Smartphone, GraduationCap, CheckCircle, Clock,
  AlertTriangle, XCircle, Loader2, Eye, ExternalLink, ChevronRight,
  Package, ImageIcon, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IMAGE_TYPE_LABELS, STATUS_LABELS } from '@/types/briefing';
import { useNavigate } from 'react-router-dom';

export default function ProcessosImplantacaoPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClientUrl, setSelectedClientUrl] = useState<string | null>(null);
  const navigate = useNavigate();

  // 1. Buscar todos os clientes da carteira
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ['processos-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_url, id_curseduca, email_do_cliente, nome_do_cs_atual, plano_contratado, data_do_fechamento_do_contrato')
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Buscar todos os app_clientes (gestão de aplicativos)
  const { data: appClientes = [] } = useQuery({
    queryKey: ['processos-app-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('id, nome, empresa, status, fase_atual, porcentagem_geral, plataforma, data_criacao');
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Buscar resumo de briefing_images por platform_url
  const { data: briefingImages = [] } = useQuery({
    queryKey: ['processos-briefing-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_images')
        .select('id, status, image_type, briefing_requests!inner(platform_url)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 4. Buscar pacotes SCORM
  const { data: scormPackages = [] } = useQuery({
    queryKey: ['processos-scorm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scorm_packages')
        .select('id, title, created_at, created_by, platform_url')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Consolidar dados por client_url (Curseduca ID)
  const consolidatedData = useMemo(() => {
    return clients.map(client => {
      const url = client.client_url;

      // Briefings
      const clientBriefings = briefingImages.filter((img: any) =>
        img.briefing_requests?.platform_url === url
      );
      const briefingTotal = clientBriefings.length;
      const briefingCompleted = clientBriefings.filter((img: any) => img.status === 'completed').length;
      const briefingPending = clientBriefings.filter((img: any) => ['pending', 'in_progress'].includes(img.status)).length;
      const briefingReview = clientBriefings.filter((img: any) => img.status === 'review').length;

      // Aplicativo
      const appCliente = appClientes.find(a => a.empresa === url);

      // SCORM
      const clientScormPackages = scormPackages.filter((pkg: any) => pkg.platform_url === url);
      const hasScorm = clientScormPackages.length > 0;

      // Status geral
      let overallStatus = 'sem_processos';
      if (appCliente || briefingTotal > 0) {
        if (appCliente?.status === 'concluido' && briefingTotal === briefingCompleted) {
          overallStatus = 'concluido';
        } else if (appCliente?.status === 'cancelado') {
          overallStatus = 'cancelado';
        } else if (briefingPending > 0 || briefingReview > 0 || (appCliente && appCliente.status !== 'concluido')) {
          overallStatus = 'em_andamento';
        } else {
          overallStatus = 'concluido';
        }
      }

      return {
        ...client,
        briefing: { total: briefingTotal, completed: briefingCompleted, pending: briefingPending, review: briefingReview },
        app: appCliente,
        scorm: hasScorm,
        overallStatus,
      };
    });
  }, [clients, briefingImages, appClientes, scormPackages]);

  // Filtros
  const filtered = consolidatedData.filter(c => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (
        !(c.client_name || '').toLowerCase().includes(q) &&
        !(c.client_url || '').toLowerCase().includes(q) &&
        !(c.id_curseduca || '').toLowerCase().includes(q) &&
        !(c.email_do_cliente || '').toLowerCase().includes(q)
      ) return false;
    }
    if (filterStatus === 'com_processos' && c.overallStatus === 'sem_processos') return false;
    if (filterStatus === 'em_andamento' && c.overallStatus !== 'em_andamento') return false;
    if (filterStatus === 'concluido' && c.overallStatus !== 'concluido') return false;
    if (filterStatus === 'sem_processos' && c.overallStatus !== 'sem_processos') return false;
    return true;
  });

  // KPIs
  const totalClients = clients.length;
  const clientsComApp = appClientes.filter(a => a.status !== 'cancelado').length;
  const clientsComBriefing = new Set(briefingImages.map((img: any) => img.briefing_requests?.platform_url)).size;
  const clientsEmAndamento = consolidatedData.filter(c => c.overallStatus === 'em_andamento').length;

  // Detalhe do cliente selecionado
  const selectedClient = selectedClientUrl ? consolidatedData.find(c => c.client_url === selectedClientUrl) : null;
  const selectedBriefings = selectedClientUrl
    ? briefingImages.filter((img: any) => img.briefing_requests?.platform_url === selectedClientUrl)
    : [];

  const loading = loadingClients;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processos de Implantação</h1>
        <p className="text-sm text-muted-foreground">Visão consolidada de todos os processos por cliente (Curseduca ID)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{totalClients}</p>
            <p className="text-xs text-muted-foreground">Clientes na carteira</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <ImageIcon className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold text-primary">{clientsComBriefing}</p>
            <p className="text-xs text-muted-foreground">Com briefing de artes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Smartphone className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold text-blue-500">{clientsComApp}</p>
            <p className="text-xs text-muted-foreground">Com aplicativo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold text-amber-500">{clientsEmAndamento}</p>
            <p className="text-xs text-muted-foreground">Em andamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, URL, ID ou email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="com_processos">Com processos ativos</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluídos</SelectItem>
            <SelectItem value="sem_processos">Sem processos</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} cliente(s)</span>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Curseduca ID</TableHead>
                <TableHead>CS Responsável</TableHead>
                <TableHead>Briefing Artes</TableHead>
                <TableHead>Aplicativo</TableHead>
                <TableHead>SCORM</TableHead>
                <TableHead>Status Geral</TableHead>
                <TableHead className="w-10">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClientUrl(c.client_url)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{c.client_name || c.client_url}</p>
                      <a href={`https://${c.client_url}`} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:underline" onClick={e => e.stopPropagation()}>
                        {c.client_url} <ExternalLink className="h-2.5 w-2.5 inline" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.id_curseduca || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.nome_do_cs_atual || '—'}
                  </TableCell>
                  {/* Briefing */}
                  <TableCell>
                    {c.briefing.total > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <FileImage className="h-3.5 w-3.5 text-primary" />
                          <span>{c.briefing.completed}/{c.briefing.total}</span>
                        </div>
                        <Progress value={c.briefing.total > 0 ? (c.briefing.completed / c.briefing.total) * 100 : 0} className="h-1 w-16" />
                        {c.briefing.review > 0 && (
                          <span className="text-[10px] text-amber-500">{c.briefing.review} aguardando</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* Aplicativo */}
                  <TableCell>
                    {c.app ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Smartphone className="h-3.5 w-3.5 text-blue-500" />
                          <span>{c.app.porcentagem_geral || 0}%</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${c.app.status === 'concluido' ? 'text-green-500 border-green-500/30' : c.app.status === 'cancelado' ? 'text-destructive border-destructive/30' : 'text-amber-500 border-amber-500/30'}`}>
                          {c.app.status === 'concluido' ? 'Publicado' : c.app.status === 'cancelado' ? 'Cancelado' : `Fase ${c.app.fase_atual}`}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* SCORM */}
                  <TableCell>
                    {c.scorm ? (
                      <div className="flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-green-500" />
                        <span className="text-xs">Sim</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {/* Status geral */}
                  <TableCell>
                    {c.overallStatus === 'em_andamento' && (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"><Clock className="h-3 w-3 mr-1" /> Em andamento</Badge>
                    )}
                    {c.overallStatus === 'concluido' && (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Concluído</Badge>
                    )}
                    {c.overallStatus === 'cancelado' && (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>
                    )}
                    {c.overallStatus === 'sem_processos' && (
                      <span className="text-xs text-muted-foreground">Sem processos</span>
                    )}
                  </TableCell>
                  {/* Ações */}
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setSelectedClientUrl(c.client_url); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog de detalhe do cliente */}
      <Dialog open={!!selectedClientUrl} onOpenChange={v => { if (!v) setSelectedClientUrl(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {selectedClient.client_name || selectedClient.client_url}
                </DialogTitle>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                  <span>URL: {selectedClient.client_url}</span>
                  {selectedClient.id_curseduca && <span>ID: {selectedClient.id_curseduca}</span>}
                  {selectedClient.nome_do_cs_atual && <span>CS: {selectedClient.nome_do_cs_atual}</span>}
                </div>
              </DialogHeader>
              <Separator />
              <div className="space-y-5">
                {/* Briefing de Artes */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <FileImage className="h-4 w-4 text-primary" /> Briefing de Artes
                  </h3>
                  {selectedClient.briefing.total > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline" className="text-green-500 border-green-500/30">{selectedClient.briefing.completed} aprovadas</Badge>
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30">{selectedClient.briefing.pending} pendentes</Badge>
                        <Badge variant="outline" className="text-primary border-primary/30">{selectedClient.briefing.review} aguardando validação</Badge>
                      </div>
                      <Separator />
                      <div className="space-y-1">
                        {selectedBriefings.map((img: any) => (
                          <div key={img.id} className="flex items-center justify-between text-xs py-1">
                            <span>{IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type}</span>
                            <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[img.status as keyof typeof STATUS_LABELS] || img.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma solicitação de arte registrada</p>
                  )}
                </div>

                <Separator />

                {/* Aplicativo */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-blue-500" /> Aplicativo
                  </h3>
                  {selectedClient.app ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{selectedClient.app.nome}</span>
                        <Badge variant="outline" className={`text-[10px] ${selectedClient.app.status === 'concluido' ? 'text-green-500 border-green-500/30' : selectedClient.app.status === 'cancelado' ? 'text-destructive border-destructive/30' : 'text-amber-500 border-amber-500/30'}`}>
                          {selectedClient.app.status === 'concluido' ? 'Publicado' : selectedClient.app.status === 'cancelado' ? 'Cancelado' : `Fase ${selectedClient.app.fase_atual} — ${selectedClient.app.porcentagem_geral}%`}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Plataforma: {selectedClient.app.plataforma}</p>
                        {selectedClient.app.data_criacao && <p>Criado em: {format(new Date(selectedClient.app.data_criacao), 'dd/MM/yyyy')}</p>}
                      </div>
                      <div>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate(`/hub/aplicativos/${selectedClient.app!.id}`)}>
                          <ChevronRight className="h-3 w-3 mr-1" /> Ver detalhes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma solicitação de aplicativo</p>
                  )}
                </div>

                <Separator />

                {/* SCORM */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <GraduationCap className="h-4 w-4 text-emerald-500" /> SCORM
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.scorm
                      ? 'Este cliente utilizou o módulo SCORM'
                      : 'Nenhum pacote SCORM associado a este cliente'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Nota: os pacotes SCORM atualmente não são vinculados por cliente. Para verificar, acesse o gerenciador SCORM.
                  </p>
                  <Button variant="ghost" size="sm" className="text-xs h-7 mt-1" onClick={() => navigate('/hub/scorm')}>
                    <GraduationCap className="h-3 w-3 mr-1" /> Abrir Gerenciador SCORM
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
