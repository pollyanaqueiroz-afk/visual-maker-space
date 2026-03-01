import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, AlertTriangle, Palette, Smartphone, Eye, Upload, FileText,
  ChevronRight, Loader2, Sparkles, PlusCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface PendingAction {
  id: string;
  type: 'arte' | 'checklist' | 'form' | 'upload' | 'approval';
  module: 'artes' | 'aplicativo';
  title: string;
  description?: string;
  urgency: 'normal' | 'high';
}

export default function ClienteHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const clientEmail = user?.email || '';

  // Fetch artes pending review
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

  // Fetch app checklist items for client
  const { data: appChecklist = [], isLoading: loadingChecklist } = useQuery({
    queryKey: ['cliente-app-checklist', appCliente?.id],
    enabled: !!appCliente?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_checklist_items')
        .select('*')
        .eq('cliente_id', appCliente!.id)
        .eq('ator', 'cliente')
        .eq('feito', false)
        .order('fase_numero')
        .order('ordem');
      if (error) throw error;
      return data;
    },
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

  // Build pending actions list
  const pendingActions: PendingAction[] = [];

  // Artes pending approval
  const artesReview = artesData?.images?.review || [];
  if (artesReview.length > 0) {
    pendingActions.push({
      id: 'artes-review',
      type: 'arte',
      module: 'artes',
      title: `${artesReview.length} arte(s) aguardando sua validação`,
      description: 'Aprove ou solicite refação das artes entregues',
      urgency: 'high',
    });
  }

  // App checklist items
  const currentFaseItems = appChecklist.filter(i => i.fase_numero === appCliente?.fase_atual);
  currentFaseItems.forEach(item => {
    const itemType = item.tipo === 'form' ? 'form' : item.tipo === 'upload' ? 'upload' : item.tipo === 'approval' ? 'approval' : 'checklist';
    pendingActions.push({
      id: item.id,
      type: itemType as any,
      module: 'aplicativo',
      title: item.texto,
      description: item.descricao || undefined,
      urgency: 'normal',
    });
  });

  // App form not complete
  if (appCliente && appCliente.fase_atual === 4 && appForm && !appForm.preenchido_completo) {
    pendingActions.push({
      id: 'app-form',
      type: 'form',
      module: 'aplicativo',
      title: 'Preencher formulário do aplicativo',
      description: 'Nome, descrição e política de privacidade do app',
      urgency: 'high',
    });
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'arte': return <Eye className="h-4 w-4 text-primary" />;
      case 'checklist': return <CheckCircle className="h-4 w-4 text-blue-400" />;
      case 'form': return <FileText className="h-4 w-4 text-amber-400" />;
      case 'upload': return <Upload className="h-4 w-4 text-purple-400" />;
      case 'approval': return <Sparkles className="h-4 w-4 text-yellow-400" />;
      default: return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getModuleIcon = (module: string) => {
    return module === 'artes'
      ? <Palette className="h-3 w-3" />
      : <Smartphone className="h-3 w-3" />;
  };

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  };

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
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">{greeting()}! 👋</h1>
        <p className="text-white/50 text-sm mt-1">
          {pendingActions.length > 0
            ? `Você tem ${pendingActions.length} pendência(s) para resolver`
            : 'Você está em dia! Nenhuma pendência no momento 🎉'}
        </p>
      </motion.div>

      {/* CTA Solicitar Design */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <button
          onClick={() => navigate('/cliente/solicitar')}
          className="w-full flex items-center gap-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-semibold text-base">Solicitar Design</p>
            <p className="text-white/80 text-xs">Peça novas artes para sua plataforma</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
        </button>
      </motion.div>

      {/* App progress summary */}
      {appCliente && appCliente.fase_atual < 8 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
            onClick={() => navigate('/cliente/aplicativo')}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Seu aplicativo está {appCliente.porcentagem_geral}% pronto</p>
                <Progress value={appCliente.porcentagem_geral} className="h-1.5 bg-white/10 mt-1.5" />
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Artes summary */}
      {artesData?.counts?.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
            onClick={() => navigate('/cliente/artes')}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{artesData.counts.completed || 0} artes aprovadas de {artesData.counts.total}</p>
                <Progress
                  value={artesData.counts.total > 0 ? ((artesData.counts.completed || 0) / artesData.counts.total) * 100 : 0}
                  className="h-1.5 bg-white/10 mt-1.5"
                />
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Pending actions */}
      {pendingActions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">📋 Suas pendências</h2>
          {pendingActions.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card
                className="bg-[#1E293B] border-white/10 cursor-pointer hover:border-white/20 transition-colors"
                onClick={() => navigate(action.module === 'artes' ? '/cliente/artes' : '/cliente/aplicativo')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5">
                    {getIcon(action.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-white/50 gap-1">
                        {getModuleIcon(action.module)}
                        {action.module === 'artes' ? 'Artes' : 'Aplicativo'}
                      </Badge>
                      {action.urgency === 'high' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Urgente</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{action.title}</p>
                    {action.description && (
                      <p className="text-xs text-white/40 truncate">{action.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 shrink-0" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* All done state */}
      {pendingActions.length === 0 && (
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
