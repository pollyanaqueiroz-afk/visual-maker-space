import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Eye, Smartphone, ChevronRight, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import type { NavigateFunction } from 'react-router-dom';

const IMAGE_TYPE_LABELS: Record<string, string> = {
  login: 'Área de Login',
  banner_vitrine: 'Banner Vitrine',
  product_cover: 'Capa de Produto',
  trail_banner: 'Banner de Trilha',
  challenge_banner: 'Banner de Desafio',
  community_banner: 'Banner de Comunidade',
  app_mockup: 'Mockup do Aplicativo',
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Aprovada', className: 'border-green-500/30 text-green-400' },
  review: { label: '👀 Validar', className: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  in_progress: { label: 'Em produção', className: 'border-blue-500/30 text-blue-400' },
  cancelled: { label: 'Cancelada', className: 'border-destructive/30 text-destructive' },
  pending: { label: 'Pendente', className: 'border-white/20 text-white/50' },
};

interface Props {
  clientEmail: string;
  appCliente: any;
  navigate: NavigateFunction;
}

export default function TimelineSection({ clientEmail, appCliente, navigate }: Props) {
  const { data: allBriefings = [] } = useQuery({
    queryKey: ['cliente-all-briefings', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, status, created_at, assigned_email, deadline, revision_count, briefing_requests!inner(platform_url, requester_email)')
        .eq('briefing_requests.requester_email', clientEmail)
        .order('created_at', { ascending: false });
      return data || [];
    },
    staleTime: 60_000,
  });

  const reviewCount = allBriefings.filter(a => a.status === 'review').length;
  const hasItems = allBriefings.length > 0 || !!appCliente;

  if (!hasItems) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-white/50" />
        <h2 className="text-lg font-semibold">Suas Solicitações</h2>
      </div>

      {reviewCount > 0 && (
        <div
          className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15 transition-colors"
          onClick={() => navigate('/cliente/artes')}
        >
          <Eye className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300">
            {reviewCount} arte{reviewCount > 1 ? 's' : ''} aguardando sua aprovação
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-amber-400/50 ml-auto shrink-0" />
        </div>
      )}

      {/* Scroll snap container for mobile */}
      <div className="space-y-1.5 md:space-y-1.5 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory flex md:flex-col gap-3 md:gap-0 pb-2 md:pb-0 -mx-1 px-1">
        {allBriefings.map((art, i) => {
          const cfg = STATUS_CONFIG[art.status] || STATUS_CONFIG.pending;
          const isReview = art.status === 'review';
          const isDone = art.status === 'completed';
          return (
            <motion.div
              key={art.id}
              initial={{ opacity: 0, x: -15, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.06 * i, type: 'spring', stiffness: 120, damping: 14 }}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors snap-start min-w-[280px] md:min-w-0 ${
                isDone
                  ? 'bg-white/[0.03] border-white/5 opacity-60'
                  : isReview
                    ? 'bg-amber-500/5 border-amber-500/20 ring-1 ring-amber-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
              }`}
              onClick={() => navigate('/cliente/artes')}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/10 ${isReview ? 'animate-pulse' : ''}`}>
                <Palette className="h-4 w-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {IMAGE_TYPE_LABELS[art.image_type] || art.image_type}
                  {art.product_name ? ` — ${art.product_name}` : ''}
                </p>
                <p className="text-xs text-white/40">
                  {format(new Date(art.created_at), 'dd/MM/yyyy')}
                </p>
              </div>
              <Badge variant="outline" className={`text-[10px] shrink-0 ${cfg.className} ${isReview ? 'animate-pulse' : ''}`}>
                {cfg.label}
              </Badge>
            </motion.div>
          );
        })}

        {appCliente && appCliente.status !== 'cancelado' && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * allBriefings.length }}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.08] cursor-pointer transition-colors snap-start min-w-[280px] md:min-w-0"
            onClick={() => navigate('/cliente/aplicativo')}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
              <Smartphone className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Aplicativo</p>
              <p className="text-xs text-white/40">
                Fase {appCliente.fase_atual} — {appCliente.porcentagem_geral || 0}%
              </p>
            </div>
            <Progress value={appCliente.porcentagem_geral || 0} className="h-1.5 w-16 bg-white/10 shrink-0" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
