import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClienteEmail } from '@/hooks/useClienteEmail';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Clock, AlertTriangle, Upload, Plus, Trash2, Loader2,
  HelpCircle, Link2, FileSpreadsheet, Key, Send, XCircle, ArrowRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

const STATUS_STEPS = [
  { key: 'waiting_form', label: 'Formulário enviado', icon: Send },
  { key: 'analysis', label: 'Em análise', icon: Clock },
  { key: 'rejected', label: 'Ajustes solicitados', icon: AlertTriangle },
  { key: 'extraction', label: 'Extração de dados', icon: FileSpreadsheet },
  { key: 'in_progress', label: 'Migração em andamento', icon: ArrowRight },
  { key: 'completed', label: 'Concluído', icon: CheckCircle2 },
];

const STATUS_ORDER: Record<string, number> = {
  waiting_form: 0, analysis: 1, rejected: 2, extraction: 3, in_progress: 4, completed: 5,
};

export default function ClienteMigracao() {
  const clientEmail = useClienteEmail();
  const queryClient = useQueryClient();

  // Fetch migration project for this client
  const { data: project, isLoading } = useQuery({
    queryKey: ['cliente-migration', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_projects')
        .select('*')
        .eq('client_email', clientEmail)
        .eq('has_migration', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch validations with rejections
  const { data: validations = [] } = useQuery({
    queryKey: ['cliente-migration-validations', project?.id],
    enabled: !!project?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_validations')
        .select('*')
        .eq('project_id', project!.id);
      return data || [];
    },
  });

  const rejectedItems = validations.filter(v => v.status === 'rejected');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 space-y-3">
        <Clock className="h-10 w-10 mx-auto text-white/20" />
        <p className="text-white/50">Nenhum projeto de migração encontrado para sua conta.</p>
      </div>
    );
  }

  const currentStep = STATUS_ORDER[project.migration_status] ?? 0;
  const progressPercent = project.migration_status === 'completed' ? 100 :
    project.migration_status === 'rejected' ? (1 / 5) * 100 :
    (currentStep / 5) * 100;

  const showForm = project.migration_status === 'waiting_form' || project.migration_status === 'rejected';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold">🚀 Migração</h1>
        <p className="text-white/50 text-sm mt-1">Acompanhe o progresso da sua migração para a Curseduca</p>
      </motion.div>

      {/* Progress Stepper */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        <Card className="bg-[#1E293B] border-white/10">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/50">Progresso geral</span>
              <span className="text-xs font-medium text-white/70">{Math.round(progressPercent)}%</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-white/10" />

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
              {STATUS_STEPS.map((step, i) => {
                const isActive = project.migration_status === step.key;
                const isPast = STATUS_ORDER[project.migration_status] > STATUS_ORDER[step.key];
                const isRejected = step.key === 'rejected' && project.migration_status !== 'rejected';

                if (isRejected && !project.rejected_tag) return null;

                return (
                  <div key={step.key} className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg text-center transition-colors',
                    isActive && 'bg-primary/10 ring-1 ring-primary/30',
                    isPast && 'opacity-60',
                  )}>
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isActive ? 'bg-primary text-primary-foreground' :
                      isPast ? 'bg-emerald-500/20 text-emerald-400' :
                      'bg-white/10 text-white/30'
                    )}>
                      {isPast ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                    </div>
                    <span className={cn('text-[10px] leading-tight', isActive ? 'text-white font-medium' : 'text-white/40')}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rejected Items - Show corrections needed */}
      {project.migration_status === 'rejected' && rejectedItems.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <Card className="bg-destructive/5 border-destructive/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">Ajustes necessários</h3>
              </div>
              {rejectedItems.map(item => (
                <div key={item.id} className="flex items-start gap-2 p-2 rounded bg-destructive/5 border border-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-white/80">
                      {item.item_key === 'club_links' ? 'Links dos Clubs' :
                       item.item_key === 'members_spreadsheet' ? 'Planilha de Membros' :
                       item.item_key === 'progress_spreadsheet' ? 'Planilha de Progresso' :
                       item.item_key === 'admin_access' ? 'Acesso Admin' :
                       item.item_key === 'api_hotmart' ? 'API Hotmart' : item.item_key}
                    </p>
                    {item.observation && <p className="text-xs text-white/50 mt-0.5">{item.observation}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Migration Form */}
      {showForm && (
        <MigrationForm projectId={project.id} isResubmission={project.migration_status === 'rejected'} />
      )}

      {/* Status Messages */}
      {project.migration_status === 'analysis' && (
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-300">Formulário em análise</p>
              <p className="text-xs text-white/50">Nossa equipe está validando os dados enviados.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {project.migration_status === 'extraction' && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-blue-300">Extração de dados em andamento</p>
              <p className="text-xs text-white/50">Estamos extraindo e preparando seus dados para a migração.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {project.migration_status === 'in_progress' && (
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <ArrowRight className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-sm font-medium text-purple-300">Migração em andamento</p>
              <p className="text-xs text-white/50">Seus dados estão sendo migrados para a Curseduca.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {project.migration_status === 'completed' && (
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-300">Migração concluída! 🎉</p>
              <p className="text-xs text-white/50">Todos os seus dados foram migrados com sucesso.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Migrator observations */}
      {project.migrator_observations && (
        <Card className="bg-[#1E293B] border-white/10">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-white/50">Observações do Migrador</p>
            <p className="text-sm text-white/80">{project.migrator_observations}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Migration Form Component ─────────────────────────────────
function MigrationForm({ projectId, isResubmission }: { projectId: string; isResubmission: boolean }) {
  const queryClient = useQueryClient();
  const [clubs, setClubs] = useState<{ name: string; url: string }[]>([{ name: '', url: '' }]);
  const [spreadsheet, setSpreadsheet] = useState<File | null>(null);
  const [apiClientId, setApiClientId] = useState('');
  const [apiClientSecret, setApiClientSecret] = useState('');
  const [apiBasic, setApiBasic] = useState('');
  const [uploading, setUploading] = useState(false);

  const addClub = () => setClubs(c => [...c, { name: '', url: '' }]);
  const removeClub = (i: number) => setClubs(c => c.filter((_, idx) => idx !== i));
  const updateClub = (i: number, field: 'name' | 'url', value: string) => {
    setClubs(c => c.map((cl, idx) => idx === i ? { ...cl, [field]: value } : cl));
  };

  const submitForm = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let spreadsheetUrl = '';
      let spreadsheetName = '';

      // Upload spreadsheet
      if (spreadsheet) {
        const ext = spreadsheet.name.split('.').pop();
        const path = `migration/${projectId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('migration-uploads')
          .upload(path, spreadsheet);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('migration-uploads').getPublicUrl(path);
        spreadsheetUrl = urlData.publicUrl;
        spreadsheetName = spreadsheet.name;
      }

      // Create submission
      const { data: submission, error: subErr } = await supabase.from('migration_form_submissions').insert({
        project_id: projectId,
        api_client_id: apiClientId || null,
        api_client_secret: apiClientSecret || null,
        api_basic: apiBasic || null,
        members_spreadsheet_url: spreadsheetUrl || null,
        members_spreadsheet_name: spreadsheetName || null,
        is_resubmission: isResubmission,
      }).select().single();
      if (subErr) throw subErr;

      // Create clubs
      const validClubs = clubs.filter(c => c.url.trim());
      if (validClubs.length > 0) {
        const { error: clubErr } = await supabase.from('migration_clubs').insert(
          validClubs.map(c => ({
            submission_id: submission.id,
            club_name: c.name || null,
            club_url: c.url,
          }))
        );
        if (clubErr) throw clubErr;
      }

      // Update project status to analysis
      await supabase.from('migration_projects').update({
        migration_status: 'analysis',
        rejected_tag: isResubmission ? true : false,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);

      // Add history
      await supabase.from('migration_status_history').insert({
        project_id: projectId,
        from_status: isResubmission ? 'rejected' : 'waiting_form',
        to_status: 'analysis',
        changed_by: 'cliente',
        notes: isResubmission ? 'Reenvio após correção' : 'Formulário preenchido pelo cliente',
      });
    },
    onSuccess: () => {
      setUploading(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-migration'] });
      toast.success(isResubmission ? 'Dados reenviados com sucesso!' : 'Formulário enviado com sucesso! 🎉');
    },
    onError: (e: any) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const canSubmit = clubs.some(c => c.url.trim());

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="bg-[#1E293B] border-white/10">
        <CardContent className="p-5 space-y-6">
          <div>
            <h2 className="text-lg font-bold">
              {isResubmission ? '📝 Corrija e reenvie os dados' : '📝 Formulário de Migração'}
            </h2>
            <p className="text-xs text-white/50 mt-1">Preencha as informações abaixo para iniciar sua migração</p>
          </div>

          {/* 1. Club Links */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-white/80">1. Links de cada Club</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-white/30 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="font-semibold mb-1">Como encontrar:</p>
                    <p>Hotmart → Produtos → Meus Produtos → Hotmart Club</p>
                    <p className="mt-1">Escolha o produto → Usuários → Importar membro → Adicionar membro individual</p>
                    <p className="mt-1">Crie o membro: <strong>migracoes@curseduca.com</strong> com permissão <strong>Admin</strong></p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {clubs.map((club, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={club.name}
                  onChange={e => updateClub(i, 'name', e.target.value)}
                  placeholder="Nome do club (opcional)"
                  className="bg-white/5 border-white/10 text-sm flex-1"
                />
                <Input
                  value={club.url}
                  onChange={e => updateClub(i, 'url', e.target.value)}
                  placeholder="URL do club *"
                  className="bg-white/5 border-white/10 text-sm flex-[2]"
                />
                {clubs.length > 1 && (
                  <Button size="icon" variant="ghost" className="shrink-0 text-white/30 hover:text-destructive" onClick={() => removeClub(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addClub} className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar club
            </Button>
          </div>

          <Separator className="bg-white/10" />

          {/* 2. Spreadsheet */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-white/80">2. Planilha de membros e progresso</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-white/30 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="font-semibold mb-1">Como exportar:</p>
                    <p>Hotmart → Produtos → Meus Produtos → Hotmart Club</p>
                    <p className="mt-1">Escolha o produto → Usuários → Selecionar todos os usuários</p>
                    <p className="mt-1">Ações → <strong>Exportar CSV</strong></p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors">
                <Upload className="h-4 w-4 text-white/50" />
                <span className="text-sm text-white/60">{spreadsheet ? spreadsheet.name : 'Enviar planilha'}</span>
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => setSpreadsheet(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* 3. API Credentials */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-white/80">3. Credenciais da API Hotmart</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-white/30 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="font-semibold mb-1">Como encontrar:</p>
                    <p>Clique nos três pontos ao lado da conta → Ferramentas → Credenciais Hotmart</p>
                    <p className="mt-1">Criar credencial → Nome: <strong>curseduca</strong></p>
                    <p className="mt-1">Copie o Client ID, Client Secret e Basic.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2">
              <Input
                value={apiClientId}
                onChange={e => setApiClientId(e.target.value)}
                placeholder="Client ID"
                className="bg-white/5 border-white/10 text-sm font-mono"
              />
              <Input
                value={apiClientSecret}
                onChange={e => setApiClientSecret(e.target.value)}
                placeholder="Client Secret"
                className="bg-white/5 border-white/10 text-sm font-mono"
              />
              <Input
                value={apiBasic}
                onChange={e => setApiBasic(e.target.value)}
                placeholder="Basic"
                className="bg-white/5 border-white/10 text-sm font-mono"
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => submitForm.mutate()}
            disabled={!canSubmit || submitForm.isPending || uploading}
          >
            {(submitForm.isPending || uploading) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isResubmission ? 'Reenviar dados corrigidos' : 'Enviar formulário'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
