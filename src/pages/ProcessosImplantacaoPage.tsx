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
import { Separator } from '@/components/ui/separator';
import {
  Search, FileImage, Smartphone, GraduationCap, CheckCircle, Clock,
  AlertTriangle, XCircle, Loader2, Eye, ExternalLink, Users, ClipboardCheck, Copy, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
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
  const [activeKPI, setActiveKPI] = useState<string | null>(null);

  const isCS = !hasRole('admin') && !hasRole('gerente_implantacao') && !hasRole('analista_implantacao') && !hasRole('gerente_cs');
  const userEmail = user?.email || '';
  const [filterCS, setFilterCS] = useState<string>(isCS ? userEmail : 'all');

  // Queries
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ['processos-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, cliente, id_curseduca, cs_atual, plano')
        .order('cliente');
      if (error) throw error;
      return data || [];
    },
    staleTime: 120_000,
  });

  const { data: appClientes = [] } = useQuery({
    queryKey: ['processos-app-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('id, nome, empresa, status, fase_atual, porcentagem_geral, plataforma, data_criacao, prazo_estimado, portal_token');
      if (error) throw error;
      return data || [];
    },
    staleTime: 120_000,
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

  const { data: allChecklist = [] } = useQuery({
    queryKey: ['processos-checklist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_checklist_items')
        .select('id, cliente_id, fase_numero, texto, ator, feito, plataforma, responsavel, sla_vencimento')
        .eq('feito', false);
      if (error) throw error;
      return data || [];
    },
  });

  // CS list for filter
  const uniqueCS = useMemo(() => {
    const names = allClients
      .map(c => ({ nome: c.cs_atual || '', email: (c.cs_atual || '').toLowerCase() }))
      .filter(c => c.nome);
    const unique = new Map<string, string>();
    names.forEach(c => { if (!unique.has(c.email)) unique.set(c.email, c.nome!); });
    return Array.from(unique.entries()).map(([email, nome]) => ({ email, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allClients]);

  // Consolidate by client_url
  const consolidatedData = useMemo(() => {
    return allClients.map(client => {
      const url = client.id_curseduca;

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

      // Overdue detection
      const briefingOverdue = clientBriefings.some((img: any) => {
        if (img.status === 'completed' || img.status === 'cancelled') return false;
        if (img.deadline) return new Date(img.deadline) < new Date();
        return new Date(img.created_at).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now();
      });

      const appFasesCliente = allFases.filter(f => f.cliente_id === appCliente?.id);
      const appOverdue = appFasesCliente.some(f => f.status === 'atrasada');
      const isOverdue = briefingOverdue || appOverdue;

      return {
        ...client,
        briefing: { total: briefingTotal, completed: briefingCompleted, pending: briefingPending, review: briefingReview, open: briefingOpen },
        app: appCliente,
        appOpen: hasOpenApp,
        scorm: clientScorm,
        hasScorm,
        hasOpenBriefing,
        hasAnyProcess,
        briefingOverdue,
        appOverdue,
        isOverdue,
      };
    });
  }, [allClients, briefingImages, appClientes, scormPackages, allFases]);

  // Filters
  const filteredClients = useMemo(() => {
    let result = consolidatedData.filter(c => c.hasAnyProcess);

    if (filterCS !== 'all') {
      result = result.filter(c => {
        const csVal = (c.cs_atual || '').toLowerCase();
        return csVal === filterCS.toLowerCase();
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        (c.cliente || '').toLowerCase().includes(q) ||
        (c.id_curseduca || '').toLowerCase().includes(q)
      );
    }

    if (filterProcess === 'briefing') result = result.filter(c => c.hasOpenBriefing);
    if (filterProcess === 'app') result = result.filter(c => c.appOpen);
    if (filterProcess === 'scorm') result = result.filter(c => c.hasScorm);

    return result;
  }, [consolidatedData, filterCS, searchQuery, filterProcess]);

  // KPIs - based on CS filter
  const baseList = filterCS !== 'all' ? consolidatedData.filter(c => {
    const csVal = (c.cs_atual || '').toLowerCase();
    return csVal === filterCS.toLowerCase();
  }) : consolidatedData;
  const totalWithProcess = baseList.filter(c => c.hasAnyProcess).length;
  const totalWithBriefing = baseList.filter(c => c.hasOpenBriefing).length;
  const totalWithApp = baseList.filter(c => c.appOpen).length;
  const totalWithScorm = baseList.filter(c => c.hasScorm).length;

  // Detail
  const selectedClient = selectedClientUrl ? consolidatedData.find(c => c.id_curseduca === selectedClientUrl) : null;
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

      {/* KPIs - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'all', value: totalWithProcess, label: 'Clientes com processos', icon: <Users className="h-4 w-4" />, bg: 'bg-muted' },
          { key: 'briefing', value: totalWithBriefing, label: 'Com design em aberto', icon: <FileImage className="h-4 w-4 text-primary" />, bg: 'bg-primary/10' },
          { key: 'app', value: totalWithApp, label: 'Com app em andamento', icon: <Smartphone className="h-4 w-4 text-blue-500" />, bg: 'bg-blue-500/10' },
          { key: 'scorm', value: totalWithScorm, label: 'Com SCORM', icon: <GraduationCap className="h-4 w-4 text-purple-500" />, bg: 'bg-purple-500/10' },
        ].map(kpi => (
          <Card
            key={kpi.key}
            className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === kpi.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => {
              if (activeKPI === kpi.key) {
                setActiveKPI(null);
                setFilterProcess('all');
              } else {
                setActiveKPI(kpi.key);
                setFilterProcess(kpi.key === 'all' ? 'all' : kpi.key);
              }
            }}
          >
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full ${kpi.bg} flex items-center justify-center`}>{kpi.icon}</div>
              <div>
                <p className="text-xl font-bold">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, URL, ID ou email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCS} onValueChange={setFilterCS}>
          <SelectTrigger className="w-56"><SelectValue placeholder="CS Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os CS</SelectItem>
            {uniqueCS.map(cs => (
              <SelectItem key={cs.email} value={cs.email}>{cs.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProcess} onValueChange={v => { setFilterProcess(v); setActiveKPI(v === 'all' ? null : v); }}>
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

      {/* Table */}
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
                <TableHead className="text-center">Portal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map(c => (
                <TableRow
                  key={c.id}
                  className={`cursor-pointer hover:bg-muted/30 ${c.isOverdue ? 'bg-destructive/5 border-l-4 border-destructive' : ''}`}
                  onClick={() => setSelectedClientUrl(c.id_curseduca)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      <div>
                        <p className={`font-medium text-sm ${c.isOverdue ? 'text-destructive' : ''}`}>{c.client_name || c.client_url}</p>
                        <p className="text-xs text-muted-foreground">{c.client_url}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><span className="text-xs font-mono text-muted-foreground">{c.id_curseduca || '—'}</span></TableCell>
                  <TableCell><span className="text-sm text-muted-foreground">{c.nome_do_cs_atual || '—'}</span></TableCell>
                  <TableCell><span className="text-xs text-muted-foreground">{c.plano_contratado || '—'}</span></TableCell>

                  {/* Design column - enhanced */}
                  <TableCell className="text-center">
                    {c.briefing.total > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="outline" className={`text-[9px] gap-0.5 ${c.briefingOverdue ? 'border-destructive/30 text-destructive' : ''}`}>
                          <FileImage className="h-2.5 w-2.5" /> {c.briefing.completed}/{c.briefing.total}
                        </Badge>
                        {c.briefing.review > 0 && (
                          <Badge variant="outline" className="text-[9px] border-purple-500/30 text-purple-500">{c.briefing.review} validação</Badge>
                        )}
                        {c.briefing.pending > 0 && (
                          <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">{c.briefing.pending} pendente{c.briefing.pending > 1 ? 's' : ''}</Badge>
                        )}
                        {c.briefingOverdue && (
                          <Badge variant="destructive" className="text-[9px]">⚠️ Atrasado</Badge>
                        )}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>

                  {/* App column - expanded */}
                  <TableCell className="text-center">
                    {c.app ? (() => {
                      const appFasesCliente = allFases.filter(f => f.cliente_id === c.app!.id);
                      const fasesAtivas = appFasesCliente.filter(f => f.status === 'em_andamento' || f.status === 'atrasada');

                      return (
                        <div className="flex flex-col items-start gap-1 text-left">
                          <div className="flex items-center gap-1.5 w-full">
                            <Smartphone className="h-3 w-3 text-blue-500 shrink-0" />
                            <Progress value={c.app!.porcentagem_geral || 0} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-medium shrink-0">{c.app!.porcentagem_geral || 0}%</span>
                          </div>
                          {c.app!.status === 'concluido' ? (
                            <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500">✅ Publicado</Badge>
                          ) : c.app!.status === 'cancelado' ? (
                            <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">❌ Cancelado</Badge>
                          ) : (
                            <>
                              {fasesAtivas.map(fase => (
                                <div key={`${fase.numero}-${fase.plataforma}`} className={`flex items-center gap-1 text-[10px] ${fase.status === 'atrasada' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  {fase.plataforma && fase.plataforma !== 'compartilhada' && (
                                    <span>{fase.plataforma === 'google' ? '🤖' : '🍎'}</span>
                                  )}
                                  {fase.status === 'atrasada' && <AlertTriangle className="h-2.5 w-2.5" />}
                                  <span>Fase {fase.numero}: {FASE_NAMES[fase.numero] || ''}</span>
                                </div>
                              ))}
                              {fasesAtivas.length > 0 && (() => {
                                const faseAtiva = fasesAtivas[0];
                                const checklistFase = allChecklist.filter(i =>
                                  i.cliente_id === c.app!.id &&
                                  i.fase_numero === faseAtiva.numero &&
                                  !i.feito &&
                                  (i.plataforma === faseAtiva.plataforma || i.plataforma === 'compartilhada')
                                );
                                const pendingClientItems = checklistFase.filter(i => i.ator === 'cliente');
                                const pendingInternalItems = checklistFase.filter(i => i.ator !== 'cliente');

                                if (pendingClientItems.length > 0) {
                                  return <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-500">Aguardando cliente</Badge>;
                                } else if (pendingInternalItems.length > 0) {
                                  const responsavel = pendingInternalItems[0].responsavel;
                                  return (
                                    <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-500">
                                      {responsavel ? `Resp: ${responsavel}` : 'Equipe Curseduca'}
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                        </div>
                      );
                    })() : <span className="text-xs text-muted-foreground">—</span>}
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
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {c.app ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Acessar como CS (Modo Preview)"
                          onClick={() => navigate(`/hub/cliente-preview/${c.app!.id}`)}
                        >
                          <ShieldCheck className="h-4 w-4 text-amber-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Copiar link do portal do cliente"
                          onClick={() => {
                            const url = `${window.location.origin}/app/${c.app!.portal_token}`;
                            navigator.clipboard.writeText(url);
                            toast.success('Link do portal copiado!');
                          }}
                        >
                          <Copy className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {filteredClients.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  {isCS ? 'Nenhum cliente da sua carteira possui processos de implantação ativos' : 'Nenhum cliente encontrado'}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail dialog */}
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

                {/* APP */}
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

                      {/* Pending tasks */}
                      {selectedClient.app.status !== 'concluido' && selectedClient.app.status !== 'cancelado' && (() => {
                        const pendingItems = allChecklist.filter(i =>
                          i.cliente_id === selectedClient.app!.id && !i.feito
                        );
                        if (pendingItems.length === 0) return null;
                        return (
                          <>
                            <Separator />
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Tarefas pendentes ({pendingItems.length})
                              </p>
                              <div className="space-y-1">
                                {pendingItems.sort((a, b) => a.fase_numero - b.fase_numero).map(item => {
                                  const isLate = item.sla_vencimento && new Date(item.sla_vencimento) < new Date();
                                  return (
                                    <div key={item.id} className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${isLate ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/20'}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        {isLate && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                                        <span className={`truncate ${isLate ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                          F{item.fase_numero} — {item.texto}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <Badge variant="outline" className={`text-[8px] ${item.ator === 'cliente' ? 'border-amber-500/30 text-amber-500' : 'border-blue-500/30 text-blue-500'}`}>
                                          {item.ator === 'cliente' ? 'Cliente' : item.responsavel || 'Equipe'}
                                        </Badge>
                                        {item.plataforma && item.plataforma !== 'compartilhada' && (
                                          <span className="text-[8px]">{item.plataforma === 'google' ? '🤖' : '🍎'}</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()}
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
