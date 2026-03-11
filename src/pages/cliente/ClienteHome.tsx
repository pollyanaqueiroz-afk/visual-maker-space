import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, AlertTriangle, Palette, Smartphone, Eye, Upload, FileText,
  ChevronRight, Loader2, Sparkles, PlusCircle, XCircle, Clock, ArrowRightLeft,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import TimelineSection from '@/components/cliente/TimelineSection';
import { useClienteEmail } from '@/hooks/useClienteEmail';

export default function ClienteHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientEmail = useClienteEmail();

  // Fetch artes data (for status cards)
  const { data: artesData, isLoading: loadingArtes } = useQuery({
    queryKey: ['cliente-artes-pending', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('client-review-data', {
        body: { email: clientEmail },
      });
      return data;
    },
  });

  // Fetch app client data (include cancelled, get latest)
  const { data: appCliente, isLoading: loadingApp } = useQuery({
    queryKey: ['cliente-app', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('*')
        .eq('email', clientEmail)
        .order('data_criacao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL pending app checklist items for client
  const { data: appPendencies = [], isLoading: loadingChecklist } = useQuery({
    queryKey: ['cliente-home-app-pendencies', appCliente?.id],
    enabled: !!appCliente?.id,
    queryFn: async () => {
      // Only fetch items from the current active phase
      const faseAtual = appCliente!.fase_atual ?? 0;
      const { data, error } = await supabase
        .from('app_checklist_items')
        .select('id, texto, descricao, fase_numero, tipo, ordem, plataforma')
        .eq('cliente_id', appCliente!.id)
        .eq('ator', 'cliente')
        .eq('feito', false)
        .eq('fase_numero', faseAtual)
        .order('ordem');
      if (error) throw error;

      // Also check if there are active phases (em_andamento) to get items from all active phases
      const { data: activeFases } = await supabase
        .from('app_fases')
        .select('numero')
        .eq('cliente_id', appCliente!.id)
        .eq('status', 'em_andamento');
      const activeFaseNums = new Set((activeFases || []).map(f => f.numero));
      // If current phase items are empty but other phases are active, fetch those too
      let allItems = data || [];
      if (activeFaseNums.size > 0) {
        const otherNums = [...activeFaseNums].filter(n => n !== faseAtual);
        if (otherNums.length > 0) {
          const { data: extra } = await supabase
            .from('app_checklist_items')
            .select('id, texto, descricao, fase_numero, tipo, ordem, plataforma')
            .eq('cliente_id', appCliente!.id)
            .eq('ator', 'cliente')
            .eq('feito', false)
            .in('fase_numero', otherNums)
            .order('ordem');
          allItems = [...allItems, ...(extra || [])];
        }
      }

      const FASE_NAMES = ['Pré-Requisitos', 'Primeiros Passos', 'Validação pela Loja', 'Criação e Submissão', 'Aprovação das Lojas', 'Teste do App', 'Publicado'];
      return allItems.map(i => ({
        ...i,
        source: 'app' as const,
        subtitle: `Fase ${i.fase_numero} — ${FASE_NAMES[i.fase_numero] || ''}`,
      }));
    },
    staleTime: 30_000,
  });

  // Fetch art pendencies (images in review status)
  const { data: artPendencies = [] } = useQuery({
    queryKey: ['cliente-home-art-pendencies', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data: requests } = await supabase
        .from('briefing_requests')
        .select('id')
        .eq('requester_email', clientEmail);
      if (!requests?.length) return [];

      const { data: images } = await supabase
        .from('briefing_images')
        .select('id, image_type, observations, product_name')
        .in('request_id', requests.map(r => r.id))
        .eq('status', 'review');

      return (images || []).map(img => ({
        id: img.id,
        texto: img.observations || img.product_name || (img.image_type === 'app_mockup' ? 'Mockup do Aplicativo' : img.image_type),
        source: 'art' as const,
        subtitle: 'Aguardando sua aprovação',
      }));
    },
    staleTime: 30_000,
  });

  // Fetch app form
  const { data: appForm } = useQuery({
    queryKey: ['cliente-app-form', appCliente?.id],
    enabled: !!appCliente?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_formulario')
        .select('*')
        .eq('cliente_id', appCliente!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Check if client has briefing_requests but no app_clientes
  const { data: hasBriefingRequest } = useQuery({
    queryKey: ['cliente-briefing-check', clientEmail],
    enabled: !!clientEmail && !appCliente,
    queryFn: async () => {
      const { data } = await supabase
        .from('briefing_requests')
        .select('requester_name, requester_email, platform_url')
        .eq('requester_email', clientEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Auto-create app_clientes from briefing data
  const createAppFromBriefing = useMutation({
    mutationFn: async () => {
      if (!hasBriefingRequest) throw new Error('Nenhuma solicitação encontrada');
      const { error } = await supabase.from('app_clientes').insert({
        nome: hasBriefingRequest.requester_name,
        empresa: hasBriefingRequest.platform_url,
        email: hasBriefingRequest.requester_email,
        plataforma: 'ambos',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-app'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-briefing-check'] });
      toast.success('Projeto de aplicativo criado com sucesso! 🎉');
      navigate('/cliente/aplicativo');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isLoading = loadingArtes || loadingApp || loadingChecklist;

  // Combine all real pendencies
  const allPendencies = [...appPendencies, ...artPendencies];
  const hasRealPendencies = allPendencies.length > 0;

  const greetingData = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Bom dia', gif: 'https://media.giphy.com/media/3oriO0OEd9QIDdllqo/giphy.gif' };
    if (h < 18) return { text: 'Boa tarde', gif: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' };
    return { text: 'Boa noite', gif: 'https://media.giphy.com/media/3o7abAHdYvZdBNnGZq/giphy.gif' };
  };

  const { text: greetingText, gif: greetingGif } = greetingData();

  const greetingSubtitle = hasRealPendencies
    ? `Você tem ${allPendencies.length} pendência${allPendencies.length > 1 ? 's' : ''} para resolver`
    : 'Você está em dia! Nenhuma pendência no momento 🎉';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting with spring */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="flex items-center gap-4"
      >
        <motion.img
          src={greetingGif}
          alt="Saudação"
          className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/10"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 12 }}
        />
        <div>
          <motion.h1
            className="text-2xl font-bold"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, type: 'spring', stiffness: 150, damping: 12 }}
          >
            {greetingText}! 👋
          </motion.h1>
          <motion.p
            className="text-white/50 text-sm mt-1"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 100, damping: 15 }}
          >
            {greetingSubtitle}
          </motion.p>
        </div>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/cliente/solicitar')}
          className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <Palette className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-semibold text-sm">Solicitar Design</p>
            <p className="text-white/70 text-[10px]">Peça novas artes</p>
          </div>
        </button>

        <button
          onClick={() => {
            if (appCliente) return;
            if (hasBriefingRequest) {
              createAppFromBriefing.mutate();
            } else {
              navigate('/cliente/solicitar-app');
            }
          }}
          disabled={!!appCliente || createAppFromBriefing.isPending}
          className={cn(
            "flex items-center gap-3 rounded-xl p-4 text-white shadow-lg transition-all",
            appCliente
              ? "bg-white/10 opacity-50 cursor-not-allowed shadow-none"
              : "bg-gradient-to-r from-blue-500 to-indigo-500 shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="font-semibold text-sm">
              {appCliente ? 'App solicitado' : createAppFromBriefing.isPending ? 'Criando...' : 'Solicitar App'}
            </p>
            <p className="text-white/70 text-[10px]">
              {appCliente ? 'Já em andamento' : hasBriefingRequest ? 'Criar a partir do briefing' : 'Crie seu aplicativo'}
            </p>
          </div>
        </button>
      </motion.div>

      {/* Status cards with 3D hover */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">📊 Acompanhe suas artes, aplicativos e migrações</h2>

        {/* App status */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, type: 'spring', stiffness: 100, damping: 14 }}
          whileHover={{ scale: 1.015, rotateX: 2, rotateY: -1 }}
          style={{ perspective: 800 }}
        >
          {appCliente?.status === 'cancelado' ? (
            <Card className="bg-[#1E293B] border-destructive/20 cursor-pointer hover:border-destructive/30 transition-colors"
              onClick={() => {
                createAppFromBriefing.mutate();
              }}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive/70">Solicitação cancelada</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {(appCliente as any).motivo_cancelamento || 'Seu fluxo de aplicativo foi cancelado'}
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    <PlusCircle className="h-3.5 w-3.5" />
                    Solicitar novamente
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => navigate('/cliente/aplicativo')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-white/50 mb-0.5">Aplicativo</p>
                    {appPendencies.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] ml-1">
                        {appPendencies.length} pendência{appPendencies.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {appCliente ? (
                    <>
                      <p className="text-sm font-medium">
                        {appCliente.fase_atual >= 6
                          ? '🎉 Publicado!'
                          : `${appCliente.porcentagem_geral}% concluído`}
                      </p>
                      <Progress value={appCliente.porcentagem_geral} className="h-1.5 bg-white/10 mt-1.5" />
                    </>
                  ) : (
                    <p className="text-sm text-white/40">Nenhum projeto de app vinculado</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Artes status */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, type: 'spring', stiffness: 100, damping: 14 }}
          whileHover={{ scale: 1.015, rotateX: 2, rotateY: 1 }}
          style={{ perspective: 800 }}
        >
          <Card className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
            onClick={() => navigate('/cliente/artes')}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <Palette className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-white/50 mb-0.5">Validação de Artes</p>
                  {artPendencies.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] ml-1">
                      {artPendencies.length} para aprovar
                    </Badge>
                  )}
                </div>
                {artesData?.counts?.total > 0 ? (
                  <>
                    <p className="text-sm font-medium">
                      {artesData.counts.completed || 0} de {artesData.counts.total} aprovadas
                      {(artesData.counts.review || 0) > 0 && (
                        <span className="text-amber-400 ml-1">• {artesData.counts.review} para validar</span>
                      )}
                    </p>
                    <Progress
                      value={((artesData.counts.completed || 0) / artesData.counts.total) * 100}
                      className="h-1.5 bg-white/10 mt-1.5"
                    />
                  </>
                ) : (
                  <p className="text-sm text-white/40">Nenhuma arte no momento</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Migration status */}
        <MigrationStatusCard clientEmail={clientEmail} navigate={navigate} />
      </div>

      {/* Pending actions — strong highlight */}
      {hasRealPendencies ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 animate-pulse" />
            <h3 className="text-sm font-bold text-amber-300">
              🔔 Ações Pendentes ({allPendencies.length})
            </h3>
          </div>
          {allPendencies.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <div
                className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${
                  item.source === 'app'
                    ? 'border-l-amber-500 bg-amber-500/5 border border-amber-500/20'
                    : 'border-l-purple-500 bg-purple-500/5 border border-purple-500/20'
                } hover:bg-white/[0.08] cursor-pointer transition-colors`}
                onClick={() => {
                  if (item.source === 'app') navigate('/cliente/aplicativo');
                  else navigate('/cliente/artes');
                }}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  item.source === 'app' ? 'bg-amber-500/10' : 'bg-purple-500/10'
                }`}>
                  {item.source === 'app' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-purple-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.texto}</p>
                  <p className="text-xs text-white/40">{item.subtitle}</p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${
                  item.source === 'app' ? 'border-amber-500/30 text-amber-400' : 'border-purple-500/30 text-purple-400'
                }`}>
                  {item.source === 'app' ? 'Aplicativo' : 'Arte'}
                </Badge>
                <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="bg-[#1E293B] border-white/10 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-medium">Tudo em dia! 🎉</p>
                <p className="text-sm text-white/40 mt-1">Nenhuma pendência no momento. Que tal solicitar algo novo?</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
                <Card className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => navigate('/cliente/solicitar')}>
                  <CardContent className="p-4 text-center">
                    <Palette className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">Solicitar Artes</p>
                    <p className="text-xs text-white/50">Banners, capas, login</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition-colors" onClick={() => navigate('/cliente/solicitar-app')}>
                  <CardContent className="p-4 text-center">
                    <Smartphone className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">Solicitar App</p>
                    <p className="text-xs text-white/50">Aplicativo mobile</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Unified Timeline: Suas Solicitações */}
      <TimelineSection clientEmail={clientEmail} appCliente={appCliente} navigate={navigate} />
    </div>
  );
}

// ─── Migration Status Card ───────────────────────────────────
function MigrationStatusCard({ clientEmail, navigate }: { clientEmail: string | null; navigate: (path: string) => void }) {
  const STATUS_LABELS: Record<string, string> = {
    waiting_form: 'Aguardando formulário',
    analysis: 'Em análise',
    rejected: 'Ajustes solicitados',
    extraction: 'Extração de dados',
    in_progress: 'Migração em andamento',
    completed: 'Concluído',
  };

  const { data: migrationProject } = useQuery({
    queryKey: ['cliente-migration-home', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data } = await supabase
        .from('migration_projects')
        .select('*')
        .eq('client_email', clientEmail!)
        .eq('has_migration', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!migrationProject) return null;

  const statusOrder: Record<string, number> = { waiting_form: 0, analysis: 1, rejected: 1, extraction: 2, in_progress: 3, completed: 4 };
  const progress = migrationProject.migration_status === 'completed' ? 100 : ((statusOrder[migrationProject.migration_status] || 0) / 4) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24, type: 'spring', stiffness: 100, damping: 14 }}
      whileHover={{ scale: 1.015, rotateX: 2, rotateY: -1 }}
      style={{ perspective: 800 }}
    >
      <Card className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
        onClick={() => navigate('/cliente/migracao')}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
            <ArrowRightLeft className="h-5 w-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-white/50 mb-0.5">Migração</p>
              {migrationProject.migration_status === 'rejected' && (
                <Badge variant="destructive" className="text-[10px] ml-1">Ajustes necessários</Badge>
              )}
            </div>
            <p className="text-sm font-medium">
              {STATUS_LABELS[migrationProject.migration_status] || migrationProject.migration_status}
            </p>
            <Progress value={progress} className="h-1.5 bg-white/10 mt-1.5" />
          </div>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
        </CardContent>
      </Card>
    </motion.div>
  );
}
