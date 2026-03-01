import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Circle, MessageSquare, Star, Lock, AlertTriangle,
  ExternalLink, Upload, Image as ImageIcon, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const FASE_NAMES = ['Pré-Requisitos','Primeiros Passos','Validação pela Loja','Assets e Mockup','Formulário do App','Criação e Submissão','Aprovação das Lojas','Teste do App','Publicado 🎉'];

interface Props {
  clienteId: string;
}

export default function AppClientPortalContent({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [expandedFase, setExpandedFase] = useState<number | null>(null);
  const [assetComment, setAssetComment] = useState<Record<string, string>>({});
  const [assetCommenting, setAssetCommenting] = useState<string | null>(null);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['portal-cliente', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_clientes').select('*').eq('id', clienteId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: fases = [] } = useQuery({
    queryKey: ['portal-fases', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_fases').select('*').eq('cliente_id', clienteId).order('numero');
      if (error) throw error;
      return data;
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ['portal-checklist', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_checklist_items').select('*').eq('cliente_id', clienteId).order('ordem');
      if (error) throw error;
      return data;
    },
  });

  const { data: formulario } = useQuery({
    queryKey: ['portal-formulario', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_formulario').select('*').eq('cliente_id', clienteId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: prereqs } = useQuery({
    queryKey: ['portal-prereqs', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_prerequisitos').select('*').eq('cliente_id', clienteId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: assets = [] } = useQuery({
    queryKey: ['portal-assets', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase.from('app_assets').select('*').eq('cliente_id', clienteId);
      if (error) throw error;
      return data || [];
    },
  });

  const [formData, setFormData] = useState({ nome_app: '', descricao_curta: '', descricao_longa: '', url_privacidade: '', url_termos: '' });

  useEffect(() => {
    if (formulario) {
      setFormData({
        nome_app: formulario.nome_app || '',
        descricao_curta: formulario.descricao_curta || '',
        descricao_longa: formulario.descricao_longa || '',
        url_privacidade: formulario.url_privacidade || '',
        url_termos: formulario.url_termos || '',
      });
    }
  }, [formulario]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-checklist'] });
    queryClient.invalidateQueries({ queryKey: ['portal-fases'] });
    queryClient.invalidateQueries({ queryKey: ['portal-cliente'] });
    queryClient.invalidateQueries({ queryKey: ['portal-assets'] });
  };

  const checkFaseCompletion = () => {
    setTimeout(() => {
      const currentFaseItems = checklist.filter(i => i.fase_numero === cliente?.fase_atual && i.ator === 'cliente' && i.obrigatorio);
      const allDone = currentFaseItems.every(i => i.feito);
      if (allDone && currentFaseItems.length > 0) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        toast.success('🎉 Etapa concluída! Nossa equipe foi notificada.');
      }
    }, 500);
  };

  const toggleCheck = useMutation({
    mutationFn: async ({ id, feito }: { id: string; feito: boolean }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        feito, feito_em: feito ? new Date().toISOString() : null, feito_por: 'cliente',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      checkFaseCompletion();
    },
  });

  const approveAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from('app_assets').update({
        status: 'aprovado', aprovado_em: new Date().toISOString(),
      }).eq('id', assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Asset aprovado! ✅');
    },
  });

  const requestAssetAdjust = useMutation({
    mutationFn: async ({ assetId, comment }: { assetId: string; comment: string }) => {
      const { error } = await supabase.from('app_assets').update({
        status: 'ajuste_solicitado', comentario_cliente: comment,
      }).eq('id', assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      setAssetCommenting(null);
      setAssetComment({});
      toast.success('Ajuste solicitado!');
    },
  });

  const saveForm = useMutation({
    mutationFn: async () => {
      const complete = !!(formData.nome_app && formData.descricao_curta && formData.url_privacidade);
      const { error } = await supabase.from('app_formulario').update({
        ...formData,
        preenchido_completo: complete,
        enviado_em: complete ? new Date().toISOString() : null,
      }).eq('cliente_id', clienteId);
      if (error) throw error;
      if (complete) {
        const formItems = checklist.filter(i => i.fase_numero === 4 && i.ator === 'cliente' && i.tipo === 'form');
        for (const item of formItems) {
          await supabase.from('app_checklist_items').update({ feito: true, feito_em: new Date().toISOString(), feito_por: 'cliente' }).eq('id', item.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-formulario'] });
      invalidateAll();
      toast.success('Formulário salvo!');
      checkFaseCompletion();
    },
  });

  useEffect(() => {
    if (cliente?.fase_atual === 8) {
      setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } }), 500);
    }
  }, [cliente?.fase_atual]);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (!cliente) return <div className="text-center py-12 text-white/50">Dados não encontrados</div>;

  const currentItems = checklist.filter(i => i.fase_numero === cliente.fase_atual && i.ator === 'cliente' && !i.feito);
  const hasClientAction = currentItems.length > 0;
  const pendingAssets = assets.filter((a: any) => a.status === 'aguardando');
  const inactiveDays = cliente.ultima_acao_cliente
    ? Math.floor((Date.now() - new Date(cliente.ultima_acao_cliente).getTime()) / 86400000)
    : null;

  const dynamicMessage = cliente.status === 'concluido'
    ? '🎉 Seu app está publicado!'
    : inactiveDays && inactiveDays > 2
    ? `Sua última ação foi há ${inactiveDays} dias. Que tal continuarmos?`
    : cliente.status === 'atrasado'
    ? `Você tem ${currentItems.length} pendências. Cada dia conta!`
    : 'Você está no prazo! Continue assim 🚀';

  const extractLink = (desc?: string | null) => {
    if (!desc) return null;
    const match = desc.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  };

  const renderChecklistItem = (item: any) => {
    if (item.tipo === 'link') {
      const link = extractLink(item.descricao);
      return (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <Checkbox
            checked={item.feito}
            onCheckedChange={(checked) => toggleCheck.mutate({ id: item.id, feito: !!checked })}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">{item.texto}</p>
            {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                <ExternalLink className="h-3 w-3" /> Acessar link
              </a>
            )}
          </div>
        </div>
      );
    }

    if (item.tipo === 'approval') {
      return (
        <div key={item.id} className="space-y-3 p-3 rounded-lg bg-white/5">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 mt-0.5 text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
            </div>
          </div>
          {pendingAssets.length > 0 && (
            <div className="space-y-2 ml-8">
              {pendingAssets.map((asset: any) => (
                <div key={asset.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    {asset.url ? (
                      <img src={asset.url} alt={asset.nome_arquivo} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{asset.nome_arquivo || asset.tipo}</p>
                      <p className="text-xs text-white/40">{asset.tipo}</p>
                    </div>
                  </div>
                  {assetCommenting === asset.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Descreva o ajuste necessário..."
                        className="bg-white/5 border-white/10 text-white text-sm min-h-[60px]"
                        value={assetComment[asset.id] || ''}
                        onChange={e => setAssetComment(p => ({ ...p, [asset.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1"
                          disabled={!assetComment[asset.id]?.trim()}
                          onClick={() => requestAssetAdjust.mutate({ assetId: asset.id, comment: assetComment[asset.id] })}>
                          Enviar ajuste
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setAssetCommenting(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveAsset.mutate(asset.id)}>
                        ✅ Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/20" onClick={() => setAssetCommenting(asset.id)}>
                        💬 Solicitar ajuste
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {pendingAssets.length === 0 && (
            <p className="text-xs text-white/40 ml-8">Nenhum asset aguardando aprovação no momento.</p>
          )}
        </div>
      );
    }

    if (item.tipo === 'form') {
      return null; // Rendered separately in form section
    }

    // Default: check type
    return (
      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <Checkbox
          checked={item.feito}
          onCheckedChange={(checked) => toggleCheck.mutate({ id: item.id, feito: !!checked })}
          className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
        />
        <div className="flex-1">
          <p className="text-sm font-medium">{item.texto}</p>
          {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      {cliente.fase_atual === 8 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4 py-8">
          <h1 className="text-3xl font-extrabold">🎉 SEU APP ESTÁ PUBLICADO!</h1>
          <p className="text-white/70 text-lg">Parabéns! Seu app da {cliente.empresa} está disponível nas lojas.</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">Olá! 👋</h1>
            <p className="text-white/60 text-sm mt-1">Seu app está <span className="text-white font-bold">{cliente.porcentagem_geral}%</span> pronto</p>
          </div>
          <Progress value={cliente.porcentagem_geral} className="h-3 bg-white/10" />
          <div className="flex flex-wrap gap-4 text-sm text-white/60">
            <span>📍 Etapa atual: <span className="text-white/80">{FASE_NAMES[cliente.fase_atual]}</span></span>
            {cliente.prazo_estimado && <span>🗓️ Estimativa: {format(new Date(cliente.prazo_estimado), 'dd/MM/yyyy')}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cliente.status === 'atrasado' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
              {cliente.status === 'atrasado' ? '⚠️ Atrasado' : '✅ No prazo'}
            </Badge>
          </div>
          <p className="text-sm text-white/70">⚡ {dynamicMessage}</p>
        </motion.div>
      )}

      {/* CNPJ Alert */}
      {prereqs?.cnpj_bloqueado && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="bg-red-500/10 border-red-500/30 p-4 text-red-400">
            <p className="font-semibold">⚠️ Atenção: CNPJ MEI não é aceito pela Apple</p>
            <p className="text-sm mt-1 text-red-400/70">Entre em contato com nossa equipe para resolver isso.</p>
          </Card>
        </motion.div>
      )}

      {/* What to do now */}
      {cliente.fase_atual < 8 && (
        <Card className="bg-[#1E293B] border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {hasClientAction ? '📋 O que fazer agora' : '⏳ Nossa equipe está trabalhando'}
          </h2>
          {hasClientAction ? (
            <div className="space-y-3">
              {currentItems.map(item => renderChecklistItem(item))}
            </div>
          ) : (
            <div className="text-center py-4 text-white/50">
              <p>Você será notificado assim que precisarmos de você!</p>
            </div>
          )}
        </Card>
      )}

      {/* Form (phase 4) */}
      {cliente.fase_atual === 4 && (
        <Card className="bg-[#1E293B] border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">📝 Dados do seu aplicativo</h2>
          <div className="space-y-3">
            <div>
              <Label className="text-white/70">Nome do aplicativo *</Label>
              <Input className="bg-white/5 border-white/10 text-white" value={formData.nome_app} onChange={e => setFormData(p => ({ ...p, nome_app: e.target.value }))} />
            </div>
            <div>
              <Label className="text-white/70">Descrição curta * ({formData.descricao_curta.length}/80)</Label>
              <Input className="bg-white/5 border-white/10 text-white" value={formData.descricao_curta} maxLength={80} onChange={e => setFormData(p => ({ ...p, descricao_curta: e.target.value }))} />
            </div>
            <div>
              <Label className="text-white/70">Descrição completa ({formData.descricao_longa.length}/4000)</Label>
              <Textarea className="bg-white/5 border-white/10 text-white min-h-[120px]" value={formData.descricao_longa} maxLength={4000} onChange={e => setFormData(p => ({ ...p, descricao_longa: e.target.value }))} />
            </div>
            <div>
              <Label className="text-white/70">URL Política de Privacidade *</Label>
              <Input className="bg-white/5 border-white/10 text-white" value={formData.url_privacidade} onChange={e => setFormData(p => ({ ...p, url_privacidade: e.target.value }))} />
            </div>
            <div>
              <Label className="text-white/70">URL Termos de Uso</Label>
              <Input className="bg-white/5 border-white/10 text-white" value={formData.url_termos} onChange={e => setFormData(p => ({ ...p, url_termos: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={() => saveForm.mutate()} disabled={saveForm.isPending || !formData.nome_app || !formData.descricao_curta || !formData.url_privacidade}>
              {saveForm.isPending ? 'Salvando...' : 'Enviar formulário'}
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold mb-4">🗺️ Sua jornada</h2>
        {fases.map((fase: any, idx: number) => {
          const isCurrent = fase.numero === cliente.fase_atual;
          const isDone = fase.status === 'concluida';
          const isBlocked = fase.status === 'bloqueada';
          const isLate = fase.status === 'atrasada';
          const faseItems = checklist.filter((i: any) => i.fase_numero === fase.numero);
          const doneCount = faseItems.filter((i: any) => i.feito && i.obrigatorio).length;
          const totalCount = faseItems.filter((i: any) => i.obrigatorio).length;

          const getIcon = () => {
            if (isDone) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
            if (isLate) return <AlertTriangle className="h-5 w-5 text-red-500" />;
            if (isCurrent) return <Star className="h-5 w-5 text-primary animate-pulse" />;
            return <Lock className="h-5 w-5 text-white/20" />;
          };

          return (
            <motion.div key={fase.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center w-8">
                  {idx > 0 && <div className={`w-0.5 h-4 ${isDone || isCurrent ? 'bg-green-500' : 'bg-white/10'}`} />}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isDone ? 'bg-green-500/20' : isCurrent ? 'bg-primary/20 ring-2 ring-primary/50' : isLate ? 'bg-red-500/20' : 'bg-white/5'
                  }`}>
                    {getIcon()}
                  </div>
                  {idx < fases.length - 1 && <div className={`w-0.5 h-4 ${isDone ? 'bg-green-500' : 'bg-white/10'}`} />}
                </div>
                <button
                  className={`flex-1 text-left p-3 rounded-lg transition-colors ${
                    isCurrent ? 'bg-primary/10 border border-primary/30' : isDone ? 'bg-green-500/5' : 'opacity-50'
                  } ${!isBlocked ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'}`}
                  onClick={() => !isBlocked && setExpandedFase(expandedFase === fase.numero ? null : fase.numero)}
                  disabled={isBlocked}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{fase.nome}</span>
                    {isDone && <Badge className="bg-green-500/20 text-green-400 text-[10px]">Concluída</Badge>}
                    {isCurrent && <Badge className="bg-primary/20 text-primary text-[10px]">Em andamento</Badge>}
                    {isLate && <Badge className="bg-red-500/20 text-red-400 text-[10px]">Atrasada</Badge>}
                  </div>
                  {(isCurrent || isDone) && totalCount > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={totalCount > 0 ? (doneCount / totalCount) * 100 : 0} className="flex-1 h-1 bg-white/10" />
                      <span className="text-[10px] text-white/40">{doneCount}/{totalCount}</span>
                    </div>
                  )}
                </button>
              </div>
              {expandedFase === fase.numero && !isBlocked && (
                <div className="ml-11 mt-1 mb-2 space-y-1">
                  {faseItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs py-1">
                      {item.feito ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Circle className="h-3.5 w-3.5 text-white/30" />}
                      <span className={item.feito ? 'text-white/40 line-through' : 'text-white/70'}>{item.texto}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-white/30">{item.ator}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Support */}
      <Card className="bg-[#1E293B] border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-3">💬 Suporte</h2>
        <div className="space-y-2 text-sm text-white/60">
          {cliente.responsavel_nome && (
            <p>Seu responsável: <span className="text-white">{cliente.responsavel_nome}</span></p>
          )}
          {cliente.whatsapp && (
            <a href={`https://wa.me/${cliente.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-400 hover:text-green-300">
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      </Card>

      {/* Achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🏆 Conquistas</h2>
        <div className="flex flex-wrap gap-2">
          {fases.filter((f: any) => f.status === 'concluida').map((f: any) => (
            <motion.div key={f.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Badge className="bg-green-500/20 text-green-400 px-3 py-1.5">
                🏆 {f.nome}
                {f.data_conclusao && <span className="ml-1 opacity-60 text-[10px]">{format(new Date(f.data_conclusao), 'dd/MM/yyyy')}</span>}
              </Badge>
            </motion.div>
          ))}
          {fases.filter((f: any) => f.status === 'concluida').length === 0 && (
            <p className="text-sm text-white/30">Complete etapas para desbloquear conquistas!</p>
          )}
        </div>
      </div>
    </div>
  );
}
