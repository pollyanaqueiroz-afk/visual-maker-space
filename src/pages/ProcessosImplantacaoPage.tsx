import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, FileImage, Smartphone, GraduationCap, CheckCircle, Clock,
  AlertTriangle, XCircle, Loader2, Eye, ExternalLink, Users, ClipboardCheck
} from 'lucide-react';
import { format } from 'date-fns';

const IMAGE_TYPE_LABELS: Record<string, string> = {
  login: 'Área de Login', banner_vitrine: 'Banner Vitrine', product_cover: 'Capa de Produto',
  trail_banner: 'Banner de Trilha', challenge_banner: 'Banner de Desafio',
  community_banner: 'Banner de Comunidade', app_mockup: 'Mockup do Aplicativo',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando Alocação', in_progress: 'Em Execução',
  review: 'Aguardando Validação', completed: 'Aprovada', cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-500', in_progress: 'bg-blue-500/20 text-blue-500',
  review: 'bg-purple-500/20 text-purple-500', completed: 'bg-green-500/20 text-green-500',
  cancelled: 'bg-destructive/20 text-destructive',
};

const FASE_NAMES = ['Pré-Requisitos', 'Primeiros Passos', 'Validação pela Loja', 'Criação e Submissão', 'Aprovação das Lojas', 'Teste do App', 'Publicado'];

