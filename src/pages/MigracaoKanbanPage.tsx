import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Plus, Search, User, ExternalLink, CheckCircle2, XCircle, Clock,
  AlertTriangle, FileText, Link2, Key, Loader2, ArrowRight, RotateCcw,
  Copy, ChevronRight, Eye, Share2, MessageCircle, BarChart3, Zap,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PLATFORM_OPTIONS = [
  'Hotmart', 'Academi', 'Kiwify', 'Memberkit', 'Greenn',
  'The Members', 'Eduzz', 'Alpha Class', 'Outros',
];

const KANBAN_COLUMNS = [
  { key: 'analysis', label: 'Análise Inicial', color: 'bg-amber-500', statuses: ['analysis'] },
  { key: 'rejected', label: 'Briefing Invalidado', color: 'bg-destructive', statuses: ['rejected'] },
  { key: 'extraction', label: 'Extração de Dados', color: 'bg-blue-500', statuses: ['extraction'] },
  { key: 'in_progress', label: 'Migração em Andamento', color: 'bg-purple-500', statuses: ['in_progress'] },
  { key: 'completed', label: 'Finalizado', color: 'bg-emerald-500', statuses: ['completed'] },
];

const STATUS_LABELS: Record<string, string> = {
  waiting_form: 'Aguardando Formulário',
  analysis: 'Análise Inicial',
  rejected: 'Briefing Invalidado',
  extraction: 'Extração de Dados',
  in_progress: 'Migração em Andamento',
  completed: 'Finalizado',
};

const VALIDATION_ITEMS = [
  { key: 'club_links', label: 'Links dos Clubs' },
  { key: 'members_spreadsheet', label: 'Planilha de Membros' },
  { key: 'progress_spreadsheet', label: 'Planilha de Progresso' },
  { key: 'admin_access', label: 'Acesso Admin' },
  { key: 'api_hotmart', label: 'API Hotmart' },
];

type MigrationProject = {
  id: string;
  client_name: string;
  client_email: string;
  client_url: string;
  platform_origin: string;
  has_migration: boolean;
  has_app: boolean;
  has_design: boolean;
  migration_status: string;
  portal_token: string;
  cs_responsible: string | null;
  migrator_observations: string | null;
  cs_observations: string | null;
  rejected_tag: boolean;
  created_at: string;
  updated_at: string;
};

