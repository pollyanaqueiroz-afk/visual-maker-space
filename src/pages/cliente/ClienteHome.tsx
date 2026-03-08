import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, AlertTriangle, Palette, Smartphone, Eye, Upload, FileText,
  ChevronRight, Loader2, Sparkles, PlusCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function ClienteHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clientEmail = user?.email || '';

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

  // Fetch app client data
  const { data: appCliente, isLoading: loadingApp } = useQuery({
    queryKey: ['cliente-app', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_clientes')
        .select('*')
        .eq('email', clientEmail)
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
      const { data, error } = await supabase
        .from('app_checklist_items')
        .select('id, texto, descricao, fase_numero, tipo, ordem')
        .eq('cliente_id', appCliente!.id)
        .eq('ator', 'cliente')
        .eq('feito', false)
        .order('fase_numero')
        .order('ordem');
      if (error) throw error;
      const FASE_NAMES = ['Pré-Requisitos', 'Primeiros Passos', 'Validação pela Loja', 'Criação e Submissão', 'Aprovação das Lojas', 'Teste do App', 'Publicado'];
      return (data || []).map(i => ({
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
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="flex items-center gap-4">
        <motion.img
          src={greetingGif}
          alt="Saudação"
          className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/10"
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        />
        <div>
          <motion.h1
            className="text-2xl font-bold"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {greetingText}! 👋
          </motion.h1>
          <motion.p
            className="text-white/50 text-sm mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
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
          onClick={() => !appCliente && navigate('/cliente/solicitar-app')}
          disabled={!!appCliente}
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
            <p className="font-semibold text-sm">{appCliente ? 'App solicitado' : 'Solicitar App'}</p>
            <p className="text-white/70 text-[10px]">{appCliente ? 'Já em andamento' : 'Crie seu aplicativo'}</p>
          </div>
        </button>
      </motion.div>

      {/* Status cards */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">📊 Status dos seus projetos</h2>

        {/* App status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
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
        </motion.div>

        {/* Artes status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
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
      </div>

      {/* Pending actions */}
      {hasRealPendencies ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-white/80 mb-3">
            📋 Suas pendências ({allPendencies.length})
          </h3>
          {allPendencies.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.08] cursor-pointer transition-colors"
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
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Card className="bg-[#1E293B] border-white/10 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="font-medium">Tudo em dia! 🎉</p>
              <p className="text-sm text-white/40 mt-1">Nenhuma pendência no momento. Fique tranquilo!</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