export default function ProcessosImplantacaoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasRole } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProcess, setFilterProcess] = useState<string>('all');
  const [selectedClientUrl, setSelectedClientUrl] = useState<string | null>(null);

  // CS vê só seus clientes; admin/gerente/analista vêem todos
  const isCS = !hasRole('admin') && !hasRole('gerente_implantacao') && !hasRole('analista_implantacao') && !hasRole('gerente_cs');
  const userEmail = user?.email || '';

  // Queries
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ['processos-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, client_url, id_curseduca, email_do_cliente, nome_do_cs_atual, email_do_cs_atual, e_mail_do_cs_atual, plano_contratado, data_do_fechamento_do_contrato, status_financeiro, membros_do_mes_atual, dias_desde_o_ultimo_login')
        .order('client_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: appClientes = [] } = useQuery({
    queryKey: ['processos-app-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('id, nome, empresa, status, fase_atual, porcentagem_geral, plataforma, data_criacao, prazo_estimado');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: briefingImages = [] } = useQuery({
    queryKey: ['processos-briefing-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_images')
        .select('id, status, image_type, product_name, observations, assigned_email, deadline, revision_count, created_at, briefing_requests!inner(platform_url, requester_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: scormPackages = [] } = useQuery({
    queryKey: ['processos-scorm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scorm_packages' as any)
        .select('id, title, created_at, platform_url')
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []) as any[];
    },
  });

  const { data: allFases = [] } = useQuery({
    queryKey: ['processos-app-fases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_fases')
        .select('cliente_id, numero, nome, status, plataforma, porcentagem, data_inicio, data_conclusao');
      if (error) throw error;
      return data || [];
    },
  });

  // Consolidar por client_url
  const consolidatedData = useMemo(() => {
    return allClients.map(client => {
      const url = client.client_url;

      const clientBriefings = briefingImages.filter((img: any) => img.briefing_requests?.platform_url === url);
      const briefingTotal = clientBriefings.length;
      const briefingCompleted = clientBriefings.filter((img: any) => img.status === 'completed').length;
      const briefingPending = clientBriefings.filter((img: any) => ['pending', 'in_progress'].includes(img.status)).length;
      const briefingReview = clientBriefings.filter((img: any) => img.status === 'review').length;
      const briefingCancelled = clientBriefings.filter((img: any) => img.status === 'cancelled').length;
      const briefingOpen = briefingTotal - briefingCompleted - briefingCancelled;

      const appCliente = appClientes.find(a => a.empresa === url);
      const appOpen = appCliente && appCliente.status !== 'concluido' && appCliente.status !== 'cancelado';

      const clientScorm = scormPackages.filter((pkg: any) => pkg.platform_url === url);

      const hasOpenBriefing = briefingOpen > 0;
      const hasOpenApp = !!appOpen;
      const hasScorm = clientScorm.length > 0;
      const hasAnyProcess = hasOpenBriefing || hasOpenApp || hasScorm;

      return {
        ...client,
        briefing: { total: briefingTotal, completed: briefingCompleted, pending: briefingPending, review: briefingReview, open: briefingOpen },
        app: appCliente,
        appOpen: hasOpenApp,
        scorm: clientScorm,
        hasScorm,
        hasOpenBriefing,
        hasAnyProcess,
      };
    });
  }, [allClients, briefingImages, appClientes, scormPackages]);

  // Filtros
  const filteredClients = useMemo(() => {
    let result = consolidatedData.filter(c => c.hasAnyProcess);

    if (isCS && userEmail) {
      result = result.filter(c => {
        const csEmail = (c.email_do_cs_atual || c.e_mail_do_cs_atual || '').toLowerCase();
        return csEmail === userEmail.toLowerCase();
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.client_url || '').toLowerCase().includes(q) ||
        (c.id_curseduca || '').toLowerCase().includes(q) ||
        (c.email_do_cliente || '').toLowerCase().includes(q)
      );
    }

    if (filterProcess === 'briefing') result = result.filter(c => c.hasOpenBriefing);
    if (filterProcess === 'app') result = result.filter(c => c.appOpen);
    if (filterProcess === 'scorm') result = result.filter(c => c.hasScorm);

    return result;
  }, [consolidatedData, isCS, userEmail, searchQuery, filterProcess]);

  // KPIs
  const baseList = isCS ? consolidatedData.filter(c => {
    const csEmail = (c.email_do_cs_atual || c.e_mail_do_cs_atual || '').toLowerCase();
    return csEmail === userEmail.toLowerCase();
  }) : consolidatedData;
  const totalWithProcess = baseList.filter(c => c.hasAnyProcess).length;
  const totalWithBriefing = baseList.filter(c => c.hasOpenBriefing).length;
  const totalWithApp = baseList.filter(c => c.appOpen).length;
  const totalWithScorm = baseList.filter(c => c.hasScorm).length;

  // Detalhe
  const selectedClient = selectedClientUrl ? consolidatedData.find(c => c.client_url === selectedClientUrl) : null;
  const selectedBriefings = selectedClientUrl ? briefingImages.filter((img: any) => img.briefing_requests?.platform_url === selectedClientUrl) : [];
  const selectedAppFases = selectedClient?.app ? allFases.filter(f => f.cliente_id === selectedClient.app!.id) : [];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processos de Implantação</h1>
        <p className="text-muted-foreground">
          {isCS ? 'Clientes da sua carteira com processos de implantação ativos' : 'Todos os clientes com briefings, aplicativos ou SCORM em aberto'}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><Users className="h-4 w-4" /></div>
          <div><p className="text-xl font-bold">{totalWithProcess}</p><p className="text-[11px] text-muted-foreground">Clientes com processos</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><FileImage className="h-4 w-4 text-primary" /></div>
          <div><p className="text-xl font-bold">{totalWithBriefing}</p><p className="text-[11px] text-muted-foreground">Com design em aberto</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center"><Smartphone className="h-4 w-4 text-blue-500" /></div>
          <div><p className="text-xl font-bold">{totalWithApp}</p><p className="text-[11px] text-muted-foreground">Com app em andamento</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center"><GraduationCap className="h-4 w-4 text-purple-500" /></div>
          <div><p className="text-xl font-bold">{totalWithScorm}</p><p className="text-[11px] text-muted-foreground">Com SCORM</p></div>
        </CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, URL, Curseduca ID ou email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterProcess} onValueChange={setFilterProcess}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tipo de processo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os processos</SelectItem>
            <SelectItem value="briefing">Com design em aberto</SelectItem>
            <SelectItem value="app">Com app em andamento</SelectItem>
            <SelectItem value="scorm">Com SCORM</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filteredClients.length} cliente(s)</span>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Curseduca ID</TableHead>
                <TableHead>CS Atual</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="text-center">Design</TableHead>
                <TableHead className="text-center">Aplicativo</TableHead>
                <TableHead className="text-center">SCORM</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedClientUrl(c.client_url)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{c.client_name || c.client_url}</p>
                      <p className="text-xs text-muted-foreground">{c.client_url}</p>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-mono text-muted-foreground">{c.id_curseduca || '—'}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{c.nome_do_cs_atual || '—'}</span></TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{c.plano_contratado || '—'}</span></TableCell>
                  <TableCell className="text-center">
                    {c.briefing.total > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="outline" className="text-[9px] gap-0.5"><FileImage className="h-2.5 w-2.5" /> {c.briefing.completed}/{c.briefing.total}</Badge>
                        {c.briefing.review > 0 && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">{c.briefing.review} aguardando</Badge>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.app ? (
                      <Badge variant="outline" className={`text-[9px] ${
                        c.app.status === 'concluido' ? 'border-green-500/30 text-green-500' :
                        c.app.status === 'cancelado' ? 'border-destructive/30 text-destructive' :
                        'border-blue-500/30 text-blue-500'
                      }`}>
                        <Smartphone className="h-2.5 w-2.5 mr-0.5" />
                        {c.app.status === 'concluido' ? 'Publicado' : c.app.status === 'cancelado' ? 'Cancelado' : `${c.app.porcentagem_geral || 0}%`}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {c.hasScorm ? (
                      <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-500">
                        <GraduationCap className="h-2.5 w-2.5 mr-0.5" /> {c.scorm.length}
                      </Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => { e.stopPropagation(); setSelectedClientUrl(c.client_url); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {isCS ? 'Nenhum cliente da sua carteira possui processos de implantação ativos' : 'Nenhum cliente encontrado'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog de detalhe */}
      <Dialog open={!!selectedClientUrl} onOpenChange={v => { if (!v) setSelectedClientUrl(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedClient.client_name || selectedClient.client_url}</DialogTitle>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{selectedClient.client_url}</span>
                  {selectedClient.id_curseduca && <span>ID: {selectedClient.id_curseduca}</span>}
                  {selectedClient.nome_do_cs_atual && <span>CS: {selectedClient.nome_do_cs_atual}</span>}
                  {selectedClient.plano_contratado && <span>Plano: {selectedClient.plano_contratado}</span>}
                  {selectedClient.email_do_cliente && <span>{selectedClient.email_do_cliente}</span>}
                </div>
              </DialogHeader>

              <Tabs defaultValue="briefing" className="mt-4">
                <TabsList>
                  <TabsTrigger value="briefing" className="gap-1.5 text-xs">
                    <FileImage className="h-3.5 w-3.5" /> Design
                    {selectedClient.briefing.total > 0 && <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">{selectedClient.briefing.total}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="app" className="gap-1.5 text-xs">
                    <Smartphone className="h-3.5 w-3.5" /> Aplicativo
                    {selectedClient.app && <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">{selectedClient.app.porcentagem_geral || 0}%</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="scorm" className="gap-1.5 text-xs">
                    <GraduationCap className="h-3.5 w-3.5" /> SCORM
                    {selectedClient.hasScorm && <Badge variant="secondary" className="text-[9px] ml-1 h-4 px-1">{selectedClient.scorm.length}</Badge>}
                  </TabsTrigger>
                </TabsList>

                {/* DESIGN */}
                <TabsContent value="briefing" className="mt-4 space-y-3">
                  {selectedClient.briefing.total === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação de design</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-green-500 font-medium">{selectedClient.briefing.completed} aprovadas</span>
                        <span className="text-amber-500">{selectedClient.briefing.pending} pendentes</span>
                        <span className="text-purple-500">{selectedClient.briefing.review} aguardando validação</span>
                      </div>
                      <Progress value={selectedClient.briefing.total > 0 ? (selectedClient.briefing.completed / selectedClient.briefing.total) * 100 : 0} className="h-2" />
                      <div className="space-y-1.5">
                        {selectedBriefings.map((img: any) => (
                          <div key={img.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {IMAGE_TYPE_LABELS[img.image_type] || img.image_type}
                                {img.product_name ? ` — ${img.product_name}` : ''}
                                {img.observations ? ` — ${img.observations}` : ''}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {img.assigned_email && <span>{img.assigned_email}</span>}
                                {img.deadline && <span>Prazo: {format(new Date(img.deadline), 'dd/MM/yyyy')}</span>}
                                {img.revision_count > 0 && <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">{img.revision_count}x refação</Badge>}
                              </div>
                            </div>
                            <Badge className={`${STATUS_COLORS[img.status] || ''} border-0 text-[10px] shrink-0`}>{STATUS_LABELS[img.status] || img.status}</Badge>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* APLICATIVO */}
                <TabsContent value="app" className="mt-4 space-y-3">
                  {!selectedClient.app ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação de aplicativo</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <Badge className={`border-0 text-xs ${
                          selectedClient.app.status === 'concluido' ? 'bg-green-500/20 text-green-500' :
                          selectedClient.app.status === 'cancelado' ? 'bg-destructive/20 text-destructive' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {selectedClient.app.status === 'concluido' ? '✅ Publicado' :
                           selectedClient.app.status === 'cancelado' ? '❌ Cancelado' :
                           `Fase ${selectedClient.app.fase_atual} — ${FASE_NAMES[selectedClient.app.fase_atual] || ''}`}
                        </Badge>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { setSelectedClientUrl(null); navigate(`/hub/aplicativos/${selectedClient.app!.id}`); }}>
                          <Eye className="h-3 w-3" /> Ver detalhes
                        </Button>
                      </div>
                      <Progress value={selectedClient.app.porcentagem_geral || 0} className="h-2" />
                      <div className="space-y-1">
                        {selectedAppFases.map((fase: any) => (
                          <div key={`${fase.numero}-${fase.plataforma}`} className="flex items-center justify-between px-3 py-1.5 rounded bg-muted/20">
                            <div className="flex items-center gap-2">
                              {fase.status === 'concluida' ? <CheckCircle className="h-3 w-3 text-green-500" /> :
                               fase.status === 'em_andamento' ? <Clock className="h-3 w-3 text-blue-500" /> :
                               fase.status === 'atrasada' ? <AlertTriangle className="h-3 w-3 text-destructive" /> :
                               <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />}
                              <span className={`text-xs ${fase.status === 'concluida' ? 'text-green-500' : fase.status === 'em_andamento' ? 'font-medium' : 'text-muted-foreground'}`}>
                                {fase.numero}. {fase.nome}
                              </span>
                              {fase.plataforma && fase.plataforma !== 'compartilhada' && (
                                <Badge variant="outline" className="text-[8px] px-1">{fase.plataforma === 'google' ? '🤖' : '🍎'}</Badge>
                              )}
                            </div>
                            {fase.data_conclusao && <span className="text-[10px] text-muted-foreground">{format(new Date(fase.data_conclusao), 'dd/MM')}</span>}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>Plataforma: {selectedClient.app.plataforma}</span>
                        {selectedClient.app.data_criacao && <span>Criado: {format(new Date(selectedClient.app.data_criacao), 'dd/MM/yyyy')}</span>}
                        {selectedClient.app.prazo_estimado && <span>Prazo: {format(new Date(selectedClient.app.prazo_estimado), 'dd/MM/yyyy')}</span>}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* SCORM */}
                <TabsContent value="scorm" className="mt-4 space-y-3">
                  {selectedClient.scorm.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum pacote SCORM vinculado</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedClient.scorm.map((pkg: any) => (
                        <div key={pkg.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">{pkg.title}</p>
                            <span className="text-xs text-muted-foreground">{format(new Date(pkg.created_at), 'dd/MM/yyyy')}</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/hub/scorm')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