export default function MigracaoKanbanPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<MigrationProject | null>(null);

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['migration-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('migration_projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as MigrationProject[];
    },
  });

  const filtered = projects.filter(p =>
    !search || p.client_name.toLowerCase().includes(search.toLowerCase()) ||
    p.client_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Migração</h1>
          <p className="text-sm text-muted-foreground">Kanban de projetos de migração</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/hub/migracao/analytics')} className="gap-2">
            <BarChart3 className="h-4 w-4" /> Analytics
          </Button>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Solicitação de Migração
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
        <div
          className="overflow-x-auto"
          style={{ overflowY: 'hidden' }}
          onScroll={(e) => {
            const sibling = (e.target as HTMLElement).nextElementSibling as HTMLElement;
            if (sibling) sibling.scrollLeft = (e.target as HTMLElement).scrollLeft;
          }}
        >
          <div style={{ width: 5 * 280 + 4 * 16, height: 1 }} />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4"
          onScroll={(e) => {
            const sibling = (e.target as HTMLElement).previousElementSibling as HTMLElement;
            if (sibling) sibling.scrollLeft = (e.target as HTMLElement).scrollLeft;
          }}
        >
          {KANBAN_COLUMNS.map(col => {
            const cards = filtered.filter(p => col.statuses.includes(p.migration_status));
            // Also include waiting_form in analysis column
            const waitingCards = col.key === 'analysis' ? filtered.filter(p => p.migration_status === 'waiting_form') : [];
            const allCards = [...waitingCards, ...cards];

            return (
              <div key={col.key} className="min-w-[280px] w-[280px] shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{allCards.length}</Badge>
                </div>
                <div className="space-y-2">
                  {allCards.map(project => (
                    <Card
                      key={project.id}
                      className="cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => setSelectedProject(project)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{project.client_name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{project.client_url}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{project.platform_origin}</Badge>
                          {project.migration_status === 'waiting_form' && (
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">Aguardando formulário</Badge>
                          )}
                          {project.rejected_tag && (
                            <Badge variant="destructive" className="text-[10px]">REVISÃO</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          📅 {format(new Date(project.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {allCards.length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">Nenhum projeto</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      <NewClientDialog open={showNewDialog} onClose={() => setShowNewDialog(false)} />
      {selectedProject && (
        <ProjectDetailSheet
          project={selectedProject}
          onClose={() => { setSelectedProject(null); queryClient.invalidateQueries({ queryKey: ['migration-projects'] }); }}
        />
      )}
    </div>
  );
}

// ─── New Client Dialog ────────────────────────────────────────
function NewClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_url: '', whatsapp: '',
  });
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleUrlLookup = async (url: string) => {
    setForm(f => ({ ...f, client_url: url }));
    setLookupDone(false);
    if (!url.trim()) return;

    setLookupLoading(true);
    try {
      // Try to find client in carteira geral by id_curseduca (URL-based match)
      const cleanUrl = url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const idCurseduca = cleanUrl.split('.')[0] || cleanUrl;

      const { data: client } = await supabase
        .from('clients')
        .select('nome, email, id_curseduca')
        .or(`id_curseduca.eq.${idCurseduca},id_curseduca.ilike.%${idCurseduca}%`)
        .limit(1)
        .maybeSingle();

      if (client) {
        setForm(f => ({
          ...f,
          client_name: client.nome || f.client_name,
          client_email: client.email || f.client_email,
        }));
        toast.success('Cliente encontrado na carteira geral!');
      }
    } catch {
      // Ignore lookup errors
    } finally {
      setLookupLoading(false);
      setLookupDone(true);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('migration_projects').insert({
        client_name: form.client_name,
        client_email: form.client_email,
        client_url: form.client_url,
        platform_origin: 'Hotmart',
        has_migration: true,
        has_app: false,
        has_design: false,
        created_by: user?.id,
        cs_responsible: user?.email,
        migration_status: 'waiting_form',
      }).select().single();
      if (error) throw error;

      // Create initial validation items
      const items = VALIDATION_ITEMS.map(v => ({
        project_id: data.id,
        item_key: v.key,
        status: 'pending',
      }));
      await supabase.from('migration_validations').insert(items);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-projects'] });
      toast.success('Solicitação de migração criada!');
      onClose();
      setForm({ client_name: '', client_email: '', client_url: '', whatsapp: '' });
      setLookupDone(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canSubmit = form.client_name && form.client_email && form.client_url;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitação de Migração</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>URL de identificação na Curseduca *</Label>
            <div className="flex gap-2">
              <Input
                value={form.client_url}
                onChange={e => setForm(f => ({ ...f, client_url: e.target.value }))}
                onBlur={e => handleUrlLookup(e.target.value)}
                placeholder="empresa.curseduca.com"
                className="flex-1"
              />
              {lookupLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2.5" />}
            </div>
            {lookupDone && (
              <p className="text-[11px] text-muted-foreground">
                {form.client_name ? '✅ Dados preenchidos automaticamente' : 'Cliente não encontrado na carteira — preencha manualmente'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nome do cliente *</Label>
            <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Nome completo" />
          </div>
          <div className="space-y-2">
            <Label>E-mail do cliente *</Label>
            <Input type="email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="email@empresa.com" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project Detail Sheet ─────────────────────────────────────
function ProjectDetailSheet({ project, onClose }: { project: MigrationProject; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch form submissions
  const { data: submissions = [] } = useQuery({
    queryKey: ['migration-submissions', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_form_submissions')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Fetch clubs for latest submission
  const latestSubmission = submissions[0];
  const { data: clubs = [] } = useQuery({
    queryKey: ['migration-clubs', latestSubmission?.id],
    enabled: !!latestSubmission,
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_clubs')
        .select('*')
        .eq('submission_id', latestSubmission!.id);
      return data || [];
    },
  });

  // Fetch validations
  const { data: validations = [] } = useQuery({
    queryKey: ['migration-validations', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_validations')
        .select('*')
        .eq('project_id', project.id);
      return data || [];
    },
  });

  // Fetch status history
  const { data: history = [] } = useQuery({
    queryKey: ['migration-history', project.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_status_history')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Update validation
  const updateValidation = useMutation({
    mutationFn: async ({ id, status, observation }: { id: string; status: string; observation?: string }) => {
      const { error } = await supabase.from('migration_validations').update({
        status,
        observation: observation || null,
        validated_by: user?.email,
        validated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['migration-validations', project.id] }),
  });

  // Change project status
  const changeStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error: upErr } = await supabase.from('migration_projects').update({
        migration_status: newStatus,
        rejected_tag: newStatus === 'rejected' ? false : project.rejected_tag,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      if (upErr) throw upErr;

      await supabase.from('migration_status_history').insert({
        project_id: project.id,
        from_status: project.migration_status,
        to_status: newStatus,
        changed_by: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-projects'] });
      toast.success('Status atualizado!');
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Validate analysis
  const handleAnalysisResult = (approved: boolean) => {
    if (approved) {
      changeStatus.mutate('extraction');
    } else {
      // Mark as rejected, set rejected_tag
      supabase.from('migration_projects').update({
        migration_status: 'rejected',
        rejected_tag: true,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id).then(() => {
        supabase.from('migration_status_history').insert({
          project_id: project.id,
          from_status: project.migration_status,
          to_status: 'rejected',
          changed_by: user?.email,
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['migration-projects'] });
          toast.success('Briefing marcado como invalidado. Cliente será notificado.');
          onClose();
        });
      });
    }
  };

  const migrationFormLink = `${window.location.origin}/migracao/${project.portal_token}`;
  const hasSubmission = submissions.length > 0;

  return (
    <Sheet open onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {project.client_name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">E-mail</p>
              <p className="font-medium">{project.client_email}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">URL Curseduca</p>
              <p className="font-medium">{project.client_url}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Plataforma de Origem</p>
              <Badge variant="outline">{project.platform_origin}</Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge className={cn('text-xs',
                project.migration_status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
                project.migration_status === 'rejected' && 'bg-destructive/10 text-destructive',
                project.migration_status === 'analysis' && 'bg-amber-500/10 text-amber-600',
                project.migration_status === 'waiting_form' && 'bg-muted text-muted-foreground',
              )}>
                {STATUS_LABELS[project.migration_status] || project.migration_status}
              </Badge>
            </div>
          </div>

          {/* Rejected tag */}
          {project.rejected_tag && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <RotateCcw className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">REVISÃO DE BRIEFING NEGADO</span>
            </div>
          )}

          {/* Services */}
          <div className="flex items-center gap-2">
            {project.has_migration && <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Migração</Badge>}
            {project.has_app && <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Aplicativo</Badge>}
            {project.has_design && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Design</Badge>}
          </div>

          {/* Form Link with share options */}
          {project.has_migration && (
            <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
              <p className="text-xs text-muted-foreground mb-1">Link do Formulário de Migração</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded truncate">{migrationFormLink}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(migrationFormLink); toast.success('Link copiado!'); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    const msg = encodeURIComponent(
                      `Olá! Para iniciarmos sua migração para a Curseduca, pedimos que preencha este formulário com as informações necessárias.\n\n${migrationFormLink}`
                    );
                    window.open(`https://wa.me/?text=${msg}`, '_blank');
                  }}
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                  WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Formulário de Migração — Curseduca',
                        text: 'Olá! Para iniciarmos sua migração para a Curseduca, pedimos que preencha este formulário com as informações necessárias.',
                        url: migrationFormLink,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(migrationFormLink);
                      toast.success('Link copiado!');
                    }
                  }}
                >
                  <Share2 className="h-3.5 w-3.5 mr-1.5" />
                  Compartilhar
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Form Submission Data */}
          {hasSubmission ? (
            <>
              <div>
                <h3 className="text-sm font-semibold mb-3">📋 Dados do Formulário</h3>

                {/* Clubs */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground">Links dos Clubs ({clubs.length})</p>
                  {clubs.map(club => (
                    <div key={club.id} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate flex-1">{club.club_name || club.club_url}</span>
                      <a href={club.club_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>

                {/* Spreadsheet */}
                {latestSubmission?.members_spreadsheet_url && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Planilha de Membros</p>
                    <a href={latestSubmission.members_spreadsheet_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline p-2 bg-muted/30 rounded">
                      <FileText className="h-3.5 w-3.5" />
                      {latestSubmission.members_spreadsheet_name || 'Planilha'}
                    </a>
                  </div>
                )}

                {/* API Credentials */}
                {(latestSubmission?.api_client_id || latestSubmission?.api_client_secret || latestSubmission?.api_basic) && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Credenciais API Hotmart</p>
                    <div className="space-y-1 p-2 bg-muted/30 rounded text-xs font-mono">
                      {latestSubmission.api_client_id && <p><span className="text-muted-foreground">Client ID:</span> {latestSubmission.api_client_id}</p>}
                      {latestSubmission.api_client_secret && <p><span className="text-muted-foreground">Client Secret:</span> {latestSubmission.api_client_secret}</p>}
                      {latestSubmission.api_basic && <p><span className="text-muted-foreground">Basic:</span> {latestSubmission.api_basic}</p>}
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Validation Table */}
              {(project.migration_status === 'analysis' || project.migration_status === 'rejected') && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">✅ Validação do Migrador</h3>
                  <div className="space-y-2">
                    {VALIDATION_ITEMS.map(item => {
                      const val = validations.find(v => v.item_key === item.key);
                      return (
                        <ValidationRow
                          key={item.key}
                          label={item.label}
                          validation={val}
                          onUpdate={(status, obs) => {
                            if (val) updateValidation.mutate({ id: val.id, status, observation: obs });
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleAnalysisResult(true)}
                      disabled={changeStatus.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Validar e Avançar
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAnalysisResult(false)}
                      disabled={changeStatus.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" /> Não Validado
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Aguardando preenchimento do formulário pelo cliente
            </div>
          )}

          {/* Status Actions */}
          {(project.migration_status === 'extraction' || project.migration_status === 'in_progress') && (
            <ManusIntegrationSection project={project} onStatusChange={() => { queryClient.invalidateQueries({ queryKey: ['migration-projects'] }); onClose(); }} />
          )}
          {project.migration_status === 'extraction' && (
            <Button className="w-full" onClick={() => changeStatus.mutate('in_progress')} disabled={changeStatus.isPending}>
              <ArrowRight className="h-4 w-4 mr-2" /> Avançar Manualmente
            </Button>
          )}
          {project.migration_status === 'in_progress' && (
            <Button className="w-full" onClick={() => changeStatus.mutate('completed')} disabled={changeStatus.isPending}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar Migração
            </Button>
          )}
          {project.migration_status === 'rejected' && (
            <Button variant="outline" className="w-full" onClick={() => changeStatus.mutate('analysis')} disabled={changeStatus.isPending}>
              <RotateCcw className="h-4 w-4 mr-2" /> Retornar para Análise Inicial
            </Button>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-2">📜 Histórico</h3>
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{STATUS_LABELS[h.from_status || ''] || h.from_status} → {STATUS_LABELS[h.to_status] || h.to_status}</span>
                      <span className="ml-auto">{format(new Date(h.created_at), 'dd/MM HH:mm')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Validation Row ───────────────────────────────────────────
function ValidationRow({
  label, validation, onUpdate,
}: {
  label: string;
  validation: any;
  onUpdate: (status: string, observation?: string) => void;
}) {
  const [obs, setObs] = useState(validation?.observation || '');
  const status = validation?.status || 'pending';

  return (
    <div className="p-3 rounded-lg border bg-card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={status === 'approved' ? 'default' : 'outline'}
            className={cn('h-7 px-2', status === 'approved' && 'bg-emerald-600 hover:bg-emerald-700')}
            onClick={() => onUpdate('approved', obs)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={status === 'rejected' ? 'destructive' : 'outline'}
            className="h-7 px-2"
            onClick={() => onUpdate('rejected', obs)}
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {status === 'rejected' && (
        <div className="flex gap-2">
          <Input
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observação (ex: Planilha não enviada)"
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7 px-2" onClick={() => onUpdate('rejected', obs)}>
            Salvar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Manus Integration Section ────────────────────────────────
function ManusIntegrationSection({ project, onStatusChange }: { project: MigrationProject; onStatusChange: () => void }) {
  const [sending, setSending] = useState(false);

  const triggerManus = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('trigger-manus-migration', {
        body: { project_id: project.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar para Manus');
      toast.success('🚀 Migração enviada ao Manus IA com sucesso!');
      onStatusChange();
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold">Manus IA — Automação</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Envia os dados coletados (links dos clubs, planilhas, credenciais API) para o Manus IA executar a migração automaticamente.
      </p>
      <Button
        className="w-full gap-2"
        variant="default"
        onClick={triggerManus}
        disabled={sending}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        {sending ? 'Enviando ao Manus IA...' : 'Enviar para Manus IA'}
      </Button>
    </div>
  );
}
