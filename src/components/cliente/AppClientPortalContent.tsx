import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Circle, MessageSquare, Star, Lock, AlertTriangle,
  ExternalLink, Upload, Image as ImageIcon, Loader2, ChevronDown, ChevronUp,
  Palette, Clock, Eye, Rocket, Shield, Smartphone, PartyPopper,
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
import { format } from 'date-fns';
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

// ── 4 macro-steps mapping ──
interface MacroStep {
  id: number;
  label: string;
  icon: typeof Shield;
  phases: number[]; // which original fase_numero values belong here
  description: string;
}

const MACRO_STEPS: MacroStep[] = [
  { id: 0, label: 'Preparação', icon: Shield, phases: [0], description: 'Documentação e materiais iniciais' },
  { id: 1, label: 'Configuração das Lojas', icon: Smartphone, phases: [1, 2], description: 'Criar contas e validar nas lojas' },
  { id: 2, label: 'Construção do App', icon: Rocket, phases: [3, 4], description: 'Formulário, submissão e aprovação' },
  { id: 3, label: 'Lançamento', icon: PartyPopper, phases: [5, 6], description: 'Teste final e publicação' },
];

interface Props {
  clienteId: string;
}

export default function AppClientPortalContent({ clienteId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedMacro, setExpandedMacro] = useState<number | null>(null);
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
  // Mockup modal state
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
  // Review state for mockup approval
  const [reviewingImageId, setReviewingImageId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  // Form state
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
  // If there are multiple fases with the same numero (e.g., two fase 1's), it's parallel
  const isParallelFlow = fases.filter((f: any) => f.numero === 1).length > 1;

  // ── Helper functions ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['portal-checklist'] });
    queryClient.invalidateQueries({ queryKey: ['portal-fases'] });
    queryClient.invalidateQueries({ queryKey: ['portal-cliente'] });
    queryClient.invalidateQueries({ queryKey: ['portal-assets'] });
  };

  const checkFaseCompletion = () => {
    setTimeout(() => {
      invalidateAll();
    }, 500);
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
            cliente_id: clienteId,
            fase_numero: 5,
            texto: `⚠️ PRIORIDADE: Cliente reprovou "${texto}" — verificar e resolver`,
            descricao: `O cliente ${cliente?.nome} (${cliente?.empresa}) desmarcou a etapa "${texto}" na fase de Teste do App.`,
            ator: 'analista',
            obrigatorio: true,
            feito: false,
            ordem: 0,
          });

          await supabase.from('app_notificacoes').insert({
            cliente_id: clienteId,
            tipo: 'teste_app_reprovado',
            canal: 'portal',
            destinatario: 'analista',
            titulo: '🚨 PRIORIDADE: Cliente reprovou teste do app',
            mensagem: `${cliente?.nome} (${cliente?.empresa}) reprovou a etapa "${texto}" durante o teste do app.`,
            agendado_para: new Date().toISOString(),
          });
        }
      }

      if (feito && texto && (texto === ADMIN_GOOGLE_TEXT || texto === ADMIN_APPLE_TEXT)) {
        const adminTexts = [ADMIN_GOOGLE_TEXT, ADMIN_APPLE_TEXT];
        const relevantTexts = cliente?.plataforma === 'google' ? [ADMIN_GOOGLE_TEXT]
          : cliente?.plataforma === 'apple' ? [ADMIN_APPLE_TEXT]
          : adminTexts;
        const otherAdminItems = checklist.filter(i => i.fase_numero === 1 && relevantTexts.includes(i.texto) && i.id !== id);
        const allAdminDone = otherAdminItems.every(i => i.feito);
        if (allAdminDone) {
          await supabase.from('app_notificacoes').insert({
            cliente_id: clienteId,
            tipo: 'validacao_admin_pendente',
            canal: 'portal',
            destinatario: 'analista',
            titulo: '🔔 Validação de convite pendente',
            mensagem: `${cliente?.nome} (${cliente?.empresa}) adicionou apps@membros.app.br como admin.`,
            agendado_para: new Date().toISOString(),
          });
        }
      }
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
          requester_name: cliente!.nome,
          requester_email: cliente!.email,
          platform_url: cliente!.empresa,
          has_trail: false, has_challenge: false, has_community: false,
          notes: 'Solicitação automática via portal do app',
        }).select().single();
        if (reqErr) throw reqErr;
        const { error: imgErr } = await supabase.from('briefing_images').insert({
          request_id: req.id,
          image_type: 'app_mockup' as any,
          observations: item.observations,
          professional_photo_url: item.logoUrl || null,
          sort_order: 0,
        });
        if (imgErr) throw imgErr;
      }

      await supabase.from('app_checklist_items').insert({
        cliente_id: clienteId,
        fase_numero: 0,
        texto: 'Criar Mooni',
        descricao: `Criar o Mooni para ${cliente!.nome} (${cliente!.empresa}).`,
        ator: 'analista',
        obrigatorio: true,
        feito: false,
        ordem: 0,
        tipo: 'mooni',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mockup-requests'] });
      setShowMockupModal(false);
      resetMockupForm();
      toast.success('🎨 Solicitação enviada com sucesso!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveItemData = useMutation({
    mutationFn: async ({ itemId, dados, dadosAnteriores }: { itemId: string; dados: string; dadosAnteriores?: string }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        dados_preenchidos: dados,
        updated_at: new Date().toISOString(),
      }).eq('id', itemId);
      if (error) throw error;
      const { error: histError } = await supabase.from('app_checklist_historico').insert({
        checklist_item_id: itemId,
        dados_anteriores: dadosAnteriores || null,
        dados_novos: dados,
        editado_por: 'cliente',
      });
      if (histError) throw histError;
    },
    onSuccess: () => { invalidateAll(); setEditingItemId(null); setViewingItemId(null); setItemDataInput(''); toast.success('Dados salvos!'); },
    onError: (e: any) => toast.error(e.message),
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
  const fase6 = fases.find((f: any) => f.numero === 6);
  const fase6Done = fase6?.status === 'concluida';
  const pendingAssets = assets.filter((a: any) => a.status === 'aguardando');

  // Filter: only show items visible to the client (ator === 'cliente')
  const clientVisibleItems = checklist.filter((i: any) => i.ator === 'cliente');

  // Calculate macro-step status
  const getMacroStatus = (macro: MacroStep) => {
    const macroFases = fases.filter((f: any) => macro.phases.includes(f.numero));
    if (macroFases.length === 0) return 'locked';
    const allDone = macroFases.every((f: any) => f.status === 'concluida');
    if (allDone) return 'done';
    const anyActive = macroFases.some((f: any) => f.status === 'em_andamento' || f.status === 'atrasada');
    if (anyActive) return 'active';
    return 'locked';
  };

  // Get current macro step
  const currentMacroIdx = MACRO_STEPS.findIndex(m => getMacroStatus(m) === 'active');

  // For parallel flow, get per-platform progress for a macro step
  const getPlatformProgress = (macro: MacroStep, platform: string) => {
    const items = checklist.filter((i: any) =>
      macro.phases.includes(i.fase_numero) &&
      (i.plataforma === platform || i.plataforma === 'compartilhada')
    );
    const total = items.length;
    const done = items.filter((i: any) => i.feito).length;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  // Get client-visible items for a macro step, optionally filtered by platform
  const getMacroClientItems = (macro: MacroStep, platform?: string) => {
    return clientVisibleItems.filter((i: any) => {
      if (!macro.phases.includes(i.fase_numero)) return false;
      // Hide mooni tasks and hidden prereqs
      if (i.tipo === 'mooni') return false;
      if (isHiddenPrereq(i.texto)) return false;
      // Platform filter
      if (platform && i.plataforma !== 'compartilhada' && i.plataforma !== platform) return false;
      return true;
    });
  };

  // Check if there are any pending internal tasks for this macro step
  const hasInternalPendingTasks = (macro: MacroStep) => {
    return checklist.some((i: any) =>
      macro.phases.includes(i.fase_numero) &&
      i.ator !== 'cliente' &&
      !i.feito &&
      i.tipo !== 'mooni'
    );
  };

  const HIDDEN_PREREQ_TEXTS = ['Ícone do App', 'Splash Screen', 'Screenshots', 'aprovou todos os assets'];
  const isHiddenPrereq = (texto: string) => HIDDEN_PREREQ_TEXTS.some(t => texto.toLowerCase().includes(t.toLowerCase()));

  // Dynamic contextual message
  const getDynamicMessage = () => {
    if (cliente?.fase_atual! >= 6 && fase6Done) return '🎉 Seu app está publicado!';
    if (cliente?.fase_atual === 6) return '🚀 Quase lá! Sua equipe está publicando o app nas lojas.';

    const clientPendingCount = clientVisibleItems.filter(i =>
      !i.feito && i.fase_numero === cliente?.fase_atual
    ).length;

    // Check parallel progress
    if (isParallelFlow) {
      const googleFase4 = fases.find((f: any) => f.numero === 4 && f.plataforma === 'google');
      const appleFase4 = fases.find((f: any) => f.numero === 4 && f.plataforma === 'apple');
      if (googleFase4?.status === 'concluida' && appleFase4?.status !== 'concluida') {
        return '🤖 Google Play já aprovado! Aguardando Apple...';
      }
      if (appleFase4?.status === 'concluida' && googleFase4?.status !== 'concluida') {
        return '🍎 App Store já aprovada! Aguardando Google Play...';
      }
    }

    if (cliente?.fase_atual === 5) return '🏁 Última reta! Teste seu app e aprove para publicarmos.';
    if (clientPendingCount > 0) return `Seu app está ${cliente?.porcentagem_geral}% pronto — faltam ${clientPendingCount} tarefa(s) suas!`;

    // Internal work in progress
    const currentMacroFases = fases.filter((f: any) => f.status === 'em_andamento');
    if (currentMacroFases.length > 0) {
      return 'A equipe Curseduca está trabalhando no seu app! Você será notificado quando precisarmos de algo.';
    }

    return `Seu app está ${cliente?.porcentagem_geral || 0}% pronto`;
  };

  // ── Celebration effects ──
  useEffect(() => {
    if (cliente?.fase_atual === 6 && fase6Done) {
      setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } }), 500);
    }
  }, [cliente?.fase_atual, fase6Done]);

  // ── Loading ──
  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (!cliente) return <div className="text-center py-12 text-white/50">Dados não encontrados</div>;

  // ── Render helpers ──
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
                {steps.map((step, i) => <p key={i} className="text-xs text-white/60">{step}</p>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderClientItem = (item: any) => {
    const canEdit = fases.some((f: any) => f.numero === item.fase_numero && (f.status === 'em_andamento' || f.status === 'atrasada'));

    // Form type items
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
              <p className="text-xs text-white/50 mb-2">Preencha as informações do seu aplicativo.</p>
              <div>
                <Label className="text-white/70">Nome do aplicativo *</Label>
                <Input className="bg-white/5 border-white/10 text-white" value={formData.nome_app} onChange={e => setFormData(p => ({ ...p, nome_app: e.target.value }))} />
              </div>
              <div>
                <Label className="text-white/70">Descrição curta * ({formData.descricao_curta.length}/80)</Label>
                <Input className="bg-white/5 border-white/10 text-white" value={formData.descricao_curta} maxLength={80} onChange={e => setFormData(p => ({ ...p, descricao_curta: e.target.value }))} />
              </div>
              <div>
                <Label className="text-white/70">URL Política de Privacidade *</Label>
                <Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_privacidade} onChange={e => setFormData(p => ({ ...p, url_privacidade: e.target.value }))} />
              </div>
              <div>
                <Label className="text-white/70">Descrição completa (opcional)</Label>
                <Textarea className="bg-white/5 border-white/10 text-white min-h-[100px]" value={formData.descricao_longa} maxLength={4000} onChange={e => setFormData(p => ({ ...p, descricao_longa: e.target.value }))} />
              </div>
              <div>
                <Label className="text-white/70">URL Termos de Uso (opcional)</Label>
                <Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_termos} onChange={e => setFormData(p => ({ ...p, url_termos: e.target.value }))} />
              </div>
              <Button className="w-full" onClick={() => saveForm.mutate()} disabled={saveForm.isPending || !formData.nome_app || !formData.descricao_curta || !formData.url_privacidade}>
                {saveForm.isPending ? 'Salvando...' : 'Enviar formulário'}
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Approval final — strong confirmation
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
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
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

    // Approval type (assets)
    if (item.tipo === 'approval') {
      return (
        <div key={item.id} className="space-y-3 p-3 rounded-lg bg-white/5">
          <div className="flex items-start gap-3">
            <Star className="h-5 w-5 mt-0.5 text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
            </div>
          </div>
          {pendingAssets.length > 0 ? (
            <div className="space-y-2 ml-8">
              {pendingAssets.map((asset: any) => (
                <div key={asset.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    {asset.url ? (
                      <img src={asset.url} alt={asset.nome_arquivo} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-white/30" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{asset.nome_arquivo || asset.tipo}</p>
                    </div>
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

    // CNPJ special
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

    // Email corporativo
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

    // Site
    if (item.texto === SITE_TEXT) {
      const isValidSite = /^(https?:\/\/)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(siteInput) && !/\.(wixsite|blogspot|wordpress)\./i.test(siteInput);
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox checked={item.feito} onCheckedChange={(checked) => { if (checked) setSitePromptId(item.id); else toggleCheck.mutate({ id: item.id, feito: false }); }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : ''}`}>{item.texto}</p>
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
            <p className={`text-sm font-medium ${item.feito ? 'text-green-400' : ''}`}>{item.texto}</p>
            {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
            {item.feito && item.feito_em && (
              <p className="text-[10px] text-green-400/70 mt-1">✅ {format(new Date(item.feito_em), "dd/MM/yyyy 'às' HH:mm")}</p>
            )}
            {!canEdit && item.feito && (
              <p className="text-[10px] text-amber-400/70 flex items-center gap-1 mt-1"><Lock className="h-3 w-3" /> Somente visualização</p>
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
                      setConfirmingItemId(null);
                      setItemDataInput('');
                      // Celebration pulse
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

  // ── Platform column rendering ──
  const renderPlatformColumn = (platform: 'google' | 'apple', macro: MacroStep) => {
    const items = getMacroClientItems(macro, platform);
    const allItems = checklist.filter((i: any) => macro.phases.includes(i.fase_numero) && (i.plataforma === platform || i.plataforma === 'compartilhada'));
    const total = allItems.length;
    const done = allItems.filter((i: any) => i.feito).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const platformFases = fases.filter((f: any) => macro.phases.includes(f.numero) && f.plataforma === platform);
    const allPlatformDone = platformFases.length > 0 && platformFases.every((f: any) => f.status === 'concluida');
    const isEmoji = platform === 'google' ? '🤖' : '🍎';
    const label = platform === 'google' ? 'Google Play' : 'App Store';
    const borderColor = platform === 'google' ? 'border-blue-500/30' : 'border-purple-500/30';
    const bgColor = platform === 'google' ? 'bg-blue-500/5' : 'bg-purple-500/5';

    return (
      <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2">
            {isEmoji} {label}
          </span>
          {allPlatformDone ? (
            <Badge className="bg-green-500/20 text-green-400 border-0 text-[10px]">✅ Pronto</Badge>
          ) : (
            <span className="text-xs text-white/50">{progress}%</span>
          )}
        </div>
        <Progress value={progress} className="h-1.5" />
        {allPlatformDone ? (
          <p className="text-xs text-green-400/70">🎉 {label} está pronto!</p>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.filter(i => !i.feito).map(item => renderClientItem(item))}
          </div>
        ) : hasInternalPendingTasks(macro) ? (
          <div className="text-center py-3 space-y-2">
            <Clock className="h-6 w-6 text-white/30 mx-auto" />
            <p className="text-xs text-white/50">Equipe trabalhando...</p>
          </div>
        ) : null}
      </div>
    );
  };

  // ── Macro step card content ──
  const renderMacroContent = (macro: MacroStep) => {
    const status = getMacroStatus(macro);
    const showPlatformColumns = isParallelFlow && (macro.id === 1 || macro.id === 2);

    if (status === 'locked') {
      return (
        <div className="text-center py-6 space-y-2">
          <Lock className="h-8 w-8 text-white/20 mx-auto" />
          <p className="text-sm text-white/40">Esta etapa será desbloqueada em breve</p>
        </div>
      );
    }

    if (status === 'done') {
      return (
        <div className="text-center py-4 space-y-2">
          <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
          <p className="text-sm text-green-400 font-semibold">Etapa concluída! 🎉</p>
          {showPlatformColumns && (
            <div className="flex justify-center gap-3 mt-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-0">🤖 Google ✅</Badge>
              <Badge className="bg-purple-500/20 text-purple-400 border-0">🍎 Apple ✅</Badge>
            </div>
          )}
        </div>
      );
    }

    // Active state
    if (showPlatformColumns) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {renderPlatformColumn('google', macro)}
          {renderPlatformColumn('apple', macro)}
        </div>
      );
    }

    // Shared/single platform
    const clientItems = getMacroClientItems(macro);
    const pendingItems = clientItems.filter(i => !i.feito);
    const hasInternalWork = hasInternalPendingTasks(macro);

    // Special: Mockup request in Preparation
    const showMockupBtn = macro.id === 0 && !mockupRequest;

    return (
      <div className="space-y-3">
        {pendingItems.map(item => renderClientItem(item))}
        {showMockupBtn && (
          <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5" onClick={() => setShowMockupModal(true)}>
            <Palette className="h-4 w-4 mr-2" /> Solicitar Mockup do App
          </Button>
        )}
        {mockupRequest && macro.id === 0 && (
          <div className="rounded-lg p-3 bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            <p className="text-xs text-green-400">Mockup solicitado! Acompanhe na aba "Artes".</p>
          </div>
        )}
        {pendingItems.length === 0 && hasInternalWork && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-6 space-y-3 rounded-xl bg-white/5 border border-white/10">
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
          </motion.div>
        )}
      </div>
    );
  };

  // ── Published state ──
  if (cliente.fase_atual >= 6 && fase6Done) {
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
          <h1 className="text-2xl font-extrabold">🎉 SEU APP ESTÁ PUBLICADO!</h1>
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
        {/* Achievements */}
        <div>
          <h2 className="text-lg font-semibold mb-3">🏆 Conquistas</h2>
          <div className="flex flex-wrap gap-2">
            {isParallelFlow && (
              <>
                <Badge className="bg-blue-500/20 text-blue-400 px-3 py-1.5">🤖 Google Play Aprovado</Badge>
                <Badge className="bg-purple-500/20 text-purple-400 px-3 py-1.5">🍎 App Store Aprovada</Badge>
              </>
            )}
            <Badge className="bg-green-500/20 text-green-400 px-3 py-1.5">🏆 App Publicado!</Badge>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render: 4 macro-step cards ──
  return (
    <div className="space-y-6">
      {/* Hero message */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-lg font-bold">Olá, {cliente.nome?.split(' ')[0]}! 👋</h1>
        <p className="text-white/60 text-sm mt-0.5">{getDynamicMessage()}</p>
        {cliente.data_criacao && (
          <p className="text-[11px] text-primary/80 mt-1.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Processo iniciado em <span className="font-semibold text-primary">{format(new Date(cliente.data_criacao), 'dd/MM/yyyy')}</span>
          </p>
        )}
      </motion.div>

      {/* CNPJ alert */}
      {prereqs?.cnpj_bloqueado && (
        <Card className="bg-red-500/10 border-red-500/30 p-4 text-red-400">
          <p className="font-semibold">⚠️ CNPJ MEI não aceito pela Apple</p>
          <p className="text-sm mt-1 text-red-400/70">Entre em contato com a equipe.</p>
        </Card>
      )}

      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Progresso geral</span>
          <span className="font-bold text-white">{cliente.porcentagem_geral}%</span>
        </div>
        <Progress value={cliente.porcentagem_geral || 0} className="h-2" />
      </div>

      {/* 4 Macro-step cards */}
      <div className="space-y-3">
        {MACRO_STEPS.map((macro, idx) => {
          const status = getMacroStatus(macro);
          const isExpanded = expandedMacro === idx;
          const Icon = macro.icon;

          const showPlatformIndicators = isParallelFlow && (macro.id === 1 || macro.id === 2) && status === 'active';

          return (
            <motion.div
              key={macro.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card
                className={`overflow-hidden transition-all cursor-pointer ${
                  status === 'done' ? 'bg-green-500/5 border-green-500/20' :
                  status === 'active' ? 'bg-[#1E293B] border-primary/30 ring-1 ring-primary/20' :
                  'bg-white/[0.02] border-white/5 opacity-60'
                }`}
                onClick={() => setExpandedMacro(isExpanded ? null : idx)}
              >
                {/* Card header */}
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    status === 'done' ? 'bg-green-500/20' :
                    status === 'active' ? 'bg-primary/20' :
                    'bg-white/5'
                  }`}>
                    {status === 'done' ? (
                      <CheckCircle2 className="h-6 w-6 text-green-400" />
                    ) : status === 'active' ? (
                      <Icon className="h-6 w-6 text-primary" />
                    ) : (
                      <Lock className="h-5 w-5 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-bold ${
                        status === 'done' ? 'text-green-400' :
                        status === 'active' ? 'text-white' :
                        'text-white/30'
                      }`}>
                        {idx + 1}. {macro.label}
                      </h3>
                      {status === 'active' && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${status === 'active' ? 'text-white/50' : 'text-white/20'}`}>
                      {macro.description}
                    </p>
                    {/* Platform sub-indicators */}
                    {showPlatformIndicators && (
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span>🤖</span>
                          <span className="text-blue-400 font-medium">{getPlatformProgress(macro, 'google')}%</span>
                          {getPlatformProgress(macro, 'google') === 100 && <span className="text-green-400">✅</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span>🍎</span>
                          <span className="text-purple-400 font-medium">{getPlatformProgress(macro, 'apple')}%</span>
                          {getPlatformProgress(macro, 'apple') === 100 && <span className="text-green-400">✅</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-white/30 transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-white/5 pt-4" onClick={(e) => e.stopPropagation()}>
                        {renderMacroContent(macro)}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Achievements */}
      <div>
        <h2 className="text-lg font-semibold mb-3">🏆 Conquistas</h2>
        <div className="flex flex-wrap gap-2">
          {MACRO_STEPS.filter(m => getMacroStatus(m) === 'done').map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
              <Badge className="bg-green-500/20 text-green-400 px-3 py-1.5">🏆 {m.label}</Badge>
            </motion.div>
          ))}
          {isParallelFlow && (() => {
            const googleApproved = fases.find((f: any) => f.numero === 4 && f.plataforma === 'google' && f.status === 'concluida');
            const appleApproved = fases.find((f: any) => f.numero === 4 && f.plataforma === 'apple' && f.status === 'concluida');
            return (
              <>
                {googleApproved && <Badge className="bg-blue-500/20 text-blue-400 px-3 py-1.5">🤖 Google Play Aprovado</Badge>}
                {appleApproved && <Badge className="bg-purple-500/20 text-purple-400 px-3 py-1.5">🍎 App Store Aprovada</Badge>}
              </>
            );
          })()}
          {MACRO_STEPS.filter(m => getMacroStatus(m) === 'done').length === 0 && (
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
                <p className="text-xs text-white/60">Quer que o ícone do app seja sua logo?</p>
                <RadioGroup value={iconOption} onValueChange={(v: 'yes' | 'no') => setIconOption(v)} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="icon-yes" className="border-white/30" /><Label htmlFor="icon-yes" className="text-sm cursor-pointer">Sim</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="no" id="icon-no" className="border-white/30" /><Label htmlFor="icon-no" className="text-sm cursor-pointer">Não</Label></div>
                </RadioGroup>
                {iconOption === 'yes' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-white/60">Envie a logo *</Label>
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={(e) => setIconLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-white/60 file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:text-primary" />
                    {iconLogoFile && <p className="text-[10px] text-green-400">✓ {iconLogoFile.name}</p>}
                  </div>
                )}
                {iconOption === 'no' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-white/60">Descreva como deseja o ícone *</Label>
                    <Textarea value={iconDescription} onChange={(e) => setIconDescription(e.target.value)} placeholder="Ex: Ícone minimalista..." className="bg-white/5 border-white/10 text-white min-h-[80px]" />
                  </div>
                )}
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox id="want-thumb" checked={wantThumb} onCheckedChange={(v) => setWantThumb(!!v)} className="mt-0.5 border-white/30" />
                <div><Label htmlFor="want-thumb" className="text-sm font-semibold cursor-pointer">🖼️ Thumb (1024x500)</Label><p className="text-xs text-white/50 mt-0.5">Imagem destaque para a loja</p></div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox id="want-tablet" checked={wantScreenshotsTablet} onCheckedChange={(v) => setWantScreenshotsTablet(!!v)} className="mt-0.5 border-white/30" />
                <div><Label htmlFor="want-tablet" className="text-sm font-semibold cursor-pointer">📱 4 Screenshots Tablet</Label></div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox id="want-celular" checked={wantScreenshotsCelular} onCheckedChange={(v) => setWantScreenshotsCelular(!!v)} className="mt-0.5 border-white/30" />
                <div><Label htmlFor="want-celular" className="text-sm font-semibold cursor-pointer">📲 4 Screenshots Celular</Label></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-white/10" onClick={() => setMockupStep(1)}>← Voltar</Button>
                <Button className="flex-1"
                  disabled={submitMockupRequest.isPending || (iconOption === 'yes' && !iconLogoFile) || (iconOption === 'no' && !iconDescription.trim()) || (!iconOption && !wantThumb && !wantScreenshotsTablet && !wantScreenshotsCelular)}
                  onClick={() => submitMockupRequest.mutate()}>
                  {submitMockupRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enviar solicitação
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
