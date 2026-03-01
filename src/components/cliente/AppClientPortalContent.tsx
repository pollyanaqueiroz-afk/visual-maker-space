import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  CheckCircle2, Circle, MessageSquare, Star, Lock, AlertTriangle,
  ExternalLink, Upload, Image as ImageIcon, Loader2, ChevronDown, ChevronUp,
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

const FASE_NAMES = ['Pré-Requisitos','Primeiros Passos','Validação pela Loja','Assets e Mockup','Formulário do App','Criação e Submissão','Aprovação das Lojas','Teste do App','Publicado 🎉'];

interface Props {
  clienteId: string;
}

export default function AppClientPortalContent({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [expandedFase, setExpandedFase] = useState<number | null>(null);
  const [assetComment, setAssetComment] = useState<Record<string, string>>({});
  const [assetCommenting, setAssetCommenting] = useState<string | null>(null);
  const [cnpjInput, setCnpjInput] = useState('');
  const [cnpjPromptId, setCnpjPromptId] = useState<string | null>(null);
  const [emailCorpInput, setEmailCorpInput] = useState('');
  const [emailCorpPromptId, setEmailCorpPromptId] = useState<string | null>(null);
  const [siteInput, setSiteInput] = useState('');
  const [sitePromptId, setSitePromptId] = useState<string | null>(null);

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

  const DUNS_TEXT = 'Solicitei o número DUNS da minha empresa';

  const currentItems = checklist.filter(i => {
    if (i.fase_numero !== cliente.fase_atual || i.ator !== 'cliente') return false;
    // Keep DUNS item visible even when done (to show estimated date)
    if (i.texto === DUNS_TEXT && i.feito) return true;
    if (i.feito) return false;
    if (cliente.plataforma === 'google' && i.texto === 'Confirmei que meu CNPJ é ME ou LTDA') return false;
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

    // Default: check type
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
            {renderSteps(item.texto, item.id)}
          </div>
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

          {hasClientAction && cliente.fase_atual === 1 && (() => {
            const criacao = cliente.data_criacao ? new Date(cliente.data_criacao) : null;
            const prazo = criacao ? new Date(criacao.getTime() + 2 * 24 * 3600000) : null;
            const isOverdue = prazo ? new Date() > prazo : false;
            return (
              <div className={`rounded-lg p-3 text-sm ${isOverdue ? 'bg-red-500/10 border border-red-500/30' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                <p className={`${isOverdue ? 'text-red-300' : 'text-blue-300'}`}>
                  Os 4 pontos abaixo são essenciais para que seu aplicativo fique pronto o quanto antes.
                  {prazo && (
                    <span className="font-semibold ml-1">
                      Prazo: {format(prazo, 'dd/MM/yyyy')}
                    </span>
                  )}
                </p>
                {isOverdue && (
                  <Badge className="mt-2 bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Pendência — prazo expirado
                  </Badge>
                )}
              </div>
            );
          })()}

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
