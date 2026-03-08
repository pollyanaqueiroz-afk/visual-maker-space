import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Circle, MessageSquare, Star, Lock, AlertTriangle,
  ExternalLink, Upload, Image as ImageIcon, Loader2, ChevronDown, ChevronUp,
  Palette, Clock, Eye,
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

const FASE_NAMES = ['Pré-Requisitos','Primeiros Passos','Validação pela Loja','Criação e Submissão','Aprovação das Lojas','Teste do App','Publicado 🎉'];

interface Props {
  clienteId: string;
}

export default function AppClientPortalContent({ clienteId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedFase, setExpandedFase] = useState<number | null>(null);
  const [selectedTimelineFase, setSelectedTimelineFase] = useState<number | null>(null);
  const [expandedTimelineItem, setExpandedTimelineItem] = useState<string | null>(null);
  const [assetComment, setAssetComment] = useState<Record<string, string>>({});
  const [assetCommenting, setAssetCommenting] = useState<string | null>(null);
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjPromptId, setCnpjPromptId] = useState<string | null>(null);
  const [emailCorpInput, setEmailCorpInput] = useState('');
  const [emailCorpPromptId, setEmailCorpPromptId] = useState<string | null>(null);
  const [siteInput, setSiteInput] = useState('');
  const [sitePromptId, setSitePromptId] = useState<string | null>(null);
  const [showMockupForm, setShowMockupForm] = useState(false);
  const [mockupObservations, setMockupObservations] = useState('');
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  // New mockup modal state
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

  const CNPJ_TEXT = 'Confirmei que meu CNPJ é ME ou LTDA';
  const EMAIL_CORP_TEXT = 'Tenho um e-mail corporativo';
  const SITE_TEXT = 'Meu site está publicado com domínio próprio';

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

  // Query ALL mockup briefing requests linked to this client's platform URL
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

  // Backward compat: single mockupRequest for virtual timeline item
  const mockupRequest = mockupRequests.length > 0 ? mockupRequests[0] : null;

  // Review state for mockup approval
  const [reviewingImageId, setReviewingImageId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');

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

  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const toggleSteps = (id: string) => setExpandedSteps(p => ({ ...p, [id]: !p[id] }));

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

  const ADMIN_GOOGLE_TEXT = 'Adicionei apps@membros.app.br como admin (Google)';
  const ADMIN_APPLE_TEXT = 'Adicionei apps@membros.app.br como admin (Apple)';

  const toggleCheck = useMutation({
    mutationFn: async ({ id, feito, texto }: { id: string; feito: boolean; texto?: string }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        feito, feito_em: feito ? new Date().toISOString() : null, feito_por: 'cliente',
      }).eq('id', id);
      if (error) throw error;

      // When client adds admin, create notification for implantação team
      if (feito && texto && (texto === ADMIN_GOOGLE_TEXT || texto === ADMIN_APPLE_TEXT)) {
        const platform = texto === ADMIN_GOOGLE_TEXT ? 'Google' : 'Apple';
        // Check if all admin items for this client are now done
        const adminTexts = [ADMIN_GOOGLE_TEXT, ADMIN_APPLE_TEXT];
        const relevantTexts = cliente?.plataforma === 'google' ? [ADMIN_GOOGLE_TEXT]
          : cliente?.plataforma === 'apple' ? [ADMIN_APPLE_TEXT]
          : adminTexts;
        
        const otherAdminItems = checklist.filter(i => i.fase_numero === 1 && relevantTexts.includes(i.texto) && i.id !== id);
        const allAdminDone = otherAdminItems.every(i => i.feito);

        if (allAdminDone) {
          // All admin items done — notify implantação team
          await supabase.from('app_notificacoes').insert({
            cliente_id: clienteId,
            tipo: 'validacao_admin_pendente',
            canal: 'portal',
            destinatario: 'analista',
            titulo: '🔔 Validação de convite pendente',
            mensagem: `${cliente?.nome} (${cliente?.empresa}) adicionou apps@membros.app.br como admin. Valide o recebimento do convite.`,
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

  const submitMockupRequest = useMutation({
    mutationFn: async () => {
      const items: { observations: string; logoUrl?: string }[] = [];

      // Icon
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-mockup-requests'] });
      setShowMockupModal(false);
      resetMockupForm();
      toast.success('🎨 Solicitação enviada com sucesso!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMockupForm = () => {
    setMockupStep(1);
    setIconOption('');
    setIconLogoFile(null);
    setIconDescription('');
    setWantThumb(true);
    setWantScreenshotsTablet(true);
    setWantScreenshotsCelular(true);
    setShowMockupForm(false);
    setMockupObservations('');
  };

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-formulario'] });
      invalidateAll();
      toast.success('Formulário salvo!');
      checkFaseCompletion();
    },
  });

  const fase6 = fases.find((f: any) => f.numero === 6);
  const fase6Done = fase6?.status === 'concluida';

  useEffect(() => {
    if (cliente?.fase_atual === 6 && fase6Done) {
      setTimeout(() => confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } }), 500);
    }
  }, [cliente?.fase_atual, fase6Done]);

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>;
  if (!cliente) return <div className="text-center py-12 text-white/50">Dados não encontrados</div>;

  const DUNS_TEXT = 'Solicitei o número DUNS da minha empresa';

  const GOOGLE_TEXTS = ['Criei a conta no Google Play Console', 'Adicionei apps@membros.app.br como admin (Google)'];
  const APPLE_TEXTS = ['Criei a conta no Apple Developer Program', 'Adicionei apps@membros.app.br como admin (Apple)'];

  const HIDDEN_PREREQ_TEXTS = ['Ícone do App', 'Splash Screen', 'Screenshots', 'aprovou todos os assets'];
  const isHiddenPrereq = (texto: string) => HIDDEN_PREREQ_TEXTS.some(t => texto.toLowerCase().includes(t.toLowerCase()));

  const currentItems = checklist.filter(i => {
    if (i.fase_numero !== cliente.fase_atual || i.ator !== 'cliente') return false;
    if (isHiddenPrereq(i.texto)) return false;
    if (i.texto === DUNS_TEXT && i.feito) return true;
    if (i.feito) return false;
    if (cliente.plataforma === 'google' && i.texto === 'Confirmei que meu CNPJ é ME ou LTDA') return false;
    if (cliente.plataforma === 'google' && i.texto === DUNS_TEXT) return false;
    // Filter platform-specific items
    if (cliente.plataforma === 'google' && APPLE_TEXTS.includes(i.texto)) return false;
    if (cliente.plataforma === 'apple' && GOOGLE_TEXTS.includes(i.texto)) return false;
    return true;
  });
  const hasClientAction = currentItems.length > 0;

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

  const renderSteps = (itemText: string, itemId: string) => {
    const steps = STEP_BY_STEP[itemText];
    if (!steps) return null;
    const isOpen = expandedSteps[itemId];
    return (
      <div className="mt-2">
        <button
          onClick={(e) => { e.stopPropagation(); toggleSteps(itemId); }}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {isOpen ? 'Ocultar passo a passo' : 'Ver passo a passo'}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1 rounded-lg bg-white/5 p-3">
                {steps.map((step, i) => (
                  <p key={i} className="text-xs text-white/60">{step}</p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderChecklistItem = (item: any) => {
    // DUNS item - special rendering when done
    if (item.texto === DUNS_TEXT && item.feito) {
      const doneDate = item.feito_em ? new Date(item.feito_em) : new Date();
      const estimatedDate = addBusinessDays(doneDate, 14);
      return (
        <div key={item.id} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={true}
              onCheckedChange={(checked) => toggleCheck.mutate({ id: item.id, feito: !!checked })}
              className="mt-0.5 border-green-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400 line-through">{item.texto}</p>
              <p className="text-xs text-green-400/70 mt-1">
                ✅ Solicitado em {format(doneDate, 'dd/MM/yyyy')}
              </p>
              <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <p className="text-xs text-blue-300 font-medium">📧 O número DUNS chegará no seu e-mail até:</p>
                <p className="text-sm font-bold text-blue-400 mt-1">{format(estimatedDate, 'dd/MM/yyyy')}</p>
                <p className="text-[10px] text-blue-300/60 mt-1">Prazo estimado de 14 dias úteis. Fique de olho na caixa de entrada e spam.</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (item.tipo === 'link') {
      const link = extractLink(item.descricao);
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
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
              {renderSteps(item.texto, item.id)}
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

    // Approval final — strong confirmation for app publication
    if (item.tipo === 'approval_final') {
      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={item.feito}
              onCheckedChange={(checked) => {
                if (checked) {
                  setConfirmingItemId(item.id);
                } else {
                  toggleCheck.mutate({ id: item.id, feito: false, texto: item.texto });
                }
              }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
              {renderSteps(item.texto, item.id)}

              {confirmingItemId === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                      <p className="text-sm text-amber-300 font-semibold">Tem certeza que deseja aprovar?</p>
                    </div>
                    <p className="text-xs text-amber-300/70">
                      Ao aprovar, você confirma que testou o aplicativo, verificou que tudo está funcionando corretamente 
                      e autoriza a publicação nas lojas. <span className="font-semibold text-amber-300">Esta ação não pode ser desfeita.</span>
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          toggleCheck.mutate({ id: item.id, feito: true, texto: item.texto });
                          setConfirmingItemId(null);
                          toast.success('🎉 App aprovado para publicação!');
                        }}
                      >
                        ✅ Sim, aprovar publicação
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/60"
                        onClick={() => setConfirmingItemId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // CNPJ item — show input prompt
    if (item.texto === CNPJ_TEXT) {
      const formatCnpj = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 14);
        return digits
          .replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      };
      const isValidCnpj = cnpjInput.replace(/\D/g, '').length === 14;

      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={item.feito}
              onCheckedChange={(checked) => {
                if (checked) {
                  setCnpjPromptId(item.id);
                } else {
                  toggleCheck.mutate({ id: item.id, feito: false });
                }
              }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
              {renderSteps(item.texto, item.id)}

              {cnpjPromptId === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <Label className="text-xs text-white/70">Informe seu CNPJ para confirmar</Label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={cnpjInput}
                    onChange={e => setCnpjInput(formatCnpj(e.target.value))}
                    className="bg-white/5 border-white/10 text-white text-sm"
                    maxLength={18}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!isValidCnpj}
                      onClick={() => {
                        toggleCheck.mutate({ id: item.id, feito: true });
                        setCnpjPromptId(null);
                        setCnpjInput('');
                        toast.success('CNPJ confirmado!');
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCnpjPromptId(null); setCnpjInput(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Email corporativo item — show input prompt
    if (item.texto === EMAIL_CORP_TEXT) {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCorpInput) && !/(@gmail\.|@hotmail\.|@yahoo\.|@outlook\.)/i.test(emailCorpInput);

      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={item.feito}
              onCheckedChange={(checked) => {
                if (checked) {
                  setEmailCorpPromptId(item.id);
                } else {
                  toggleCheck.mutate({ id: item.id, feito: false });
                }
              }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
              {renderSteps(item.texto, item.id)}

              {emailCorpPromptId === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <Label className="text-xs text-white/70">Informe seu e-mail corporativo</Label>
                  <Input
                    type="email"
                    placeholder="seunome@suaempresa.com.br"
                    value={emailCorpInput}
                    onChange={e => setEmailCorpInput(e.target.value.trim())}
                    className="bg-white/5 border-white/10 text-white text-sm"
                    maxLength={255}
                  />
                  {emailCorpInput && !isValidEmail && (
                    <p className="text-[10px] text-amber-400">Use um e-mail corporativo (Gmail, Hotmail, Yahoo não são aceitos)</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!isValidEmail}
                      onClick={() => {
                        toggleCheck.mutate({ id: item.id, feito: true });
                        setEmailCorpPromptId(null);
                        setEmailCorpInput('');
                        toast.success('E-mail corporativo confirmado!');
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEmailCorpPromptId(null); setEmailCorpInput(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Site item — show input prompt
    if (item.texto === SITE_TEXT) {
      const isValidSite = /^(https?:\/\/)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(siteInput) && !/\.(wixsite|blogspot|wordpress)\./i.test(siteInput);

      return (
        <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={item.feito}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSitePromptId(item.id);
                } else {
                  toggleCheck.mutate({ id: item.id, feito: false });
                }
              }}
              className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <div className="flex-1">
              <p className="text-sm font-medium">{item.texto}</p>
              {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
              {renderSteps(item.texto, item.id)}

              {sitePromptId === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  <Label className="text-xs text-white/70">Informe a URL do seu site</Label>
                  <Input
                    type="url"
                    placeholder="https://www.suaempresa.com.br"
                    value={siteInput}
                    onChange={e => setSiteInput(e.target.value.trim())}
                    className="bg-white/5 border-white/10 text-white text-sm"
                    maxLength={255}
                  />
                  {siteInput && !isValidSite && (
                    <p className="text-[10px] text-amber-400">Use um domínio próprio (subdomínios gratuitos não são aceitos)</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!isValidSite}
                      onClick={() => {
                        toggleCheck.mutate({ id: item.id, feito: true });
                        setSitePromptId(null);
                        setSiteInput('');
                        toast.success('Site confirmado!');
                      }}
                    >
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSitePromptId(null); setSiteInput(''); }}>
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default: check type with confirmation
    return (
      <div key={item.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={item.feito}
            onCheckedChange={(checked) => {
              if (checked) {
                setConfirmingItemId(item.id);
              } else {
                toggleCheck.mutate({ id: item.id, feito: false, texto: item.texto });
              }
            }}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">{item.texto}</p>
            {item.descricao && <p className="text-xs text-white/50 mt-1">{item.descricao}</p>}
            {renderSteps(item.texto, item.id)}

            {item.texto === ADMIN_APPLE_TEXT && (
              <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300">Não esqueça de aceitar os termos ao final da página da Apple.</p>
              </div>
            )}

            {confirmingItemId === item.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 overflow-hidden"
              >
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-2">
                  <p className="text-xs text-amber-300 font-medium">Tem certeza que concluiu esta etapa?</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        toggleCheck.mutate({ id: item.id, feito: true, texto: item.texto });
                        setConfirmingItemId(null);
                      }}
                    >
                      Sim, concluí
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/60"
                      onClick={() => setConfirmingItemId(null)}
                    >
                      Não
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      {/* Horizontal Timeline */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        {cliente.fase_atual >= 6 && fase6Done ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="text-center space-y-4 py-6"
          >
            <div className="inline-flex items-center justify-center mx-auto">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg shadow-green-500/30">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
              </div>
            </div>
            <div>
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 text-sm px-4 py-1.5 shadow-lg shadow-green-500/25 mb-3">
                ✅ PUBLICADO NAS LOJAS
              </Badge>
              <h1 className="text-2xl font-extrabold mt-2">🎉 SEU APP ESTÁ PUBLICADO!</h1>
              <p className="text-white/70 text-sm mt-1">Parabéns! Seu app da {cliente.empresa} está disponível nas lojas.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <a href="https://play.google.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors px-4 py-2 text-xs font-medium text-white/80">
                <ExternalLink className="h-3.5 w-3.5" /> Google Play
              </a>
              <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors px-4 py-2 text-xs font-medium text-white/80">
                <ExternalLink className="h-3.5 w-3.5" /> App Store
              </a>
            </div>
          </motion.div>
        ) : cliente.fase_atual === 6 && !fase6Done ? (
          <div>
            <h1 className="text-lg font-bold">Quase lá! 🚀</h1>
            <p className="text-white/60 text-sm mt-0.5">Seu app foi aprovado! Nossa equipe está publicando nas lojas.</p>
          </div>
        ) : (
          <div>
            <h1 className="text-lg font-bold">Olá! 👋</h1>
            <p className="text-white/60 text-sm mt-0.5">Seu app está <span className="text-white font-bold">{cliente.porcentagem_geral}%</span> pronto</p>
            {cliente.data_criacao && (
              <p className="text-[11px] text-primary/80 mt-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Processo iniciado em <span className="font-semibold text-primary">{format(new Date(cliente.data_criacao), 'dd/MM/yyyy')}</span>
              </p>
            )}
          </div>
        )}

        <div className="relative px-2 overflow-hidden">
          {/* Line connecting all steps */}
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-white/10" />
          <div
            className="absolute top-5 left-6 h-0.5 bg-green-500 transition-all duration-500"
            style={{ width: `calc(${(cliente.fase_atual / (FASE_NAMES.length - 1)) * 100}% - 48px)` }}
          />

          <div className="relative flex justify-between">
            {FASE_NAMES.map((name, idx) => {
              const fase = fases.find((f: any) => f.numero === idx);
              const isCurrent = idx === cliente.fase_atual;
              const isDone = fase?.status === 'concluida';
              const isLate = fase?.status === 'atrasada';
              const faseItems = checklist.filter((i: any) => i.fase_numero === idx);
              const doneCount = faseItems.filter((i: any) => i.feito && i.obrigatorio).length;
              const totalCount = faseItems.filter((i: any) => i.obrigatorio).length;
              const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

              return (
                <div key={idx} className="flex flex-col items-center" style={{ width: `${100 / FASE_NAMES.length}%` }}>
                  {/* Circle with progress ring — clickable */}
                  <button
                    className="relative cursor-pointer"
                    onClick={() => setSelectedTimelineFase(selectedTimelineFase === idx ? null : idx)}
                  >
                    {/* Progress ring for current and in-progress phases */}
                    {(isCurrent || (fase?.status === 'em_andamento' && !isDone)) && (
                      <svg className="absolute -inset-1 w-12 h-12" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="19" fill="none" stroke="hsl(var(--primary) / 0.2)" strokeWidth="3" />
                        <circle
                          cx="22" cy="22" r="19" fill="none"
                          stroke="hsl(var(--primary))" strokeWidth="3"
                          strokeDasharray={`${progress * 1.194} 120`}
                          strokeLinecap="round"
                          transform="rotate(-90 22 22)"
                          className="transition-all duration-500"
                        />
                      </svg>
                    )}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isDone ? 'bg-green-500/20 text-green-400' :
                      isCurrent ? 'bg-primary/20 text-primary ring-2 ring-primary/40 scale-110' :
                      isLate ? 'bg-red-500/20 text-red-400' :
                      'bg-white/5 text-white/20'
                    }`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> :
                       isLate ? <AlertTriangle className="h-4 w-4" /> :
                       isCurrent ? <Star className="h-4 w-4 animate-pulse" /> :
                       <span>{idx + 1}</span>}
                    </div>
                  </button>
                  {/* Label */}
                  <p className={`text-[9px] mt-1.5 text-center leading-tight max-w-[60px] ${
                    isCurrent ? 'text-primary font-semibold' :
                    isDone ? 'text-green-400/70' :
                    'text-white/30'
                  }`}>
                    {name}
                  </p>
                  {/* Progress percentage */}
                  <p className={`text-[8px] mt-0.5 font-medium ${
                    isDone ? 'text-green-400/60' :
                    isCurrent ? 'text-primary/80' :
                    progress > 0 ? 'text-white/40' :
                    'text-white/15'
                  }`}>
                    {isDone ? '100%' : totalCount > 0 ? `${Math.round(progress)}%` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded phase checklist */}
        <AnimatePresence>
          {selectedTimelineFase !== null && (() => {
            let items: any[] = checklist.filter((i: any) => i.fase_numero === selectedTimelineFase && !isHiddenPrereq(i.texto));
            // Add virtual mockup request item in phase 0
            if (selectedTimelineFase === 0) {
              items = [...items, {
                id: 'mockup-virtual',
                texto: 'Solicitar Mockup do Aplicativo',
                feito: !!mockupRequest,
                feito_em: mockupRequest?.created_at || null,
                ator: 'cliente',
                obrigatorio: true,
                tipo: 'check',
              }];
            }
            const isFuture = selectedTimelineFase > cliente.fase_atual;
            const fase = fases.find((f: any) => f.numero === selectedTimelineFase);
            return (
              <motion.div
                key={selectedTimelineFase}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <Card className="bg-white/5 border-white/10 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{FASE_NAMES[selectedTimelineFase]}</h3>
                      {fase?.data_inicio && (
                        <p className="text-[10px] text-primary/70 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Iniciada em {format(new Date(fase.data_inicio), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                      {fase?.data_conclusao && (
                        <p className="text-[10px] text-green-400/70 mt-0.5">
                          ✅ Concluída em {format(new Date(fase.data_conclusao), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                    <button onClick={() => setSelectedTimelineFase(null)} className="text-white/40 hover:text-white text-xs">✕</button>
                  </div>
                  {items.length > 0 ? items.map((item: any) => {
                    const getFilledValue = (texto: string) => {
                      if (texto === CNPJ_TEXT && prereqs?.cnpj_tipo) return `Tipo: ${prereqs.cnpj_tipo.toUpperCase()}`;
                      if (texto === EMAIL_CORP_TEXT && prereqs?.email_corporativo) return prereqs.email_corporativo;
                      if (texto === SITE_TEXT && prereqs?.site_url) return prereqs.site_url;
                      if (texto === 'Solicitei o número DUNS da minha empresa' && prereqs?.duns_numero) return `DUNS: ${prereqs.duns_numero}`;
                      return null;
                    };
                    const filledValue = item.feito ? getFilledValue(item.texto) : null;
                    const isExpanded = expandedTimelineItem === item.id;

                    return (
                      <div key={item.id}>
                        <button
                          className="w-full flex items-center gap-2 text-xs py-1.5 hover:bg-white/5 rounded px-1 -mx-1 transition-colors"
                          onClick={() => {
                            if (item.id === 'mockup-virtual' && !item.feito) {
                              setShowMockupModal(true);
                            } else if (item.feito && filledValue) {
                              setExpandedTimelineItem(isExpanded ? null : item.id);
                            }
                          }}
                          disabled={item.id !== 'mockup-virtual' && (!item.feito || !filledValue)}
                        >
                          {(item.feito || fase?.status === 'concluida') ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-white/30 shrink-0" />}
                          <span className={`text-left flex-1 ${(item.feito || fase?.status === 'concluida') ? 'text-white/40 line-through' : 'text-white/70'}`}>{item.texto}</span>
                          {!(item.feito || fase?.status === 'concluida') && <Badge variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-white/30 ml-auto shrink-0">{item.ator}</Badge>}
                        </button>
                        {item.feito && item.feito_em && (
                          <p className="text-[10px] text-green-400/60 ml-5 mt-0.5">✅ Concluído em {format(new Date(item.feito_em), "dd/MM/yyyy 'às' HH:mm")}</p>
                        )}
                        {!item.feito && fase?.status === 'concluida' && fase?.data_conclusao && (
                          <p className="text-[10px] text-green-400/60 ml-5 mt-0.5">✅ Concluído em {format(new Date(fase.data_conclusao), "dd/MM/yyyy 'às' HH:mm")}</p>
                        )}
                        {item.ator === 'analista' && !item.feito && fase?.status !== 'concluida' && (
                          <p className="text-[10px] text-amber-400/60 ml-5 mt-0.5">⏳ O analista tem até 1 dia útil após o envio para verificar</p>
                        )}
                        <AnimatePresence>
                          {isExpanded && filledValue && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden ml-5"
                            >
                              <div className="rounded bg-white/5 border border-white/10 px-3 py-2 my-1 text-xs text-white/60">
                                <span className="text-white/40 text-[10px]">Preenchido:</span>
                                <p className="text-white/80 font-medium mt-0.5">{filledValue}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  }) : (
                    <div className="text-xs text-white/40 py-2 flex items-center gap-2">
                      {isFuture ? (
                        <>
                          <Lock className="h-3.5 w-3.5 shrink-0" />
                          <span>Etapa futura — você será notificado quando chegar aqui</span>
                        </>
                      ) : (
                        <span>Nenhum item cadastrado para esta etapa</span>
                      )}
                    </div>
                  )}
                  {/* Phase 2 — store validation visibility */}
                  {selectedTimelineFase === 2 && (() => {
                    const fase1 = fases.find((f: any) => f.numero === 1);
                    const fase1Done = fase1?.status === 'concluida';
                    const fase2 = fases.find((f: any) => f.numero === 2);
                    const isCurrent = cliente.fase_atual === 2;
                    const isDone = fase2?.status === 'concluida';
                    const baseDate = fase1Done && fase1?.data_conclusao ? new Date(fase1.data_conclusao) : null;
                    const startDate = fase2?.data_inicio ? new Date(fase2.data_inicio) : baseDate;
                    const showGoogle = cliente.plataforma !== 'apple';
                    const showApple = cliente.plataforma !== 'google';

                    return (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        {showGoogle && (
                          <div className={`rounded-lg p-3 ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <span className="text-xs font-medium">{isDone ? 'Google Play — Aprovado' : 'Google Play — Aguardando análise'}</span>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${isDone ? 'border-green-500/30 text-green-400' : 'border-blue-500/30 text-blue-400'}`}>
                                {isDone ? '✅ Aprovado' : '1–3 dias úteis'}
                              </Badge>
                            </div>
                            {!isDone && fase1Done && startDate && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-blue-400/70">📆 Previsão máxima: <span className="font-semibold">{format(addBusinessDays(startDate, 3), 'dd/MM/yyyy')}</span></p>
                                <Progress value={isCurrent ? 50 : 0} className="h-1" />
                              </div>
                            )}
                            {isDone && fase2?.data_conclusao && (
                              <p className="text-[10px] text-green-400/70 mt-2">✅ Concluído em {format(new Date(fase2.data_conclusao), "dd/MM/yyyy 'às' HH:mm")}</p>
                            )}
                          </div>
                        )}
                        {showApple && (
                          <div className={`rounded-lg p-3 ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🍎</span>
                                <span className="text-xs font-medium">{isDone ? 'App Store — Aprovado' : 'App Store — Aguardando análise'}</span>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${isDone ? 'border-green-500/30 text-green-400' : 'border-purple-500/30 text-purple-400'}`}>
                                {isDone ? '✅ Aprovado' : '5–7 dias úteis'}
                              </Badge>
                            </div>
                            {!isDone && fase1Done && startDate && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-purple-400/70">📆 Previsão máxima: <span className="font-semibold">{format(addBusinessDays(startDate, 7), 'dd/MM/yyyy')}</span></p>
                                <Progress value={isCurrent ? 30 : 0} className="h-1" />
                              </div>
                            )}
                            {isDone && fase2?.data_conclusao && (
                              <p className="text-[10px] text-green-400/70 mt-2">✅ Concluído em {format(new Date(fase2.data_conclusao), "dd/MM/yyyy 'às' HH:mm")}</p>
                            )}
                          </div>
                        )}
                        {!fase1Done && (
                          <div className="text-xs text-white/40 py-1 flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span>As datas de previsão serão calculadas após a conclusão dos "Primeiros Passos"</span>
                          </div>
                        )}
                        {isCurrent && (
                          <p className="text-[10px] text-white/30 text-center">⏳ Esta etapa depende exclusivamente da análise das lojas. Você será notificado assim que houver retorno.</p>
                        )}
                      </div>
                    );
                  })()}
                  {/* Phase 4 — store approval visibility */}
                  {selectedTimelineFase === 4 && (() => {
                    const fase3 = fases.find((f: any) => f.numero === 3);
                    const fase3Done = fase3?.status === 'concluida';
                    const fase4 = fases.find((f: any) => f.numero === 4);
                    const isCurrent = cliente.fase_atual === 4;
                    const isDone = fase4?.status === 'concluida';
                    const baseDate = fase3Done && fase3?.data_conclusao ? new Date(fase3.data_conclusao) : null;
                    const startDate = fase4?.data_inicio ? new Date(fase4.data_inicio) : baseDate;
                    const showGoogle = cliente.plataforma !== 'apple';
                    const showApple = cliente.plataforma !== 'google';

                    return (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        {showGoogle && (
                          <div className={`rounded-lg p-3 ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <span className="text-xs font-medium">{isDone ? 'Google Play — Aprovado' : 'Google Play — Aguardando aprovação'}</span>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${isDone ? 'border-green-500/30 text-green-400' : 'border-blue-500/30 text-blue-400'}`}>
                                {isDone ? '✅ Aprovado' : '2–4 dias úteis'}
                              </Badge>
                            </div>
                            {!isDone && fase3Done && startDate && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-blue-400/70">📆 Previsão máxima: <span className="font-semibold">{format(addBusinessDays(startDate, 4), 'dd/MM/yyyy')}</span></p>
                                <Progress value={isCurrent ? 50 : 0} className="h-1" />
                              </div>
                            )}
                          </div>
                        )}
                        {showApple && (
                          <div className={`rounded-lg p-3 ${isDone ? 'bg-green-500/10 border border-green-500/20' : 'bg-purple-500/10 border border-purple-500/20'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">🍎</span>
                                <span className="text-xs font-medium">{isDone ? 'App Store — Aprovado' : 'App Store — Aguardando aprovação'}</span>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${isDone ? 'border-green-500/30 text-green-400' : 'border-purple-500/30 text-purple-400'}`}>
                                {isDone ? '✅ Aprovado' : '5–10 dias úteis'}
                              </Badge>
                            </div>
                            {!isDone && fase3Done && startDate && (
                              <div className="mt-2 space-y-1">
                                <p className="text-[10px] text-purple-400/70">📆 Previsão máxima: <span className="font-semibold">{format(addBusinessDays(startDate, 10), 'dd/MM/yyyy')}</span></p>
                                <Progress value={isCurrent ? 30 : 0} className="h-1" />
                              </div>
                            )}
                          </div>
                        )}
                        {!fase3Done && (
                          <div className="text-xs text-white/40 py-1 flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            <span>As datas de previsão serão calculadas após a conclusão da "Criação e Submissão"</span>
                          </div>
                        )}
                        {isCurrent && (
                          <p className="text-[10px] text-white/30 text-center">⏳ Esta etapa depende exclusivamente da aprovação das lojas. Você será notificado assim que houver retorno.</p>
                        )}
                      </div>
                    );
                  })()}
                  {fase?.data_previsao && (
                    <p className="text-[10px] text-white/30 pt-1">📅 Previsão: {format(new Date(fase.data_previsao), 'dd/MM/yyyy')}</p>
                  )}
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {cliente.fase_atual < 6 && (
          <div className="flex items-center justify-between text-xs text-white/50 pt-1">
            <span>📍 {FASE_NAMES[cliente.fase_atual]}</span>
            {cliente.prazo_estimado && <span>🗓️ {format(new Date(cliente.prazo_estimado), 'dd/MM/yyyy')}</span>}
          </div>
        )}
      </motion.div>

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
      {((cliente.fase_atual < 6) || (cliente.fase_atual === 6 && !fase6Done)) && (
        <Card className="bg-[#1E293B] border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {cliente.fase_atual === 6
              ? '🚀 Publicação em andamento'
              : cliente.fase_atual === 3
              ? (formulario?.preenchido_completo ? '⏳ Nossa equipe está validando o formulário' : '📋 O que fazer agora')
              : hasClientAction ? '📋 O que fazer agora' : '⏳ Nossa equipe está trabalhando'}
          </h2>


          {cliente.fase_atual === 3 ? (
            <div className="space-y-4">
              {/* Sub-step 1: Formulário do aplicativo */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {formulario?.preenchido_completo
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <Circle className="h-4 w-4 text-white/30" />}
                  <h3 className="text-sm font-semibold">Formulário do aplicativo</h3>
                </div>

                {formulario?.preenchido_completo ? (
                  <div className="space-y-3">
                    <div className="rounded-lg p-4 bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-400">Formulário enviado!</p>
                        {formulario.enviado_em && (
                          <p className="text-[10px] text-green-400/50 mt-1">Enviado em {format(new Date(formulario.enviado_em), 'dd/MM/yyyy HH:mm')}</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-2">
                      <p className="text-xs font-semibold text-white/50">📝 Dados enviados</p>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-white/70">Nome:</span>
                          <span className="text-white/90 font-medium">{formulario.nome_app}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-white/70">Descrição curta:</span>
                          <span className="text-white/90 font-medium truncate">{formulario.descricao_curta}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          <span className="text-white/70">Política de privacidade:</span>
                          <span className="text-white/90 font-medium truncate">{formulario.url_privacidade}</span>
                        </div>
                        {formulario.descricao_longa && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="text-white/70">Descrição completa:</span>
                            <span className="text-white/90 font-medium">✅ Preenchida</span>
                          </div>
                        )}
                        {formulario.url_termos && (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="text-white/70">Termos de uso:</span>
                            <span className="text-white/90 font-medium truncate">{formulario.url_termos}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg bg-white/5 border border-white/10 p-4">
                    <p className="text-xs text-white/50 mb-2">Preencha as informações do seu aplicativo para as lojas.</p>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Obrigatórios *</p>
                    <div>
                      <Label className="text-white/70">Nome do aplicativo * <span className="text-[10px] text-white/40 font-normal">— nome que aparecerá nas lojas</span></Label>
                      <Input className="bg-white/5 border-white/10 text-white" value={formData.nome_app} onChange={e => setFormData(p => ({ ...p, nome_app: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-white/70">Descrição curta * <span className="text-[10px] text-white/40 font-normal">— máximo 80 caracteres ({formData.descricao_curta.length}/80)</span></Label>
                      <Input className="bg-white/5 border-white/10 text-white" value={formData.descricao_curta} maxLength={80} onChange={e => setFormData(p => ({ ...p, descricao_curta: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-white/70">URL Política de Privacidade * <span className="text-[10px] text-white/40 font-normal">— link para a página de privacidade</span></Label>
                      <Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_privacidade} onChange={e => setFormData(p => ({ ...p, url_privacidade: e.target.value }))} />
                    </div>
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider pt-2">Opcionais</p>
                    <div>
                      <Label className="text-white/70">Descrição completa <span className="text-[10px] text-white/40 font-normal">— máximo 4000 caracteres ({formData.descricao_longa.length}/4000)</span></Label>
                      <Textarea className="bg-white/5 border-white/10 text-white min-h-[120px]" value={formData.descricao_longa} maxLength={4000} onChange={e => setFormData(p => ({ ...p, descricao_longa: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-white/70">URL Termos de Uso <span className="text-[10px] text-white/40 font-normal">— link para a página de termos</span></Label>
                      <Input className="bg-white/5 border-white/10 text-white" placeholder="https://..." value={formData.url_termos} onChange={e => setFormData(p => ({ ...p, url_termos: e.target.value }))} />
                    </div>
                    <Button className="w-full" onClick={() => saveForm.mutate()} disabled={saveForm.isPending || !formData.nome_app || !formData.descricao_curta || !formData.url_privacidade}>
                      {saveForm.isPending ? 'Salvando...' : 'Enviar formulário'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Sub-step 2: Desenvolvimento e Submissão */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                {formulario?.preenchido_completo
                  ? <Clock className="h-4 w-4 text-amber-400" />
                  : <Lock className="h-4 w-4 text-white/20" />}
                <div>
                  <p className={`text-sm font-medium ${formulario?.preenchido_completo ? 'text-white/80' : 'text-white/30'}`}>
                    Desenvolvimento e Submissão do aplicativo pela Curseduca
                  </p>
                  <p className="text-[10px] text-white/40">
                    {formulario?.preenchido_completo
                      ? '⏳ A equipe Curseduca irá desenvolver e submeter o app nas lojas.'
                      : 'Preencha o formulário acima para liberar esta etapa'}
                  </p>
                </div>
              </div>
            </div>
          ) : hasClientAction ? (() => {
            const genericItems = currentItems.filter(i => !GOOGLE_TEXTS.includes(i.texto) && !APPLE_TEXTS.includes(i.texto));
            const googleItems = currentItems.filter(i => GOOGLE_TEXTS.includes(i.texto));
            const appleItems = currentItems.filter(i => APPLE_TEXTS.includes(i.texto));
            const hasBothPlatforms = googleItems.length > 0 && appleItems.length > 0;

            return (
              <div className="space-y-3">
                {genericItems.map(item => renderChecklistItem(item))}
                {hasBothPlatforms ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-white/50">🤖 Google</p>
                      {googleItems.map(item => renderChecklistItem(item))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-white/50">🍎 Apple</p>
                      {appleItems.map(item => renderChecklistItem(item))}
                    </div>
                  </div>
                ) : (
                  <>
                    {googleItems.map(item => renderChecklistItem(item))}
                    {appleItems.map(item => renderChecklistItem(item))}
                  </>
                )}
              </div>
            );
          })() : cliente.fase_atual === 2 ? (() => {
            const fase1 = fases.find((f: any) => f.numero === 1);
                    const fase2 = fases.find((f: any) => f.numero === 2);
                    const baseDate = fase1?.data_conclusao ? new Date(fase1.data_conclusao) : null;
                    const startDate = fase2?.data_inicio ? new Date(fase2.data_inicio) : baseDate;
                    const showGoogle = cliente.plataforma !== 'apple';
                    const showApple = cliente.plataforma !== 'google';

                    return (
                      <div className="space-y-3">
                <p className="text-sm text-white/60">Suas contas estão sendo analisadas pelas lojas. Este processo é automático e não requer ação sua.</p>
                {baseDate && (
                  <div className="rounded-lg p-3 bg-white/5 border border-white/10">
                    <p className="text-xs text-white/50">📅 Etapa "Primeiros Passos" concluída em: <span className="font-semibold text-white/80">{format(baseDate, 'dd/MM/yyyy')}</span></p>
                  </div>
                )}
                {showGoogle && (
                  <div className="rounded-lg p-4 bg-blue-500/10 border border-blue-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">🤖 Google Play</span>
                      <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">1–3 dias úteis</Badge>
                    </div>
                    {startDate && (
                      <div className="space-y-1">
                        <Progress value={(() => {
                          const elapsed = Math.floor((Date.now() - startDate.getTime()) / 86400000);
                          return Math.min(Math.round((elapsed / 3) * 100), 95);
                        })()} className="h-1.5" />
                        <div className="flex justify-between text-[10px] text-white/40">
                          <span>{format(startDate, 'dd/MM/yyyy')}</span>
                          <span>até {format(addBusinessDays(startDate, 3), 'dd/MM/yyyy')}</span>
                        </div>
                        <p className="text-xs text-blue-400/80 mt-1">📆 Previsão de conclusão: <span className="font-semibold">{format(addBusinessDays(startDate, 3), 'dd/MM/yyyy')}</span></p>
                      </div>
                    )}
                  </div>
                )}
                {showApple && (
                  <div className="rounded-lg p-4 bg-purple-500/10 border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">🍎 App Store</span>
                      <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">5–7 dias úteis</Badge>
                    </div>
                    {startDate && (
                      <div className="space-y-1">
                        <Progress value={(() => {
                          const elapsed = Math.floor((Date.now() - startDate.getTime()) / 86400000);
                          return Math.min(Math.round((elapsed / 7) * 100), 95);
                        })()} className="h-1.5" />
                        <div className="flex justify-between text-[10px] text-white/40">
                          <span>{format(startDate, 'dd/MM/yyyy')}</span>
                          <span>até {format(addBusinessDays(startDate, 7), 'dd/MM/yyyy')}</span>
                        </div>
                        <p className="text-xs text-purple-400/80 mt-1">📆 Previsão de conclusão: <span className="font-semibold">{format(addBusinessDays(startDate, 7), 'dd/MM/yyyy')}</span></p>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-white/30 text-center">⏳ Você será notificado assim que as lojas aprovarem suas contas.</p>
              </div>
            );
          })() : cliente.fase_atual === 6 ? (
            <div className="space-y-3">
              <div className="rounded-lg p-4 bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">Publicar na loja</p>
                </div>
                <p className="text-xs text-white/50">O analista está publicando seu aplicativo nas lojas oficiais. Você será notificado assim que estiver disponível!</p>
                <Progress value={50} className="h-1.5" />
              </div>
              <p className="text-[10px] text-white/30 text-center">⏳ Este é o último passo! Em breve seu app estará nas lojas.</p>
            </div>
          ) : cliente.fase_atual === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-white/60">Nossa equipe está processando suas informações. Enquanto isso, você pode solicitar o design do seu app.</p>
            </div>
          ) : (
            <div className="text-center py-4 text-white/50">
              <p>Você será notificado assim que precisarmos de você!</p>
            </div>
          )}
          {/* Mockup request subtask — shown in phase 0 */}
          {cliente.fase_atual === 0 && !mockupRequest && (
            <div className="border-t border-white/10 pt-4 mt-2">
              <Button
                variant="outline"
                className="w-full border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => setShowMockupModal(true)}
              >
                <Palette className="h-4 w-4 mr-2" /> Solicitar Mockup do Aplicativo
              </Button>
            </div>
          )}
          {cliente.fase_atual === 0 && mockupRequest && (
            <div className="border-t border-white/10 pt-3 mt-2">
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Mockup solicitado em {format(new Date(mockupRequest.created_at), 'dd/MM/yyyy')}</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Parallel Assets & Mockup Section */}
      {mockupRequests.length > 0 && (
        <Card className="bg-[#1E293B] border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" /> Validação de Design
          </h2>

          <div className="space-y-3">
            {mockupRequests.flatMap((req: any) =>
              (req.briefing_images || [])
                .filter((img: any) => img.image_type === 'app_mockup')
                .map((img: any) => {
                  const deliveries = img.briefing_deliveries || [];
                  const latestDelivery = deliveries.length > 0 ? deliveries[deliveries.length - 1] : null;
                  const assetName = img.observations || 'Mockup do App';

                  return (
                    <div key={img.id} className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-white/40" />
                          <span className="text-sm font-medium">{assetName}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${
                          img.status === 'completed' ? 'border-green-500/30 text-green-400' :
                          img.status === 'review' ? 'border-amber-500/30 text-amber-400' :
                          img.status === 'in_progress' ? 'border-blue-500/30 text-blue-400' :
                          'border-white/10 text-white/40'
                        }`}>
                          {img.status === 'completed' ? '✅ Concluído' :
                           img.status === 'review' ? '👁️ Aguardando aprovação' :
                           img.status === 'in_progress' ? '🎨 Em produção' :
                           '⏳ Pendente'}
                        </Badge>
                      </div>

                      {/* Show delivery preview when in review */}
                      {img.status === 'review' && latestDelivery && (
                        <div className="space-y-3">
                          <div className="rounded-lg overflow-hidden border border-white/10">
                            <img
                              src={latestDelivery.file_url}
                              alt={assetName}
                              className="w-full max-h-[200px] object-contain bg-black/30"
                            />
                          </div>

                          {reviewingImageId === img.id ? (
                            <div className="space-y-2">
                              <Label className="text-xs text-white/60">Descreva o ajuste necessário *</Label>
                              <Textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="Ex: A cor de fundo precisa ser mais escura..."
                                className="bg-white/5 border-white/10 text-white min-h-[60px]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  disabled={!reviewComment.trim()}
                                  onClick={async () => {
                                    try {
                                      await supabase.functions.invoke('delivery-data', {
                                        body: { action: 'update_status', image_id: img.id, status: 'in_progress', revision_count: (img.revision_count || 0) + 1 },
                                      });
                                      await supabase.from('briefing_reviews').insert({
                                        briefing_image_id: img.id,
                                        action: 'revision_requested',
                                        reviewed_by: cliente!.email,
                                        reviewer_comments: reviewComment,
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['portal-mockup-requests'] });
                                      setReviewingImageId(null);
                                      setReviewComment('');
                                      toast.success('Ajuste solicitado!');
                                    } catch (e: any) { toast.error(e.message); }
                                  }}
                                >
                                  Enviar ajuste
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setReviewingImageId(null); setReviewComment(''); }}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={async () => {
                                  try {
                                    await supabase.functions.invoke('delivery-data', {
                                      body: { action: 'update_status', image_id: img.id, status: 'completed' },
                                    });
                                    await supabase.from('briefing_reviews').insert({
                                      briefing_image_id: img.id,
                                      action: 'approved',
                                      reviewed_by: cliente!.email,
                                      reviewer_comments: null,
                                    });
                                    queryClient.invalidateQueries({ queryKey: ['portal-mockup-requests'] });
                                    toast.success('Arte aprovada! ✅');
                                  } catch (e: any) { toast.error(e.message); }
                                }}
                              >
                                ✅ Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-white/20"
                                onClick={() => setReviewingImageId(img.id)}
                              >
                                💬 Solicitar ajuste
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {img.status === 'completed' && latestDelivery && (
                        <div className="rounded-lg overflow-hidden border border-green-500/20">
                          <img
                            src={latestDelivery.file_url}
                            alt={assetName}
                            className="w-full max-h-[150px] object-contain bg-black/30 opacity-80"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* Show pending asset approvals (app_assets) */}
          {pendingAssets.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-sm font-medium text-amber-400">📋 Pendências de aprovação</p>
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
        </Card>
      )}


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
              <div>
                <Label className="text-xs text-white/60">Nome</Label>
                <Input value={cliente.nome} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-white/60">E-mail</Label>
                <Input value={cliente.email} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-white/60">Plataforma</Label>
                <Input value={cliente.empresa} disabled className="bg-white/5 border-white/10 text-white/70 mt-1" />
              </div>
              <Button className="w-full" onClick={() => setMockupStep(2)}>
                Próximo →
              </Button>
            </div>
          )}

          {mockupStep === 2 && (
            <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
              {/* Ícone do Aplicativo */}
              <div className="space-y-3 rounded-lg border border-white/10 p-4">
                <h3 className="text-sm font-semibold">📱 Ícone do Aplicativo</h3>
                <p className="text-xs text-white/60">Quer que o ícone do app seja sua logo?</p>
                <RadioGroup value={iconOption} onValueChange={(v: 'yes' | 'no') => setIconOption(v)} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="icon-yes" className="border-white/30" />
                    <Label htmlFor="icon-yes" className="text-sm cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="icon-no" className="border-white/30" />
                    <Label htmlFor="icon-no" className="text-sm cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
                {iconOption === 'yes' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-white/60">Envie a imagem da logo *</Label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIconLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-white/60 file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-3 file:py-1.5 file:text-xs file:text-primary hover:file:bg-primary/30 cursor-pointer"
                    />
                    {iconLogoFile && <p className="text-[10px] text-green-400">✓ {iconLogoFile.name}</p>}
                  </div>
                )}
                {iconOption === 'no' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-white/60">Descreva como deseja o ícone *</Label>
                    <Textarea
                      value={iconDescription}
                      onChange={(e) => setIconDescription(e.target.value)}
                      placeholder="Ex: Ícone minimalista com as iniciais da marca em azul..."
                      className="bg-white/5 border-white/10 text-white min-h-[80px]"
                    />
                  </div>
                )}
              </div>

              {/* Thumb */}
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox
                  id="want-thumb"
                  checked={wantThumb}
                  onCheckedChange={(v) => setWantThumb(!!v)}
                  className="mt-0.5 border-white/30"
                />
                <div>
                  <Label htmlFor="want-thumb" className="text-sm font-semibold cursor-pointer">🖼️ Thumb (1024x500)</Label>
                  <p className="text-xs text-white/50 mt-0.5">Imagem de destaque para a loja</p>
                </div>
              </div>

              {/* Screenshots Tablet */}
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox
                  id="want-tablet"
                  checked={wantScreenshotsTablet}
                  onCheckedChange={(v) => setWantScreenshotsTablet(!!v)}
                  className="mt-0.5 border-white/30"
                />
                <div>
                  <Label htmlFor="want-tablet" className="text-sm font-semibold cursor-pointer">📱 4 Screenshots Tablet (1024x1024)</Label>
                  <p className="text-xs text-white/50 mt-0.5">Capturas de tela para tablets</p>
                </div>
              </div>

              {/* Screenshots Celular */}
              <div className="flex items-start gap-3 rounded-lg border border-white/10 p-4">
                <Checkbox
                  id="want-celular"
                  checked={wantScreenshotsCelular}
                  onCheckedChange={(v) => setWantScreenshotsCelular(!!v)}
                  className="mt-0.5 border-white/30"
                />
                <div>
                  <Label htmlFor="want-celular" className="text-sm font-semibold cursor-pointer">📲 4 Screenshots Celular</Label>
                  <p className="text-xs text-white/50 mt-0.5">Capturas de tela para celulares</p>
                </div>
              </div>

              {/* Validation feedback */}
              {iconOption === 'yes' && !iconLogoFile && (
                <p className="text-xs text-amber-400">⚠️ Envie a logo para solicitar o ícone</p>
              )}
              {iconOption === 'no' && !iconDescription.trim() && (
                <p className="text-xs text-amber-400">⚠️ Descreva como deseja o ícone</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-white/10" onClick={() => setMockupStep(1)}>
                  ← Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    submitMockupRequest.isPending ||
                    (iconOption === 'yes' && !iconLogoFile) ||
                    (iconOption === 'no' && !iconDescription.trim()) ||
                    (!iconOption && !wantThumb && !wantScreenshotsTablet && !wantScreenshotsCelular)
                  }
                  onClick={() => submitMockupRequest.mutate()}
                >
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
