import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Circle, MessageSquare, Star, Lock, AlertTriangle,
  ExternalLink, Upload, Image as ImageIcon, Loader2, ChevronDown, ChevronUp,
  Palette, Clock, Eye, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { format, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ── Step-by-step guides ──
const STEP_BY_STEP: Record<string, string[]> = {
  'Solicitei o número DUNS da minha empresa': [
    '1. Acesse o site https://www.dnb.com/de-de/upik-en.html',
    '2. Clique em "Request a D-U-N-S Number"',
    '3. Preencha os dados da sua empresa (razão social, CNPJ, endereço)',
    '4. Informe um e-mail corporativo para receber o número',
    '5. Aguarde o retorno por e-mail (pode levar até 14 dias úteis)',
    '6. Após receber, guarde o número — ele será necessário nas próximas etapas',
  ],
  'Confirmei que meu CNPJ é ME ou LTDA': [
    '1. Acesse o site da Receita Federal: https://servicos.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp',
    '2. Digite o número do seu CNPJ e consulte',
    '3. Verifique o campo "Natureza Jurídica"',
    '4. Deve constar ME (Microempresa) ou LTDA — CNPJs MEI não são aceitos pela Apple',
    '5. Se for MEI, será necessário alterar o tipo antes de prosseguir',
  ],
  'Tenho um e-mail corporativo': [
    '1. O e-mail precisa ser no formato seunome@suaempresa.com.br',
    '2. E-mails gratuitos (Gmail, Hotmail) não são aceitos',
    '3. Configure pelo painel do seu provedor de domínio (ex: Google Workspace, Zoho Mail)',
    '4. Teste enviando e recebendo e-mails para garantir que funciona',
  ],
  'Meu site está publicado com domínio próprio': [
    '1. Seu site precisa estar acessível publicamente (ex: www.suaempresa.com.br)',
    '2. Não pode ser um subdomínio gratuito (ex: .wixsite.com, .blogspot.com)',
    '3. Verifique se possui certificado SSL (cadeado no navegador)',
    '4. O site deve conter informações básicas sobre sua empresa',
  ],
  'Criei a conta no Google Play Console': [
    '1. Acesse https://play.google.com/console/signup',
    '2. Faça login com a conta Google da empresa',
    '3. Aceite os termos de desenvolvedor',
    '4. Pague a taxa única de US$ 25',
    '5. Preencha os dados da organização (nome, endereço, site)',
    '6. Aguarde a verificação da conta (pode levar 48h)',
  ],
  'Adicionei apps@membros.app.br como admin (Google)': [
    '1. Acesse o Google Play Console → https://play.google.com/console',
    '2. Vá em "Usuários e permissões" no menu lateral',
    '3. Clique em "Convidar novos usuários"',
    '4. Digite o e-mail: apps@membros.app.br',
    '5. Marque a permissão "Admin" (acesso total)',
    '6. Clique em "Enviar convite"',
  ],
  'Criei a conta no Apple Developer Program': [
    '1. Acesse https://developer.apple.com/account',
    '2. Faça login com o Apple ID corporativo',
    '3. Clique em "Join the Apple Developer Program"',
    '4. Escolha "Organization" como tipo de conta',
    '5. Informe o número DUNS da empresa',
    '6. Pague a taxa anual de US$ 99',
    '7. Aguarde a aprovação (pode levar de 24h a 2 semanas)',
  ],
  'Adicionei apps@membros.app.br como admin (Apple)': [
    '1. Acesse o App Store Connect → https://appstoreconnect.apple.com',
    '2. Vá em "Usuários e Acessos"',
    '3. Clique no botão "+" para adicionar novo usuário',
    '4. Digite o e-mail: apps@membros.app.br',
    '5. Selecione a função "Admin"',
    '6. Clique em "Convidar"',
  ],
  'Fiz login no app de teste': [
    '1. Baixe o app de teste no link enviado pela equipe',
    '2. Abra o app no seu celular',
    '3. Faça login com sua conta de administrador da plataforma',
    '4. Verifique se o app abre corretamente',
  ],
  'Naveguei pelo conteúdo principal': [
    '1. Acesse os cursos/conteúdos disponíveis no app',
    '2. Teste a reprodução de vídeos e materiais',
    '3. Verifique se as imagens e textos estão corretos',
    '4. Teste a navegação entre as seções',
    '5. Anote qualquer problema encontrado para reportar à equipe',
  ],
  'Aprovei o app para publicação': [
    '1. Confirme que todos os conteúdos estão corretos',
    '2. Verifique se o login funciona normalmente',
    '3. Teste em diferentes tamanhos de tela se possível',
    '4. Marque esta opção somente quando estiver satisfeito com o app',
  ],
};

const FASE_NAMES = ['Pré-Requisitos', 'Primeiros Passos', 'Validação pela Loja', 'Criação e Submissão', 'Aprovação das Lojas', 'Teste do App', 'Publicado 🎉'];

interface Props {
  clienteId: string;
}

export default function AppClientPortalContent({ clienteId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTimelineFase, setSelectedTimelineFase] = useState<{ fase: number; plataforma?: string } | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [assetComment, setAssetComment] = useState<Record<string, string>>({});
  const [assetCommenting, setAssetCommenting] = useState<string | null>(null);
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjPromptId, setCnpjPromptId] = useState<string | null>(null);
  const [emailCorpInput, setEmailCorpInput] = useState('');
  const [emailCorpPromptId, setEmailCorpPromptId] = useState<string | null>(null);
  const [siteInput, setSiteInput] = useState('');
  const [sitePromptId, setSitePromptId] = useState<string | null>(null);
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  const [viewingItemId, setViewingItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDataInput, setItemDataInput] = useState('');
  const [showMockupModal, setShowMockupModal] = useState(false);
  const [mockupStep, setMockupStep] = useState(1);
  const [iconOption, setIconOption] = useState<'yes' | 'no' | ''>('');
  const [iconLogoFile, setIconLogoFile] = useState<File | null>(null);
  const [iconDescription, setIconDescription] = useState('');
  const [wantThumb, setWantThumb] = useState(true);
  const [wantScreenshotsTablet, setWantScreenshotsTablet] = useState(true);
  const [wantScreenshotsCelular, setWantScreenshotsCelular] = useState(true);
  const [mockupSubmitting, setMockupSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [reviewingImageId, setReviewingImageId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [formData, setFormData] = useState({ nome_app: '', descricao_curta: '', descricao_longa: '', url_privacidade: '', url_termos: '' });

  const CNPJ_TEXT = 'Confirmei que meu CNPJ é ME ou LTDA';
  const EMAIL_CORP_TEXT = 'Tenho um e-mail corporativo';
  const SITE_TEXT = 'Meu site está publicado com domínio próprio';
  const ADMIN_GOOGLE_TEXT = 'Adicionei apps@membros.app.br como admin (Google)';
  const ADMIN_APPLE_TEXT = 'Adicionei apps@membros.app.br como admin (Apple)';

  // ── Queries ──
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

  const { data: mockupRequests = [] } = useQuery({
    queryKey: ['portal-mockup-requests', clienteId],
    enabled: !!cliente,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_requests')
        .select('*, briefing_images(*, briefing_deliveries(*))')
        .eq('platform_url', cliente!.empresa)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((r: any) =>
        r.briefing_images?.some((img: any) => img.image_type === 'app_mockup')
      );
    },
  });

  const mockupRequest = mockupRequests.length > 0 ? mockupRequests[0] : null;

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

  // ── Detect parallel flow ──
  const isParallelFlow = fases.filter((f: any) => f.numero === 1).length > 1;

  // ── Helper functions ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-checklist'] });
    queryClient.invalidateQueries({ queryKey: ['portal-fases'] });
    queryClient.invalidateQueries({ queryKey: ['portal-cliente'] });
    queryClient.invalidateQueries({ queryKey: ['portal-assets'] });
  };

  const checkFaseCompletion = () => {
    setTimeout(() => invalidateAll(), 500);
  };

  const addBusinessDays = (date: Date, days: number) => {
    let count = 0;
    const result = new Date(date);
    while (count < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return result;
  };

  const toggleSteps = (id: string) => setExpandedSteps(p => ({ ...p, [id]: !p[id] }));

  const extractLink = (desc?: string | null) => {
    if (!desc) return null;
    const match = desc.match(/https?:\/\/[^\s]+/);
    return match ? match[0] : null;
  };

  const HIDDEN_PREREQ_TEXTS = ['Ícone do App', 'Splash Screen', 'Screenshots', 'aprovou todos os assets'];
  const isHiddenPrereq = (texto: string) => HIDDEN_PREREQ_TEXTS.some(t => texto.toLowerCase().includes(t.toLowerCase()));

  // ── Mutations ──
  const toggleCheck = useMutation({
    mutationFn: async ({ id, feito, texto, fase_numero }: { id: string; feito: boolean; texto?: string; fase_numero?: number }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        feito, feito_em: feito ? new Date().toISOString() : null, feito_por: 'cliente',
      }).eq('id', id);
      if (error) throw error;

      if (!feito && texto && fase_numero === 5) {
        const { data: existing } = await supabase
          .from('app_checklist_items')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('fase_numero', 5)
          .eq('ator', 'analista')
          .eq('feito', false)
          .ilike('texto', `%${texto}%`)
          .maybeSingle();

        if (!existing) {
          await supabase.from('app_checklist_items').insert({
            cliente_id: clienteId, fase_numero: 5,
            texto: `⚠️ PRIORIDADE: Cliente reprovou "${texto}" — verificar e resolver`,
            descricao: `O cliente ${cliente?.nome} (${cliente?.empresa}) desmarcou a etapa "${texto}" na fase de Teste do App.`,
            ator: 'analista', obrigatorio: true, feito: false, ordem: 0,
          });
          await supabase.from('app_notificacoes').insert({
            cliente_id: clienteId, tipo: 'teste_app_reprovado', canal: 'portal', destinatario: 'analista',
            titulo: '🚨 PRIORIDADE: Cliente reprovou teste do app',
            mensagem: `${cliente?.nome} (${cliente?.empresa}) reprovou a etapa "${texto}" durante o teste do app.`,
            agendado_para: new Date().toISOString(),
          });
        }
      }

      if (feito && texto && (texto === ADMIN_GOOGLE_TEXT || texto === ADMIN_APPLE_TEXT)) {
        const adminTexts = [ADMIN_GOOGLE_TEXT, ADMIN_APPLE_TEXT];
        const relevantTexts = cliente?.plataforma === 'google' ? [ADMIN_GOOGLE_TEXT]
          : cliente?.plataforma === 'apple' ? [ADMIN_APPLE_TEXT] : adminTexts;
        const otherAdminItems = checklist.filter(i => i.fase_numero === 1 && relevantTexts.includes(i.texto) && i.id !== id);
        const allAdminDone = otherAdminItems.every(i => i.feito);
        if (allAdminDone) {
          await supabase.from('app_notificacoes').insert({
            cliente_id: clienteId, tipo: 'validacao_admin_pendente', canal: 'portal', destinatario: 'analista',
            titulo: '🔔 Validação de convite pendente',
            mensagem: `${cliente?.nome} (${cliente?.empresa}) adicionou apps@membros.app.br como admin.`,
            agendado_para: new Date().toISOString(),
          });
        }
      }
    },
    onSuccess: () => { invalidateAll(); checkFaseCompletion(); },
  });

  const approveAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await supabase.from('app_assets').update({
        status: 'aprovado', aprovado_em: new Date().toISOString(),
      }).eq('id', assetId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success('Asset aprovado! ✅'); },
  });

  const requestAssetAdjust = useMutation({
    mutationFn: async ({ assetId, comment }: { assetId: string; comment: string }) => {
      const { error } = await supabase.from('app_assets').update({
        status: 'ajuste_solicitado', comentario_cliente: comment,
      }).eq('id', assetId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAssetCommenting(null); setAssetComment({}); toast.success('Ajuste solicitado!'); },
  });

  const submitMockupRequest = useMutation({
    mutationFn: async () => {
      const items: { observations: string; logoUrl?: string }[] = [];
      if (iconOption === 'yes' && iconLogoFile) {
        const ext = iconLogoFile.name.split('.').pop();
        const path = `mockup/${clienteId}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('briefing-uploads').upload(path, iconLogoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(path);
        items.push({ observations: 'Ícone do Aplicativo — Cliente quer usar a logo', logoUrl: urlData.publicUrl });
      } else if (iconOption === 'no' && iconDescription.trim()) {
        items.push({ observations: `Ícone do Aplicativo — Descrição: ${iconDescription.trim()}` });
      }
      if (wantThumb) items.push({ observations: 'Thumb (1024x500)' });
      if (wantScreenshotsTablet) items.push({ observations: '4 Screenshots Tablet (1024x1024)' });
      if (wantScreenshotsCelular) items.push({ observations: '4 Screenshots Celular' });
      if (items.length === 0) throw new Error('Selecione pelo menos um item');

      for (const item of items) {
        const { data: req, error: reqErr } = await supabase.from('briefing_requests').insert({
          requester_name: cliente!.nome, requester_email: cliente!.email,
          platform_url: cliente!.empresa,
          has_trail: false, has_challenge: false, has_community: false,
          notes: 'Solicitação automática via portal do app',
        }).select().single();
        if (reqErr) throw reqErr;
        const { error: imgErr } = await supabase.from('briefing_images').insert({
          request_id: req.id, image_type: 'app_mockup' as any,
          observations: item.observations, professional_photo_url: item.logoUrl || null, sort_order: 0,
        });
        if (imgErr) throw imgErr;
      }
      await supabase.from('app_checklist_items').insert({
        cliente_id: clienteId, fase_numero: 0, texto: 'Criar Mooni',
        descricao: `Criar o Mooni para ${cliente!.nome} (${cliente!.empresa}).`,
        ator: 'analista', obrigatorio: true, feito: false, ordem: 0, tipo: 'mooni',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mockup-requests'] });
      setShowMockupModal(false); resetMockupForm();
      toast.success('🎨 Solicitação enviada com sucesso!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItemData = useMutation({
    mutationFn: async ({ itemId, dados, dadosAnteriores }: { itemId: string; dados: string; dadosAnteriores?: string }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        dados_preenchidos: dados, updated_at: new Date().toISOString(),
      }).eq('id', itemId);
      if (error) throw error;
      await supabase.from('app_checklist_historico').insert({
        checklist_item_id: itemId, dados_anteriores: dadosAnteriores || null, dados_novos: dados, editado_por: 'cliente',
      });
    },
    onSuccess: () => { invalidateAll(); setEditingItemId(null); setViewingItemId(null); setItemDataInput(''); toast.success('Dados salvos!'); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveForm = useMutation({
    mutationFn: async () => {
      const complete = !!(formData.nome_app && formData.descricao_curta && formData.url_privacidade);
      const { error } = await supabase.from('app_formulario').update({
        ...formData, preenchido_completo: complete,
        enviado_em: complete ? new Date().toISOString() : null,
      }).eq('cliente_id', clienteId);
      if (error) throw error;
      if (complete) {
        const formItems = checklist.filter(i => i.fase_numero === 3 && i.ator === 'cliente' && i.tipo === 'form');
        for (const item of formItems) {
          await supabase.from('app_checklist_items').update({ feito: true, feito_em: new Date().toISOString(), feito_por: 'cliente' }).eq('id', item.id);
        }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['portal-formulario'] }); invalidateAll(); toast.success('Formulário salvo!'); },
  });

  const resetMockupForm = () => {
    setMockupStep(1); setIconOption(''); setIconLogoFile(null); setIconDescription('');
    setWantThumb(true); setWantScreenshotsTablet(true); setWantScreenshotsCelular(true);
  };

  // ── Computed values ──
  const pendingAssets = assets.filter((a: any) => a.status === 'aguardando');

  // Get fase for a given number + platform
  const getFase = (num: number, plataforma?: string) => {
    if (plataforma) return fases.find((f: any) => f.numero === num && f.plataforma === plataforma);
    // For fase 0 or single platform
    return fases.find((f: any) => f.numero === num);
  };

  // Get items for a fase + platform filter (client-visible only)
  const getItemsForFase = (faseNum: number, plataforma?: string) => {
    return checklist.filter((i: any) => {
      if (i.fase_numero !== faseNum) return false;
      if (i.ator !== 'cliente') return false;
      if (i.tipo === 'mooni') return false;
      if (isHiddenPrereq(i.texto)) return false;
      // Platform filter for phases 1-6 in parallel flow
      if (plataforma && faseNum > 0 && isParallelFlow) {
        return i.plataforma === plataforma || i.plataforma === 'compartilhada';
      }
      return true;
    });
  };

  // Check if all fase6 are done
  const allFase6Done = fases.filter((f: any) => f.numero === 6).length > 0 &&
    fases.filter((f: any) => f.numero === 6).every((f: any) => f.status === 'concluida');

  // Per-track: get the fase for display
  const getTrackFases = (plataforma: string) => {
    return [1, 2, 3, 4, 5, 6].map(num => fases.find((f: any) => f.numero === num && f.plataforma === plataforma));
  };

  // Dynamic message
  const getDynamicMessage = () => {
    if (allFase6Done) return '🎉 Seu app está publicado em ambas as lojas!';

    if (isParallelFlow) {
      const googleFase6 = getFase(6, 'google');
      const appleFase6 = getFase(6, 'apple');
      if (googleFase6?.status === 'concluida' && appleFase6?.status !== 'concluida') {
        const appleActive = fases.find((f: any) => f.plataforma === 'apple' && f.status === 'em_andamento');
        return `🤖 Google Play publicado! 🎉 · 🍎 Apple na fase ${appleActive?.numero ?? '?'} — ${appleActive?.nome ?? ''}`;
      }
      if (appleFase6?.status === 'concluida' && googleFase6?.status !== 'concluida') {
        const googleActive = fases.find((f: any) => f.plataforma === 'google' && f.status === 'em_andamento');
        return `🍎 App Store publicado! 🎉 · 🤖 Google na fase ${googleActive?.numero ?? '?'} — ${googleActive?.nome ?? ''}`;
      }
      // Both still in progress
      const googleActive = fases.find((f: any) => f.plataforma === 'google' && f.status === 'em_andamento');
      const appleActive = fases.find((f: any) => f.plataforma === 'apple' && f.status === 'em_andamento');
      if (googleActive && appleActive) {
        return `🤖 Google: fase ${googleActive.numero} — ${googleActive.nome} · 🍎 Apple: fase ${appleActive.numero} — ${appleActive.nome}`;
      }
    }

    const singleFase6 = fases.find((f: any) => f.numero === 6);
    if (singleFase6?.status === 'concluida') return '🎉 Seu app está publicado!';
    if (cliente?.fase_atual === 5) return '🏁 Última reta! Teste seu app e aprove para publicarmos.';

    // Client-only progress
    const clientItemsMsg = checklist.filter((i: any) => i.ator === 'cliente' && i.obrigatorio);
    const clientDoneMsg = clientItemsMsg.filter((i: any) => i.feito).length;
    const clientPctMsg = clientItemsMsg.length > 0 ? Math.round((clientDoneMsg / clientItemsMsg.length) * 100) : 0;
    const totalPctMsg = cliente?.porcentagem_geral || 0;

    if (totalPctMsg === 100) return '🎉 Seu app está 100% pronto!';
    if (clientPctMsg === 100 && totalPctMsg < 100) return 'Você concluiu tudo! 🎉 Nossa equipe está cuidando do restante.';

    const clientPending = checklist.filter((i: any) => !i.feito && i.ator === 'cliente' && !isHiddenPrereq(i.texto) && i.tipo !== 'mooni');
    const currentFasePending = clientPending.filter(i => i.fase_numero === cliente?.fase_atual);
    if (currentFasePending.length > 0) return `Seu app está ${clientPctMsg}% pronto — faltam ${currentFasePending.length} tarefa(s) suas!`;

    return `Seu app está ${clientPctMsg}% pronto`;
  };

  // ── Celebration effects ──
  useEffect(() => {
    if (allFase6Done) {
      setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } }), 500);
    }
  }, [allFase6Done]);

  // Per-platform celebration
  useEffect(() => {
    if (!isParallelFlow) return;
    const googleDone = getFase(6, 'google')?.status === 'concluida';
    const appleDone = getFase(6, 'apple')?.status === 'concluida';
    if (googleDone && !appleDone) {
      // Google published first
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#3b82f6', '#60a5fa'] });
    } else if (appleDone && !googleDone) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#a855f7', '#c084fc'] });
    }
  }, [fases]);

  // ── Loading ──
  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (!cliente) return <div className="text-center py-12 text-white/60">Dados não encontrados</div>;

  // ── Timeline circle renderer ──
  const renderCircle = (faseNum: number, fase: any, plataforma?: string) => {
    const status = fase?.status || 'bloqueada';
    const pct = fase?.porcentagem || 0;
    const isSelected = selectedTimelineFase?.fase === faseNum && selectedTimelineFase?.plataforma === plataforma;

    const size = 44;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    const statusColor = status === 'concluida' ? 'text-green-400' :
      status === 'em_andamento' ? 'text-primary' :
      status === 'atrasada' ? 'text-red-400' : 'text-white/50';

    return (
      <button
        key={`${faseNum}-${plataforma || 'shared'}`}
        onClick={() => {
          setSelectedTimelineFase(isSelected ? null : { fase: faseNum, plataforma });
        }}
        className={`relative flex flex-col items-center shrink-0 transition-all cursor-pointer hover:scale-105 ${status === 'bloqueada' ? 'opacity-60' : ''} ${isSelected ? 'scale-110' : ''}`}
      >
        <div className="relative">
          {/* Progress ring */}
          {status === 'em_andamento' && (
            <svg width={size} height={size} className="absolute -inset-0">
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--primary) / 0.15)" strokeWidth={strokeWidth} />
              <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="hsl(var(--primary))" strokeWidth={strokeWidth}
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-500" />
            </svg>
          )}
          {/* Active glow */}
          {status === 'em_andamento' && isSelected && (
            <div className="absolute -inset-1.5 rounded-full bg-primary/20 animate-pulse" />
          )}
          {/* Circle */}
          <div className={`relative flex items-center justify-center w-[44px] h-[44px] rounded-full border-2 transition-colors ${
            status === 'concluida' ? 'bg-green-500/20 border-green-500' :
            status === 'em_andamento' ? 'bg-[#1E293B] border-primary' :
            status === 'atrasada' ? 'bg-red-500/10 border-red-500' :
            'bg-white/5 border-white/10'
          } ${isSelected ? 'ring-2 ring-primary/50' : ''}`}>
            {status === 'concluida' ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : status === 'bloqueada' ? (
              <Lock className="h-4 w-4 text-white/40" />
            ) : status === 'atrasada' ? (
              <AlertTriangle className="h-4 w-4 text-red-400" />
            ) : (
              <span className="text-xs font-bold text-primary">{faseNum}</span>
            )}
          </div>
        </div>
        {/* Label */}
        <span className={`mt-1.5 text-[10px] leading-tight text-center w-[72px] font-medium ${statusColor}`}>
          {FASE_NAMES[faseNum]}
        </span>
      </button>
    );
  };

  // ── Render item helpers (same as before) ──
  const renderStepGuide = (itemText: string, itemId: string) => {
    const steps = STEP_BY_STEP[itemText];
    if (!steps) return null;
    const isOpen = expandedSteps[itemId];
    return (
      <div className="mt-2">
        <button onClick={(e) => { e.stopPropagation(); toggleSteps(itemId); }}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isOpen ? 'Ocultar passo a passo' : 'Ver passo a passo'}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="mt-2 space-y-1 rounded-lg bg-white/5 p-3">
                {steps.map((step, i) => <p key={i} className="text-xs text-white/70">{step}</p>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderClientItem = (item: any) => {
    const canEdit = fases.some((f: any) => f.numero === item.fase_numero && (f.status === 'em_andamento' || f.status === 'atrasada'));

    if (item.tipo === 'form') {
      return (
        <div key={item.id} className="space-y-3">
          {formulario?.preenchido_completo ? (
            <div className="rounded-lg p-4 bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <p className="text-sm font-medium text-green-400">Formulário enviado!</p>
              </div>
              {formulario.enviado_em && (
                <p className="text-[10px] text-green-400/50 mt-1">Enviado em {format(new Date(formulario.enviado_em), 'dd/MM/yyyy HH:mm')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-white/5 border border-white/10 p-4">
              <p className="text-xs text-white/60 mb-2">Preencha as informações do seu aplicativo.</p>
              <div><Label className="text-white/70">Nome do aplicativo *</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.nome_app} onChange={e => setFormData(p => ({ ...p, nome_app: e.target.value }))} /></div>
              <div><Label className="text-white/70">Descrição curta * ({formData.descricao_curta.length}/80)</Label><Input className="bg-white/5 border-white/10 text-white" value={formData.descricao_curta} maxLength={80} onChange={e => setFormData(p => ({ ...p, descricao_curta: e.target.value }))} /></div>
              <div><Label className="text-white/70">URL Política de Privacidade *</Label><Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_privacidade} onChange={e => setFormData(p => ({ ...p, url_privacidade: e.target.value }))} /></div>
              <div><Label className="text-white/70">Descrição completa (opcional)</Label><Textarea className="bg-white/5 border-white/10 text-white min-h-[100px]" value={formData.descricao_longa} maxLength={4000} onChange={e => setFormData(p => ({ ...p, descricao_longa: e.target.value }))} /></div>
              <div><Label className="text-white/70">URL Termos de Uso (opcional)</Label><Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_termos} onChange={e => setFormData(p => ({ ...p, url_termos: e.target.value }))} /></div>
              <Button className="w-full" onClick={() => saveForm.mutate()} disabled={saveForm.isPending || !formData.nome_app || !formData.descricao_curta || !formData.url_privacidade}>
                {saveForm.isPending ? 'Salvando...' : 'Enviar formulário'}
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (item.tipo === 'approval_final') {
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox checked={item.feito}
              onCheckedChange={(checked) => {
                if (checked) setConfirmingItemId(item.id);
                else toggleCheck.mutate({ id: item.id, feito: false, texto: item.texto, fase_numero: item.fase_numero });
              }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/60 mt-1">{item.descricao}</p>}
              {renderStepGuide(item.texto, item.id)}
              {confirmingItemId === item.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 overflow-hidden">
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                      <p className="text-sm text-amber-300 font-semibold">Tem certeza?</p>
                    </div>
                    <p className="text-xs text-amber-300/70">Ao aprovar, você autoriza a publicação nas lojas. <span className="font-semibold">Esta ação não pode ser desfeita.</span></p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => {
                        toggleCheck.mutate({ id: item.id, feito: true, texto: item.texto, fase_numero: item.fase_numero });
                        setConfirmingItemId(null);
                        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
                        toast.success('🎉 App aprovado para publicação!');
                      }}>✅ Sim, aprovar</Button>
                      <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setConfirmingItemId(null)}>Cancelar</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.tipo === 'approval') {
      return (
        <div key={item.id} className="space-y-3 p-3 rounded-lg bg-white/5">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 mt-0.5 text-yellow-400" />
            <div className="flex-1"><p className="text-sm font-medium text-white">{item.texto}</p></div>
          </div>
          {pendingAssets.length > 0 ? (
            <div className="space-y-2 ml-8">
              {pendingAssets.map((asset: any) => (
                <div key={asset.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    {asset.url ? (
                      <img src={asset.url} alt={asset.nome_arquivo} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-white/50" /></div>
                    )}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{asset.nome_arquivo || asset.tipo}</p></div>
                  </div>
                  {assetCommenting === asset.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea placeholder="Descreva o ajuste..." className="bg-white/5 border-white/10 text-white text-sm min-h-[60px]"
                        value={assetComment[asset.id] || ''} onChange={e => setAssetComment(p => ({ ...p, [asset.id]: e.target.value }))} />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1" disabled={!assetComment[asset.id]?.trim()}
                          onClick={() => requestAssetAdjust.mutate({ assetId: asset.id, comment: assetComment[asset.id] })}>Enviar ajuste</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAssetCommenting(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveAsset.mutate(asset.id)}>✅ Aprovar</Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/20" onClick={() => setAssetCommenting(asset.id)}>💬 Ajuste</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40 ml-8">Nenhum asset aguardando aprovação.</p>
          )}
        </div>
      );
    }

    if (item.texto === CNPJ_TEXT) {
      const formatCnpj = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 14);
        return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
      };
      const isValidCnpj = cnpjInput.replace(/\D/g, '').length === 14;
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox checked={item.feito} onCheckedChange={(checked) => { if (checked) setCnpjPromptId(item.id); else toggleCheck.mutate({ id: item.id, feito: false }); }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : ''}`}>{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
              {renderStepGuide(item.texto, item.id)}
              {cnpjPromptId === item.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
                  <Label className="text-xs text-white/70">Informe seu CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={cnpjInput} onChange={e => setCnpjInput(formatCnpj(e.target.value))} className="bg-white/5 border-white/10 text-white text-sm" maxLength={18} />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" disabled={!isValidCnpj} onClick={() => { toggleCheck.mutate({ id: item.id, feito: true }); setCnpjPromptId(null); setCnpjInput(''); toast.success('CNPJ confirmado!'); }}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCnpjPromptId(null); setCnpjInput(''); }}>Cancelar</Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.texto === EMAIL_CORP_TEXT) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCorpInput) && !/(@gmail\.|@hotmail\.|@yahoo\.|@outlook\.)/i.test(emailCorpInput);
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox checked={item.feito} onCheckedChange={(checked) => { if (checked) setEmailCorpPromptId(item.id); else toggleCheck.mutate({ id: item.id, feito: false }); }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : ''}`}>{item.texto}</p>
              {renderStepGuide(item.texto, item.id)}
              {emailCorpPromptId === item.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
                  <Label className="text-xs text-white/70">Informe seu e-mail corporativo</Label>
                  <Input type="email" placeholder="seunome@suaempresa.com.br" value={emailCorpInput} onChange={e => setEmailCorpInput(e.target.value.trim())} className="bg-white/5 border-white/10 text-white text-sm" />
                  {emailCorpInput && !isValidEmail && <p className="text-[10px] text-amber-400">Use um e-mail corporativo</p>}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" disabled={!isValidEmail} onClick={() => { toggleCheck.mutate({ id: item.id, feito: true }); setEmailCorpPromptId(null); setEmailCorpInput(''); toast.success('E-mail confirmado!'); }}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEmailCorpPromptId(null); setEmailCorpInput(''); }}>Cancelar</Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.texto === SITE_TEXT) {
      const isValidSite = /^(https?:\/\/)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(siteInput) && !/\.(wixsite|blogspot|wordpress)\./i.test(siteInput);
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox checked={item.feito} onCheckedChange={(checked) => { if (checked) setSitePromptId(item.id); else toggleCheck.mutate({ id: item.id, feito: false }); }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
            <div className="flex-1">
               <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : 'text-white'}`}>{item.texto}</p>
              {renderStepGuide(item.texto, item.id)}
              {sitePromptId === item.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 space-y-2 overflow-hidden">
                  <Label className="text-xs text-white/70">URL do seu site</Label>
                  <Input type="url" placeholder="https://www.suaempresa.com.br" value={siteInput} onChange={e => setSiteInput(e.target.value.trim())} className="bg-white/5 border-white/10 text-white text-sm" />
                  {siteInput && !isValidSite && <p className="text-[10px] text-amber-400">Use um domínio próprio</p>}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" disabled={!isValidSite} onClick={() => { toggleCheck.mutate({ id: item.id, feito: true }); setSitePromptId(null); setSiteInput(''); toast.success('Site confirmado!'); }}>Confirmar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSitePromptId(null); setSiteInput(''); }}>Cancelar</Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default check item
    return (
      <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <div className="flex items-start gap-3">
          <Checkbox checked={item.feito} disabled={!canEdit && item.feito}
            onCheckedChange={(checked) => {
              if (checked) setConfirmingItemId(item.id);
              else if (canEdit) toggleCheck.mutate({ id: item.id, feito: false, texto: item.texto, fase_numero: item.fase_numero });
            }}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
          <div className="flex-1">
             <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : 'text-white'}`}>{item.texto}</p>
             {item.descricao && <p className="text-xs text-white/60 mt-1">{item.descricao}</p>}
            {item.feito && item.feito_em && (
              <p className="text-[10px] text-green-400/70 mt-1">✅ {format(new Date(item.feito_em), "dd/MM/yyyy 'às' HH:mm")}</p>
            )}
            {!canEdit && item.feito && (
              <p className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-1"><Lock className="h-3 w-3" /> Somente visualização</p>
            )}
            {renderStepGuide(item.texto, item.id)}
            {item.texto === ADMIN_APPLE_TEXT && (
              <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300">Não esqueça de aceitar os termos ao final da página da Apple.</p>
              </div>
            )}
            {confirmingItemId === item.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 overflow-hidden">
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-3">
                  <p className="text-xs text-amber-300 font-medium">Tem certeza que concluiu esta etapa?</p>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-white/60">Observações (opcional):</Label>
                    <Textarea placeholder="Ex: número do pedido, conta criada..." className="bg-white/5 border-white/10 text-white text-sm min-h-[60px]"
                      value={itemDataInput} onChange={e => setItemDataInput(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={async () => {
                      if (itemDataInput.trim()) {
                        await supabase.from('app_checklist_items').update({ dados_preenchidos: itemDataInput.trim(), updated_at: new Date().toISOString() }).eq('id', item.id);
                      }
                      toggleCheck.mutate({ id: item.id, feito: true, texto: item.texto, fase_numero: item.fase_numero });
                      setConfirmingItemId(null); setItemDataInput('');
                      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 }, colors: ['#22c55e'] });
                    }}>Sim, concluí</Button>
                    <Button size="sm" variant="ghost" className="text-white/60" onClick={() => { setConfirmingItemId(null); setItemDataInput(''); }}>Não</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Expanded fase content ──
  const renderExpandedFase = (faseNum: number, plataforma?: string) => {
    const fase = plataforma ? fases.find((f: any) => f.numero === faseNum && f.plataforma === plataforma) : fases.find((f: any) => f.numero === faseNum);
    if (!fase) return null;

    const items = getItemsForFase(faseNum, plataforma);
    const allFaseItems = checklist.filter((i: any) => {
      if (i.fase_numero !== faseNum) return false;
      if (plataforma && faseNum > 0 && isParallelFlow) return i.plataforma === plataforma || i.plataforma === 'compartilhada';
      return true;
    });
    const total = allFaseItems.length;
    const done = allFaseItems.filter((i: any) => i.feito).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    // Check if all client items done but internal still pending
    const clientItemsDone = items.every(i => i.feito);
    const hasInternalPending = allFaseItems.some(i => !i.feito && i.ator !== 'cliente');

    // Estimation for validation phases (2, 4)
    const showEstimate = (faseNum === 2 || faseNum === 4) && fase.status === 'em_andamento' && fase.data_inicio;

    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="overflow-hidden"
      >
        <div className="mt-4 rounded-xl bg-[#1E293B] border border-white/10 p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {plataforma === 'google' && <span>🤖</span>}
              {plataforma === 'apple' && <span>🍎</span>}
              {!plataforma && <span>📋</span>}
              <h3 className="text-base font-bold text-white">{faseNum > 0 ? `${faseNum}. ` : ''}{FASE_NAMES[faseNum]}</h3>
              {plataforma && (
                <Badge variant="outline" className="text-[10px]">
                  {plataforma === 'google' ? 'Google Play' : 'Apple'}
                </Badge>
              )}
              {fase.data_inicio && (
                <span className="text-[10px] text-white/50">
                  Iniciada em {format(new Date(fase.data_inicio), 'dd/MM/yyyy')}
                  {fase.data_conclusao && ` · Concluída em ${format(new Date(fase.data_conclusao), 'dd/MM/yyyy')}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] ${
                fase.status === 'concluida' ? 'bg-green-500/20 text-green-400' :
                fase.status === 'atrasada' ? 'bg-red-500/20 text-red-400' :
                'bg-primary/20 text-primary'
              } border-0`}>
                {progress}%
              </Badge>
              <button onClick={() => setSelectedTimelineFase(null)} className="text-white/50 hover:text-white text-xs ml-1">✕</button>
            </div>
          </div>

          <Progress value={progress} className="h-1.5" />

          {/* Estimate */}
          {showEstimate && fase.duracao_dias_estimada && (
            <div className="rounded-lg bg-white/5 border border-white/5 p-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/50" />
              <p className="text-xs text-white/60">
                Previsão: ~{fase.duracao_dias_estimada} dias úteis
                {fase.data_inicio && (
                  <span className="text-white/50"> (até {format(addBusinessDays(new Date(fase.data_inicio), fase.duracao_dias_estimada), 'dd/MM/yyyy')})</span>
                )}
              </p>
            </div>
          )}

          {/* Future stage — compact inline message + visible sub-items */}
          {fase.status === 'bloqueada' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 mb-3">
                <Lock className="h-4 w-4 text-white/40 shrink-0" />
                <p className="text-xs text-white/50">Etapa futura — você será notificado quando chegar aqui.</p>
              </div>
              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="p-3 rounded-lg bg-white/5 flex items-start gap-3">
                      <Lock className="h-4 w-4 text-white/30 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-white/50">{item.texto}</p>
                        {item.descricao && <p className="text-xs text-white/[0.35] mt-0.5">{item.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Items (active/completed phases) */}
          {fase.status !== 'bloqueada' && (items.length > 0 || faseNum === 0) ? (
            <div className="space-y-2">
              {items.map(item => renderClientItem(item))}
              {/* Mockup as inline checklist item in fase 0 */}
              {faseNum === 0 && (
                <div
                  className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  onClick={() => { if (!mockupRequest) setShowMockupModal(true); }}
                >
                  <div className="flex items-start gap-3">
                    {mockupRequest ? (
                      <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                    ) : (
                      <Circle className="h-5 w-5 text-white/30 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${mockupRequest ? 'text-green-400' : ''}`}>
                        {mockupRequest ? 'Mockup solicitado!' : 'Solicitar Mockup do Aplicativo'}
                      </p>
                      {mockupRequest && (
                        <>
                          {mockupRequest.created_at && (
                            <p className="text-[10px] text-green-400/70 mt-1">
                              ✅ {format(new Date(mockupRequest.created_at), "dd/MM/yyyy 'às' HH:mm")}
                            </p>
                          )}
                          <p className="text-[10px] text-white/40 mt-0.5">Acompanhe na aba "Artes"</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Analyst items — informational, no interaction */}
              {(() => {
                const analistaItems = allFaseItems.filter((i: any) => i.ator === 'analista' && i.tipo !== 'mooni' && !isHiddenPrereq(i.texto));
                if (analistaItems.length === 0) return null;
                // For fase 3: check if form is complete to determine lock state
                const formComplete = faseNum === 3 ? !!formulario?.preenchido_completo : true;
                return analistaItems.map((item: any) => (
                  <div key={item.id} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      {item.feito ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : formComplete ? (
                        <Clock className="h-5 w-5 text-amber-400 shrink-0" />
                      ) : (
                        <Lock className="h-5 w-5 text-white/20 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${!formComplete ? 'text-white/30' : ''}`}>
                            {item.texto}
                          </p>
                          {!item.feito && formComplete && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                              ⏳ Em andamento
                            </Badge>
                          )}
                          {item.feito && (
                            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">
                              ✅ Concluído
                            </Badge>
                          )}
                        </div>
                        {!formComplete && faseNum === 3 && (
                          <p className="text-xs text-white/30 mt-0.5">Preencha o formulário acima para liberar esta etapa</p>
                        )}
                        {formComplete && !item.feito && (
                          <p className="text-xs text-white/40 mt-0.5">Nossa equipe está construindo e submetendo seu app na loja</p>
                        )}
                        {item.feito && item.feito_em && (
                          <p className="text-[10px] text-green-400/60 mt-0.5">
                            Concluído em {format(new Date(item.feito_em), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ));
              })()}
              {/* Store validation/approval cards for phases 2 and 4 */}
              {(faseNum === 2 || faseNum === 4) && (() => {
                const plat = plataforma || (cliente.plataforma === 'apple' ? 'apple' : 'google');
                const prevFaseNum = faseNum === 2 ? 1 : 3;
                const prevFase = fases.find((f: any) => f.numero === prevFaseNum && (f.plataforma === plat || (!isParallelFlow && f.plataforma === cliente.plataforma)));
                const prevFaseDone = prevFase?.status === 'concluida';
                const currentFase = fases.find((f: any) => f.numero === faseNum && (f.plataforma === plat || (!isParallelFlow && f.plataforma === cliente.plataforma)));
                const isDone = currentFase?.status === 'concluida';
                const startDate = currentFase?.data_inicio ? new Date(currentFase.data_inicio) : (prevFaseDone && prevFase?.data_conclusao ? new Date(prevFase.data_conclusao) : null);
                const isGoogle = plat === 'google';
                const diasUteis = faseNum === 2 ? (isGoogle ? 3 : 7) : (isGoogle ? 4 : 10);
                const label = isGoogle ? 'Google Play' : 'App Store';
                const emojiPlat = isGoogle ? '🤖' : '🍎';
                const waitingText = faseNum === 2 ? 'Aguardando análise' : 'Aguardando aprovação';
                const diasLabel = faseNum === 2 ? (isGoogle ? '1–3' : '5–7') : (isGoogle ? '2–4' : '5–10');
                const prevFaseLabel = faseNum === 2 ? '"Primeiros Passos"' : '"Criação e Submissão"';
                const footerText = faseNum === 2
                  ? '⏳ Esta etapa depende exclusivamente da análise da loja. Você será notificado assim que houver retorno.'
                  : '⏳ Esta etapa depende exclusivamente da aprovação da loja. Você será notificado assim que houver retorno.';

                return (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className={`rounded-lg p-4 ${isDone
                      ? 'bg-green-500/10 border border-green-500/20'
                      : isGoogle ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-purple-500/10 border border-purple-500/20'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{emojiPlat}</span>
                          <span className="text-xs font-medium">
                            {isDone ? `${label} — Aprovado` : `${label} — ${waitingText}`}
                          </span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${isDone
                          ? 'border-green-500/30 text-green-400'
                          : isGoogle ? 'border-blue-500/30 text-blue-400' : 'border-purple-500/30 text-purple-400'
                        }`}>
                          {isDone ? '✅ Aprovado' : `${diasLabel} dias úteis`}
                        </Badge>
                      </div>
                      {!isDone && startDate && (
                        <div className="mt-2 space-y-1">
                          <p className={`text-[10px] ${isGoogle ? 'text-blue-400/70' : 'text-purple-400/70'}`}>
                            📆 Previsão máxima: <span className="font-semibold">{format(addBusinessDays(startDate, diasUteis), 'dd/MM/yyyy')}</span>
                          </p>
                          <Progress value={Math.min(Math.round((differenceInDays(new Date(), startDate) / diasUteis) * 100), 95)} className="h-1.5" />
                        </div>
                      )}
                      {isDone && currentFase?.data_conclusao && (
                        <p className="text-[10px] text-green-400/70 mt-2">
                          ✅ Concluído em {format(new Date(currentFase.data_conclusao), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                      {!startDate && !isDone && (
                        <p className="text-[10px] text-white/30 mt-2">
                          📅 A previsão será calculada após a conclusão de {prevFaseLabel}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-white/30 text-center mt-2">{footerText}</p>
                  </div>
                );
              })()}
            </div>
          ) : fase.status !== 'bloqueada' && clientItemsDone && hasInternalPending ? (
            <div className="text-center py-6 space-y-3 rounded-xl bg-white/5 border border-white/5">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
                <div className="relative flex items-center justify-center w-full h-full">
                  <Clock className="h-8 w-8 text-primary/60" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80">Estamos cuidando de tudo!</p>
                <p className="text-xs text-white/50 mt-1">A equipe Curseduca está trabalhando nesta etapa.<br/>Você será notificado assim que precisarmos de algo.</p>
              </div>
            </div>
          ) : fase.status === 'concluida' ? (
            <div className="text-center py-4">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-400 font-semibold">Etapa concluída! 🎉</p>
            </div>
          ) : null}
        </div>
      </motion.div>
    );
  };

  // ── Inline track row for parallel layout (no expanded content) ──
  const renderParallelTrackRow = (plataforma: string, emoji: string) => {
    const trackFases = [1, 2, 3, 4, 5, 6].map(num => ({
      num,
      fase: fases.find((f: any) => f.numero === num && f.plataforma === plataforma),
    }));

    return (
      <div className="flex items-center gap-0">
        <span className={`text-sm font-bold shrink-0 w-32 text-right pr-3 ${plataforma === 'google' ? 'text-blue-400' : 'text-purple-400'}`}>
          {emoji} {plataforma === 'google' ? 'Google Play' : 'Apple'}
        </span>
        <div className="relative flex items-center flex-1 min-w-0 py-1">
          {/* Connecting line */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/15 rounded-full" />
          {/* Progress line */}
          {(() => {
            const completedCount = trackFases.filter(({ fase }) => fase?.status === 'concluida').length;
            const progressWidth = trackFases.length > 1 ? `${(completedCount / (trackFases.length - 1)) * 100}%` : '0%';
            return <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-green-500 rounded-full transition-all duration-500" style={{ width: progressWidth }} />;
          })()}
          <div className="relative flex w-full">
            {trackFases.map(({ num, fase }) => {
              const status = fase?.status || 'bloqueada';
              const isSelected = selectedTimelineFase?.fase === num && selectedTimelineFase?.plataforma === plataforma;
              return (
                <div key={num} className="flex-1 flex flex-col items-center relative z-10">
                  <button
                    onClick={() => setSelectedTimelineFase(isSelected ? null : { fase: num, plataforma })}
                    className={`flex flex-col items-center cursor-pointer hover:scale-105 transition-all ${status === 'bloqueada' ? 'opacity-60' : ''} ${isSelected ? 'scale-110' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      status === 'concluida' ? 'bg-green-500/30 ring-2 ring-green-500/50 text-green-400' :
                      status === 'em_andamento' ? 'bg-primary/30 ring-2 ring-primary text-primary animate-pulse' :
                      status === 'atrasada' ? 'bg-red-500/30 ring-2 ring-red-500/50 text-red-400' :
                      'bg-white/10 text-white/30'
                    } ${isSelected ? 'ring-2 ring-primary/50' : ''}`}>
                      {status === 'concluida' ? <CheckCircle2 className="h-5 w-5" /> :
                       status === 'atrasada' ? <AlertTriangle className="h-5 w-5" /> :
                       status === 'em_andamento' ? <Star className="h-5 w-5" /> :
                       <Lock className="h-4 w-4" />}
                    </div>
                    <p className={`text-[10px] mt-1.5 text-center leading-tight max-w-[70px] ${
                      status === 'concluida' ? 'text-green-400/80' :
                      status === 'em_andamento' ? 'text-primary font-semibold' :
                      'text-white/30'
                    }`}>{num}. {FASE_NAMES[num]}</p>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Published state ──
  if (allFase6Done) {
    return (
      <div className="space-y-8">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-center space-y-4 py-6">
          <div className="inline-flex items-center justify-center mx-auto">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 text-sm px-4 py-1.5">✅ PUBLICADO</Badge>
          <h1 className="text-2xl font-extrabold">
            {isParallelFlow ? '🎉🎉 SEU APP ESTÁ EM TODAS AS LOJAS!' : '🎉 SEU APP ESTÁ PUBLICADO!'}
          </h1>
          <p className="text-white/70 text-sm">Parabéns! Seu app da {cliente.empresa} está disponível nas lojas.</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a href="https://play.google.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-medium text-white/80">
              <ExternalLink className="h-3.5 w-3.5" /> Google Play
            </a>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-medium text-white/80">
              <ExternalLink className="h-3.5 w-3.5" /> App Store
            </a>
          </div>
        </motion.div>
        <div>
          <h2 className="text-lg font-semibold mb-3">🏆 Conquistas</h2>
          <div className="flex flex-wrap gap-2">
            {isParallelFlow && (
              <>
                <Badge className="bg-blue-500/20 text-blue-400 px-3 py-1.5">🤖 Google Play Publicado</Badge>
                <Badge className="bg-purple-500/20 text-purple-400 px-3 py-1.5">🍎 App Store Publicada</Badge>
              </>
            )}
            <Badge className="bg-green-500/20 text-green-400 px-3 py-1.5">🏆 App Publicado!</Badge>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="space-y-6">
      {/* Hero + Progress side by side */}
      {(() => {
        const clientItemsBar = checklist.filter((i: any) => i.ator === 'cliente' && i.obrigatorio);
        const clientDoneBar = clientItemsBar.filter((i: any) => i.feito).length;
        const clientPctBar = clientItemsBar.length > 0 ? Math.round((clientDoneBar / clientItemsBar.length) * 100) : 0;
        const totalPctBar = cliente.porcentagem_geral || 0;
        return (
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
            {/* Left: greeting */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1 min-w-0">
              <h1 className="text-lg font-bold">Olá, {cliente?.nome?.split(' ')[0] || 'Cliente'}! 👋</h1>
              <p className="text-white/60 text-sm mt-0.5">{getDynamicMessage()}</p>
              {cliente.data_criacao && (
                <p className="text-[11px] text-primary/80 mt-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Processo iniciado em <span className="font-semibold text-primary">{format(new Date(cliente.data_criacao), 'dd/MM/yyyy')}</span>
                </p>
              )}
            </motion.div>
            {/* Right: progress bars */}
            <div className="shrink-0 w-full md:w-64 space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">Suas tarefas</span>
                  <span className="font-bold text-white">{clientPctBar}%{clientPctBar === 100 && ' ✅'}</span>
                </div>
                <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{ width: `${clientPctBar}%`, background: clientPctBar === 100 ? 'linear-gradient(90deg, hsl(142 71% 45%), hsl(142 71% 55%))' : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/40">Progresso total</span>
                  <span className="font-medium text-white/60">{totalPctBar}%</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-white/20 transition-all duration-500" style={{ width: `${totalPctBar}%` }} />
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">Inclui etapas da equipe Curseduca</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TIMELINE */}
      {isParallelFlow ? (
        /* ── Parallel: fase 0 left, bifurcation to two horizontal tracks ── */
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-0 w-full py-3">
              {/* Fase 0 on the left, centered vertically between tracks */}
              <div className="flex flex-col items-center shrink-0 self-center">
                <button onClick={() => setSelectedTimelineFase(
                  selectedTimelineFase?.fase === 0 && !selectedTimelineFase?.plataforma ? null : { fase: 0 }
                )}>
                  <div className={`relative flex items-center justify-center w-14 h-14 rounded-full transition-colors ${
                    (() => {
                      const f0 = fases.find((f: any) => f.numero === 0);
                      const s = f0?.status || 'bloqueada';
                      return s === 'concluida' ? 'bg-green-500/30 ring-2 ring-green-500/50' :
                        s === 'em_andamento' ? 'bg-primary/30 ring-2 ring-primary' :
                        s === 'atrasada' ? 'bg-red-500/30 ring-2 ring-red-500/50' :
                        'bg-white/10';
                    })()
                  } ${selectedTimelineFase?.fase === 0 && !selectedTimelineFase?.plataforma ? 'ring-2 ring-primary/50' : ''}`}>
                    {(() => {
                      const f0 = fases.find((f: any) => f.numero === 0);
                      const s = f0?.status || 'bloqueada';
                      return s === 'concluida' ? <CheckCircle2 className="h-6 w-6 text-green-400" /> :
                        s === 'bloqueada' ? <Lock className="h-5 w-5 text-white/30" /> :
                        s === 'atrasada' ? <AlertTriangle className="h-5 w-5 text-red-400" /> :
                        <span className="text-sm font-bold text-primary">0</span>;
                    })()}
                  </div>
                </button>
                <p className={`text-[10px] mt-1 text-center leading-tight max-w-[60px] ${
                  (() => {
                    const f0 = fases.find((f: any) => f.numero === 0);
                    const s = f0?.status || 'bloqueada';
                    return s === 'concluida' ? 'text-green-400/80' :
                      s === 'em_andamento' ? 'text-primary font-semibold' :
                      'text-white/30';
                  })()
                }`}>Pré-<br/>Requisitos</p>
              </div>

              {/* Bifurcation connector — clean T-shape */}
              <div className="flex items-center shrink-0 self-center">
                <div className="w-4 h-0.5 bg-white/20" />
                <div className="relative">
                  <div className="w-0.5 bg-white/20" style={{ height: '4.5rem' }} />
                  {/* Top branch */}
                  <div className="absolute top-0 left-0 w-4 h-0.5 bg-white/20" />
                  {/* Bottom branch */}
                  <div className="absolute bottom-0 left-0 w-4 h-0.5 bg-white/20" />
                </div>
              </div>

              {/* Two tracks stacked */}
              <div className="flex-1 flex flex-col gap-6 min-w-0">
                {renderParallelTrackRow('google', '🤖')}
                {renderParallelTrackRow('apple', '🍎')}
              </div>
            </div>
          </div>

          {/* Expanded content — full width below all tracks */}
          <AnimatePresence>
            {selectedTimelineFase && (
              renderExpandedFase(selectedTimelineFase.fase, selectedTimelineFase.plataforma || undefined)
            )}
          </AnimatePresence>

          {/* Per-platform celebrations */}
          {(() => {
            const googlePublished = getFase(6, 'google')?.status === 'concluida';
            const applePublished = getFase(6, 'apple')?.status === 'concluida';
            return (
              <>
                {googlePublished && !applePublished && (
                  <Card className="bg-blue-500/10 border-blue-500/20 p-4 text-center">
                    <p className="text-sm font-bold text-blue-400">🤖 Seu app está no Google Play! 🎉</p>
                    <p className="text-xs text-blue-400/60 mt-1">Aguardando Apple...</p>
                  </Card>
                )}
                {applePublished && !googlePublished && (
                  <Card className="bg-purple-500/10 border-purple-500/20 p-4 text-center">
                    <p className="text-sm font-bold text-purple-400">🍎 Seu app está na App Store! 🎉</p>
                    <p className="text-xs text-purple-400/60 mt-1">Aguardando Google Play...</p>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        /* ── Linear: original 7 circles ── */
        <div className="space-y-4">
          <div className="relative flex items-start justify-between overflow-x-auto pb-2 gap-1">
            <div className="absolute top-[22px] left-[22px] right-[22px] h-[2px] bg-white/10" />
            {[0, 1, 2, 3, 4, 5, 6].map(num => {
              const fase = fases.find((f: any) => f.numero === num);
              return (
                <div key={num} className="relative z-10 flex-1 min-w-0 flex justify-center">
                  {renderCircle(num, fase)}
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {selectedTimelineFase && !selectedTimelineFase.plataforma && (
              renderExpandedFase(selectedTimelineFase.fase)
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🏆 Conquistas</h2>
        <div className="flex flex-wrap gap-2">
          {fases.filter((f: any) => f.status === 'concluida').map((f: any) => (
            <motion.div key={f.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Badge className={`px-3 py-1.5 ${
                f.plataforma === 'google' ? 'bg-blue-500/20 text-blue-400' :
                f.plataforma === 'apple' ? 'bg-purple-500/20 text-purple-400' :
                'bg-green-500/20 text-green-400'
              }`}>
                {f.plataforma === 'google' ? '🤖 ' : f.plataforma === 'apple' ? '🍎 ' : '🏆 '}
                {FASE_NAMES[f.numero]}
              </Badge>
            </motion.div>
          ))}
          {fases.filter((f: any) => f.status === 'concluida').length === 0 && (
            <p className="text-sm text-white/30">Complete etapas para desbloquear conquistas!</p>
          )}
        </div>
      </div>

      {/* Support */}
      <Card className="bg-[#1E293B] border-white/10 p-6">
        <h2 className="text-lg font-semibold mb-3">💬 Suporte</h2>
        <div className="space-y-2 text-sm text-white/60">
          {cliente.responsavel_nome && <p>Seu responsável: <span className="text-white">{cliente.responsavel_nome}</span></p>}
          {cliente.whatsapp && (
            <a href={`https://wa.me/${cliente.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-400 hover:text-green-300">
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      </Card>

      {/* Mockup Request Modal */}
      <Dialog open={showMockupModal} onOpenChange={(v) => { if (!v) { setShowMockupModal(false); resetMockupForm(); } }}>
        <DialogContent className="max-w-lg bg-[#0F172A] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {mockupStep === 1 ? '📋 Dados do Solicitante' : '🎨 Assets do Aplicativo'}
            </DialogTitle>
          </DialogHeader>
          {mockupStep === 1 && cliente && (
            <div className="space-y-4">
              <div><Label className="text-xs text-white/60">Nome</Label><Input value={cliente.nome} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" /></div>
              <div><Label className="text-xs text-white/60">E-mail</Label><Input value={cliente.email} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" /></div>
              <div><Label className="text-xs text-white/60">Plataforma</Label><Input value={cliente.empresa} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" /></div>
              <Button className="w-full" onClick={() => setMockupStep(2)}>Próximo →</Button>
            </div>
          )}
          {mockupStep === 2 && (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <h3 className="text-sm font-semibold">📱 Ícone do Aplicativo</h3>
                <RadioGroup value={iconOption} onValueChange={(v: any) => setIconOption(v)} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="icon-yes" className="border-white/30" />
                    <Label htmlFor="icon-yes" className="text-sm text-white/80">Quero usar minha logo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="icon-no" className="border-white/30" />
                    <Label htmlFor="icon-no" className="text-sm text-white/80">Quero que criem um ícone</Label>
                  </div>
                </RadioGroup>
                {iconOption === 'yes' && (
                  <div className="space-y-2">
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setIconLogoFile(e.target.files?.[0] || null)} />
                    <Button variant="outline" size="sm" className="w-full border-white/10" onClick={() => logoInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" /> {iconLogoFile ? iconLogoFile.name : 'Enviar logo'}
                    </Button>
                  </div>
                )}
                {iconOption === 'no' && (
                  <Textarea placeholder="Descreva como gostaria que o ícone fosse..." className="bg-white/5 border-white/10 text-white text-sm min-h-[60px]"
                    value={iconDescription} onChange={e => setIconDescription(e.target.value)} />
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">📸 Outros assets</h3>
                <label className="flex items-center gap-2 text-sm text-white/80"><Checkbox checked={wantThumb} onCheckedChange={(v) => setWantThumb(!!v)} className="border-white/30" />Thumb (1024x500)</label>
                <label className="flex items-center gap-2 text-sm text-white/80"><Checkbox checked={wantScreenshotsTablet} onCheckedChange={(v) => setWantScreenshotsTablet(!!v)} className="border-white/30" />Screenshots Tablet</label>
                <label className="flex items-center gap-2 text-sm text-white/80"><Checkbox checked={wantScreenshotsCelular} onCheckedChange={(v) => setWantScreenshotsCelular(!!v)} className="border-white/30" />Screenshots Celular</label>
              </div>
              <Button className="w-full" onClick={() => submitMockupRequest.mutate()} disabled={submitMockupRequest.isPending || (!iconOption && !wantThumb && !wantScreenshotsTablet && !wantScreenshotsCelular)}>
                {submitMockupRequest.isPending ? 'Enviando...' : '🎨 Solicitar Assets'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
