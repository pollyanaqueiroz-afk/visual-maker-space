import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BriefingFormData, defaultImageBriefing, ImageBriefingFormData } from '@/types/briefing';
import RequesterInfo from '@/components/briefing/RequesterInfo';
import ImageBriefingSection from '@/components/briefing/ImageBriefingSection';
import MultiBannerSection from '@/components/briefing/MultiBannerSection';
import BrandIdentity from '@/components/briefing/BrandIdentity';
import AIBriefingAssistant from '@/components/briefing/AIBriefingAssistant';
import { CheckCircle, Loader2, ArrowRight, ArrowLeft, Palette, MonitorSmartphone, Image, LayoutGrid, Route, Trophy, Users, Smartphone, PartyPopper, Home } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '@/hooks/useAuth';

type ArtSelection = {
  login_image: boolean;
  banner_vitrine: boolean;
  product_covers: boolean;
  trail_banner: boolean;
  challenge_banner: boolean;
  community_banner: boolean;
  has_app: boolean;
};

const ART_OPTIONS = [
  { key: 'login_image' as const, label: 'Imagem da Área de Login', desc: 'Tela onde o aluno insere email e senha', icon: MonitorSmartphone },
  { key: 'banner_vitrine' as const, label: 'Banners da Vitrine Principal', desc: 'Banners rotativos da página inicial', icon: Image },
  { key: 'product_covers' as const, label: 'Capas de Produto / Módulo', desc: 'Imagens de capa para cada produto', icon: LayoutGrid },
  { key: 'trail_banner' as const, label: 'Banner de Trilha', desc: 'Imagem de capa para trilhas', icon: Route },
  { key: 'challenge_banner' as const, label: 'Banner de Desafio', desc: 'Imagem de capa para desafios', icon: Trophy },
  { key: 'community_banner' as const, label: 'Banner de Comunidade', desc: 'Imagem de capa para a comunidade', icon: Users },
];

const initialForm: BriefingFormData = {
  requester_name: '',
  requester_email: '',
  platform_url: '',
  has_trail: false,
  has_challenge: false,
  has_community: false,
  brand_file: null,
  brand_drive_link: '',
  login_image: [],
  banner_vitrine: [],
  product_covers: [],
  trail_banner: { ...defaultImageBriefing },
  challenge_banner: { ...defaultImageBriefing },
  community_banner: { ...defaultImageBriefing },
};

interface BriefingFormProps {
  mockupOnly?: boolean;
}

export default function BriefingForm({ mockupOnly = false }: BriefingFormProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(mockupOnly ? 1 : 0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [form, setForm] = useState<BriefingFormData>(initialForm);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selections, setSelections] = useState<ArtSelection>({
    login_image: false,
    banner_vitrine: false,
    product_covers: false,
    trail_banner: false,
    challenge_banner: false,
    community_banner: false,
    has_app: mockupOnly,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Warn before leaving with data
  useEffect(() => {
    const hasData = form.platform_url || form.requester_name || form.requester_email;
    if (!hasData) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [form.platform_url, form.requester_name, form.requester_email]);

  // Auto-fill requester info from logged-in user
  useEffect(() => {
    if (user) {
      const meta = user.user_metadata;
      update({
        requester_email: user.email || '',
        requester_name: meta?.full_name || meta?.name || '',
      });
    }
  }, [user]);

  const update = (updates: Partial<BriefingFormData>) => setForm(prev => ({ ...prev, ...updates }));
  const toggleSelection = (key: keyof ArtSelection) => setSelections(prev => ({ ...prev, [key]: !prev[key] }));

  const getRequesterInputValue = (inputId: string) => {
    if (typeof document === 'undefined') return '';
    return (document.getElementById(inputId) as HTMLInputElement | null)?.value?.trim() || '';
  };

  const resolveRequesterFields = () => {
    const requester_name = form.requester_name.trim() || getRequesterInputValue('name');
    const requester_email = form.requester_email.trim() || getRequesterInputValue('email');
    const platform_url = form.platform_url.trim() || getRequesterInputValue('url');

    if (
      requester_name !== form.requester_name ||
      requester_email !== form.requester_email ||
      platform_url !== form.platform_url
    ) {
      setForm(prev => ({ ...prev, requester_name, requester_email, platform_url }));
    }

    return { requester_name, requester_email, platform_url };
  };

  const handleApplySuggestion = (suggestion: any) => {
    if (suggestion.selections) {
      setSelections(prev => ({ ...prev, ...suggestion.selections }));
    }

    const newForm = { ...form };

    if (suggestion.images?.login_image) {
      const items = Array.isArray(suggestion.images.login_image) ? suggestion.images.login_image : [suggestion.images.login_image];
      newForm.login_image = items.map((s: any) => ({
        ...defaultImageBriefing,
        enabled: true,
        image_text: s.image_text || '',
        font_suggestion: s.font_suggestion || '',
        element_suggestion: s.element_suggestion || '',
        observations: s.observations || '',
        dimension: s.dimension || '',
      }));
    }

    if (suggestion.images?.banner_vitrine) {
      const items = Array.isArray(suggestion.images.banner_vitrine) ? suggestion.images.banner_vitrine : [suggestion.images.banner_vitrine];
      newForm.banner_vitrine = items.map((s: any) => ({
        ...defaultImageBriefing,
        enabled: true,
        image_text: s.image_text || '',
        font_suggestion: s.font_suggestion || '',
        element_suggestion: s.element_suggestion || '',
        observations: s.observations || '',
        dimension: s.dimension || '1920x400',
      }));
    }

    if (suggestion.images?.product_covers) {
      const items = Array.isArray(suggestion.images.product_covers) ? suggestion.images.product_covers : [suggestion.images.product_covers];
      newForm.product_covers = items.map((s: any) => ({
        ...defaultImageBriefing,
        enabled: true,
        product_name: s.product_name || '',
        image_text: s.image_text || '',
        font_suggestion: s.font_suggestion || '',
        element_suggestion: s.element_suggestion || '',
        orientation: s.orientation || '',
        observations: s.observations || '',
        dimension: s.dimension || '800x600',
      }));
    }

    ['trail_banner', 'challenge_banner', 'community_banner'].forEach(key => {
      if (suggestion.images?.[key]) {
        const s = suggestion.images[key];
        (newForm as any)[key] = {
          ...defaultImageBriefing,
          enabled: true,
          image_text: s.image_text || '',
          font_suggestion: s.font_suggestion || '',
          element_suggestion: s.element_suggestion || '',
          observations: s.observations || '',
          dimension: s.dimension || '',
        };
      }
    });

    setForm(newForm);
    toast.success('Sugestão da IA aplicada! Revise e ajuste os campos antes de enviar.');
  };

  const hasAnySelection = Object.values(selections).some(Boolean);

  const MAX_FILE_SIZE = 1024 * 1024 * 1024 * 1024; // 1TB (sem limite prático no client)
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'];
  const ALLOWED_BRAND_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'application/postscript', 'image/vnd.adobe.photoshop', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

  const validateFile = (file: File, allowedTypes?: string[]) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`O arquivo "${file.name}" excede o tamanho máximo de 20MB (tamanho: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
    }
    if (allowedTypes && allowedTypes.length > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'pdf', 'ai', 'psd', 'zip'];
      if (!allowedTypes.includes(file.type) && !validExtensions.includes(ext)) {
        throw new Error(`O arquivo "${file.name}" possui formato não suportado (.${ext}). Formatos aceitos: JPG, PNG, GIF, WEBP, SVG, PDF, AI, PSD, ZIP`);
      }
    }
  };

  const sanitizeFileName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  };

  const uploadFile = async (file: File, folder: string, allowedTypes?: string[]): Promise<string> => {
    validateFile(file, allowedTypes);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const safeName = sanitizeFileName(file.name);
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;
    const { error } = await supabase.storage.from('briefing-uploads').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
    });
    if (error) {
      if (error.message?.includes('Payload too large') || error.message?.includes('413')) {
        throw new Error(`O arquivo "${file.name}" é muito grande para upload. Tente comprimir ou reduzir o tamanho.`);
      }
      if (error.message?.includes('mime') || error.message?.includes('type')) {
        throw new Error(`O formato do arquivo "${file.name}" não é permitido pelo servidor.`);
      }
      throw new Error(`Erro ao enviar "${file.name}": ${error.message}`);
    }
    const { data } = supabase.storage.from('briefing-uploads').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadReferenceImages = async (refs: ImageBriefingFormData['reference_images'], requestId: string, imageId: string) => {
    for (const ref of refs) {
      const url = await uploadFile(ref.file, `references/${requestId}`, ALLOWED_IMAGE_TYPES);
      await supabase.from('briefing_reference_images').insert({
        briefing_image_id: imageId,
        file_url: url,
        is_exact_use: ref.is_exact_use,
      } as any);
    }
  };

  const insertImage = async (requestId: string, type: string, data: ImageBriefingFormData, sortOrder: number) => {
    let elementSuggestion = data.element_suggestion || '';
    const elementImageUrls: string[] = [];
    if (data.element_suggestion_images && data.element_suggestion_images.length > 0) {
      for (const file of data.element_suggestion_images) {
        const url = await uploadFile(file, `elements/${requestId}`, ALLOWED_IMAGE_TYPES);
        elementImageUrls.push(url);
      }
    }
    if (data.element_suggestion_url) {
      elementImageUrls.push(data.element_suggestion_url);
    }
    if (elementImageUrls.length > 0) {
      elementSuggestion += (elementSuggestion ? '\n\n' : '') + 'Links/Imagens:\n' + elementImageUrls.join('\n');
    }

    const { data: img, error } = await supabase.from('briefing_images').insert({
      request_id: requestId,
      image_type: type,
      sort_order: sortOrder,
      product_name: data.product_name || null,
      image_text: data.image_text || null,
      font_suggestion: data.font_suggestion || null,
      element_suggestion: elementSuggestion || null,
      professional_photo_url: data.professional_photo_url || null,
      orientation: data.orientation || null,
      observations: [
        data.dimension && data.dimension !== 'custom' ? `Dimensão: ${data.dimension}` : null,
        data.dimension === 'custom' && data.custom_dimension ? `Dimensão: ${data.custom_dimension}` : null,
        data.observations || null,
      ].filter(Boolean).join('\n') || null,
    } as any).select('id').single();
    if (error) throw error;
    if (data.reference_images.length > 0 && img) {
      await uploadReferenceImages(data.reference_images, requestId, (img as any).id);
    }
  };

  const handleSubmit = async () => {
    const requester = resolveRequesterFields();

    // Specific field validation
    const missingFields: string[] = [];
    if (!requester.requester_name) missingFields.push('Nome completo');
    if (!requester.requester_email) missingFields.push('Email');
    if (!requester.platform_url) missingFields.push('URL da Plataforma');

    if (missingFields.length > 0) {
      toast.error(`Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`, {
        description: 'Volte ao Passo 1 para completar seus dados.',
        duration: 6000,
      });
      setStep(1);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requester.requester_email)) {
      toast.error('O email informado é inválido', {
        description: `"${requester.requester_email}" não é um formato de email válido.`,
        duration: 5000,
      });
      setStep(1);
      return;
    }

    if (!mockupOnly && !form.brand_file && !form.brand_drive_link) {
      toast.error('Identidade visual não enviada', {
        description: 'Envie o arquivo de identidade visual ou informe o link do Google Drive no Passo 1.',
        duration: 6000,
      });
      setStep(1);
      return;
    }

    if (selections.product_covers) {
      const coversWithoutOrientation = form.product_covers
        .map((c, i) => (!c.orientation ? `Capa ${i + 1}` : null))
        .filter(Boolean);
      if (coversWithoutOrientation.length > 0) {
        toast.error('Orientação não selecionada', {
          description: `Selecione a orientação (horizontal/vertical) em: ${coversWithoutOrientation.join(', ')}`,
          duration: 6000,
        });
        return;
      }
    }

    if (selections.product_covers) {
      const coversWithoutName = form.product_covers
        .map((c, i) => (!c.product_name ? `Capa ${i + 1}` : null))
        .filter(Boolean);
      if (coversWithoutName.length > 0) {
        toast.error('Nome do produto não preenchido', {
          description: `Informe o nome do produto/módulo em: ${coversWithoutName.join(', ')}`,
          duration: 6000,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let brandFileUrl: string | null = null;
      if (form.brand_file) {
        brandFileUrl = await uploadFile(form.brand_file, 'brand-files', ALLOWED_BRAND_TYPES);
      }

      const { data: request, error } = await supabase.from('briefing_requests').insert({
        requester_name: requester.requester_name,
        requester_email: requester.requester_email,
        platform_url: requester.platform_url,
        has_trail: selections.trail_banner,
        has_challenge: selections.challenge_banner,
        has_community: selections.community_banner,
        brand_file_url: brandFileUrl,
        brand_drive_link: form.brand_drive_link || null,
        additional_info: additionalInfo || null,
        submitted_by: user?.email || null,
      } as any).select('id').single();

      if (error) throw error;
      const requestId = (request as any).id;

      let sortOrder = 0;

      try {
        if (selections.login_image) {
          for (const loginImg of form.login_image) {
            await insertImage(requestId, 'login', loginImg, sortOrder++);
          }
        }
        if (selections.banner_vitrine) {
          for (const banner of form.banner_vitrine) {
            await insertImage(requestId, 'banner_vitrine', banner, sortOrder++);
          }
        }
        if (selections.product_covers) {
          for (const cover of form.product_covers) {
            await insertImage(requestId, 'product_cover', cover, sortOrder++);
          }
        }
        if (selections.trail_banner && form.trail_banner.enabled) {
          await insertImage(requestId, 'trail_banner', form.trail_banner, sortOrder++);
        }
        if (selections.challenge_banner && form.challenge_banner.enabled) {
          await insertImage(requestId, 'challenge_banner', form.challenge_banner, sortOrder++);
        }
        if (selections.community_banner && form.community_banner.enabled) {
          await insertImage(requestId, 'community_banner', form.community_banner, sortOrder++);
        }

        // Auto-create app mockup if has_app
        if (selections.has_app) {
          const { error: mockupErr } = await supabase.from('briefing_images').insert({
            request_id: requestId,
            image_type: 'app_mockup',
            sort_order: sortOrder++,
            observations: 'Mockup do aplicativo — criado automaticamente',
          } as any);
          if (mockupErr) console.error('Erro ao criar mockup:', mockupErr);
        }
      } catch (err: any) {
        // Cleanup request
        await supabase.from('briefing_requests').delete().eq('id', requestId);
        // Cleanup brand file from storage if uploaded
        if (brandFileUrl) {
          try {
            const path = brandFileUrl.split('/briefing-uploads/')[1];
            if (path) {
              await supabase.storage.from('briefing-uploads').remove([decodeURIComponent(path)]);
            }
          } catch (cleanupErr) {
            console.error('Failed to cleanup brand file:', cleanupErr);
          }
        }
        throw err;
      }

      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (err: any) {
      console.error('Error submitting briefing:', err);
      const msg = err?.message || 'Erro desconhecido';
      if (msg.includes('tamanho') || msg.includes('grande') || msg.includes('Payload')) {
        toast.error('Arquivo muito grande', { description: msg, duration: 8000 });
      } else if (msg.includes('formato') || msg.includes('suportado') || msg.includes('mime')) {
        toast.error('Formato de arquivo não suportado', { description: msg, duration: 8000 });
      } else if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch')) {
        toast.error('Erro de conexão', { description: 'Verifique sua internet e tente novamente.', duration: 6000 });
      } else {
        toast.error(`Erro ao enviar briefing`, { description: msg, duration: 6000 });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      const requester = resolveRequesterFields();
      const missingFields: string[] = [];
      if (!requester.requester_name) missingFields.push('Nome completo');
      if (!requester.requester_email) missingFields.push('Email');
      if (!requester.platform_url) missingFields.push('URL da Plataforma');
      
      if (missingFields.length > 0) {
        toast.error(`Campos obrigatórios não preenchidos: ${missingFields.join(', ')}`);
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(requester.requester_email)) {
        toast.error('O email informado é inválido', {
          description: `"${requester.requester_email}" não é um formato de email válido.`,
        });
        return;
      }
    }
    if (step === 2 && !hasAnySelection) {
      toast.error('Nenhuma arte selecionada', {
        description: 'Selecione pelo menos um tipo de arte para continuar.',
      });
      return;
    }
    setSlideDir(1);
    if (mockupOnly && step === 1) {
      setStep(3);
    } else {
      setStep(s => s + 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setSlideDir(-1);
    if (mockupOnly && step === 3) {
      setStep(1);
    } else {
      setStep(s => s - 1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const TOTAL_STEPS = 3;

  // Fire confetti on success
  useEffect(() => {
    if (submitted) {
      const duration = 2000;
      const end = Date.now() + duration;
      const colors = ['#10b981', '#34d399', '#6ee7b7', '#ffffff', '#a7f3d0'];

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors,
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [submitted]);

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        {/* Curseduca hero header */}
        <div className="relative w-full overflow-hidden" style={{ minHeight: '100vh' }}>
          <img
            src="/images/bg-curseduca.png"
            alt="Curseduca"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 min-h-screen">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 mb-6">
              <Palette className="h-4 w-4 text-white/80" />
              <span className="text-white/90 text-sm font-medium tracking-wide">Plataforma Curseduca</span>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 max-w-md w-full space-y-5">
              <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 flex items-center justify-center">
                <PartyPopper className="h-10 w-10 text-emerald-300" />
              </div>
              <h2
                className="text-3xl font-extrabold text-white drop-shadow-lg"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Briefing Enviado!
              </h2>
              <p className="text-white/70 leading-relaxed">
                Sua solicitação foi recebida com sucesso. Nossa equipe de design entrará em contato em breve através do email informado.
              </p>
              <div className="pt-2">
                <Button
                  onClick={() => {
                    setForm(initialForm);
                    setAdditionalInfo('');
                    setSubmitted(false);
                    setStep(0);
                    setSelections({ login_image: false, banner_vitrine: false, product_covers: false, trail_banner: false, challenge_banner: false, community_banner: false, has_app: false });
                  }}
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  Enviar novo briefing
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: step === 0 ? '100vh' : '200px' }}>
        <img
          src="/images/bg-curseduca.png"
          alt="Curseduca escritório"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        <div className={`relative z-10 flex flex-col items-center justify-center text-center px-4 transition-all duration-500 ${step === 0 ? 'py-24 min-h-screen' : 'py-10 min-h-[200px]'}`}>
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 mb-6">
            <Palette className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm font-medium tracking-wide">Plataforma Curseduca</span>
          </div>
          {step === 0 ? (
            <>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white drop-shadow-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Solicitação de Design
              </h1>
              <p className="text-white/80 mt-4 text-lg max-w-xl leading-relaxed">
                Solicite as artes da sua área de membros de forma prática e organizada em poucos passos.
              </p>
              <div className="flex flex-col items-center gap-3 mt-8">
                <div className="flex items-center gap-3 text-white/60 text-sm">
                  <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs flex items-center justify-center font-bold">1</span> Seus dados</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs flex items-center justify-center font-bold">2</span> Escolha as artes</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="flex items-center gap-1.5"><span className="w-6 h-6 rounded-full bg-white/20 text-white text-xs flex items-center justify-center font-bold">3</span> Briefing</span>
                </div>
                <Button onClick={nextStep} size="lg" className="mt-4 min-w-[220px] text-base">
                  Começar <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/cliente')}
                  className="text-white/60 hover:text-white hover:bg-white/10 gap-2"
                >
                  <Home className="h-4 w-4" /> Voltar ao Portal
                </Button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {step === 1 && 'Passo 1 — Seus dados e identidade visual'}
                {step === 2 && 'Passo 2 — Escolha as artes'}
                {step === 3 && 'Passo 3 — Briefing das artes'}
              </h1>
              {/* Animated step indicator */}
              <div className="flex gap-2 mt-4">
                {[1, 2, 3].map(s => (
                  <motion.div
                    key={s}
                    className={`h-1.5 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`}
                    animate={{ width: s <= step ? 48 : 32 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {step > 0 && (
        <div className={`mx-auto p-4 py-10 ${step === 3 ? 'max-w-5xl' : 'max-w-3xl'}`}>

          {/* STEP 1: Requester + Brand */}
          {step === 1 && (
            <div className="space-y-8">
              <Card>
                <CardContent className="pt-6">
                  <RequesterInfo data={form} onChange={update} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <BrandIdentity data={form} onChange={update} showRequired={!form.brand_file && !form.brand_drive_link} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 2: Select art types */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-foreground">Quais artes você precisa?</h2>
                <p className="text-sm text-muted-foreground mt-1">Selecione todos os tipos de arte que deseja solicitar</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {ART_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const checked = selections[opt.key];
                  return (
                    <Card
                      key={opt.key}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${checked ? 'ring-2 ring-primary bg-primary/5 border-primary/30' : 'border-border/50 hover:border-border'}`}
                      onClick={() => toggleSelection(opt.key)}
                    >
                      <CardContent className="flex items-start gap-4 p-4">
                        <div className={`p-2.5 rounded-lg transition-colors ${checked ? 'bg-primary/10' : 'bg-muted'}`}>
                          <Icon className={`h-5 w-5 ${checked ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{opt.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                        </div>
                        <Checkbox checked={checked} className="mt-1" />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Has App toggle */}
              <Separator />
              <Card
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${selections.has_app ? 'ring-2 ring-primary bg-primary/5 border-primary/30' : 'border-border/50 hover:border-border'}`}
                onClick={() => setSelections(s => ({ ...s, has_app: !s.has_app }))}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`p-2.5 rounded-lg transition-colors ${selections.has_app ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Smartphone className={`h-5 w-5 ${selections.has_app ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">A plataforma possui aplicativo?</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Se sim, será criada automaticamente uma solicitação de mockup do aplicativo
                    </p>
                  </div>
                  <Checkbox checked={selections.has_app} className="mt-1" />
                </CardContent>
              </Card>

            </div>
          )}

          {/* STEP 3: Briefings */}
          {step === 3 && (
            <div className="space-y-6">
              {/* AI Assistant - mobile */}
              <div className="md:hidden">
                <AIBriefingAssistant
                  onApply={handleApplySuggestion}
                  currentForm={{ ...form, selections }}
                />
              </div>

              <div className="flex gap-6 items-start">
              {/* Main form column */}
              <div className="flex-1 min-w-0 space-y-8">
              {/* Additional info field */}
              <Card className="border-border/50">
                <CardContent className="pt-6 space-y-3">
                  <Label className="text-lg font-semibold">Informações adicionais sobre o projeto</Label>
                  <p className="text-sm text-muted-foreground">
                    Conte-nos mais sobre o contexto do projeto: público-alvo, tom de comunicação, cores da marca, estilo desejado, ou qualquer outra informação que ajude o designer.
                  </p>
                  <Textarea
                    value={additionalInfo}
                    onChange={e => setAdditionalInfo(e.target.value)}
                    placeholder="Ex: Nosso público é jovem, entre 18-30 anos. Preferimos cores vibrantes como laranja e azul. O tom deve ser motivacional e moderno..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              {selections.login_image && (
                <MultiBannerSection
                  title="Imagens da Área de Login"
                  description="Imagem onde o aluno insere email e senha para acessar a plataforma"
                  itemLabel="Imagem de Login"
                  items={form.login_image}
                  onChange={items => update({ login_image: items })}
                />
              )}

              {selections.banner_vitrine && (
                <MultiBannerSection
                  title="Banners da Vitrine Principal"
                  description="Banner principal disponibilizado também na versão mobile"
                  itemLabel="Banner"
                  items={form.banner_vitrine}
                  onChange={items => update({ banner_vitrine: items })}
                />
              )}

              {selections.product_covers && (
                <>
                  {(selections.login_image || selections.banner_vitrine) && <Separator />}
                  <MultiBannerSection
                    title="Capas de Produto / Módulo"
                    description="Imagem que ficará visível na vitrine"
                    itemLabel="Capa"
                    items={form.product_covers}
                    onChange={items => update({ product_covers: items })}
                    showOrientation
                    showProductName
                  />
                </>
              )}

              {selections.trail_banner && (
                <>
                  <Separator />
                  <ImageBriefingSection
                    title="Banner da Trilha"
                    description="Imagem de capa para a trilha da plataforma"
                    data={form.trail_banner}
                    onChange={d => update({ trail_banner: d })}
                    required
                  />
                </>
              )}

              {selections.challenge_banner && (
                <>
                  <Separator />
                  <ImageBriefingSection
                    title="Banner do Desafio"
                    description="Imagem de capa para o desafio da plataforma"
                    data={form.challenge_banner}
                    onChange={d => update({ challenge_banner: d })}
                    required
                  />
                </>
              )}

              {selections.community_banner && (
                <>
                  <Separator />
                  <ImageBriefingSection
                    title="Banner da Comunidade"
                    description="Imagem de capa para a comunidade da plataforma"
                    data={form.community_banner}
                    onChange={d => update({ community_banner: d })}
                    required
                  />
                </>
              )}

              <div className="text-center pt-4">
                <Button type="button" size="lg" disabled={submitting} className="min-w-[220px]" onClick={handleSubmit}>
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar Briefing'}
                </Button>
                <p className="text-xs text-muted-foreground mt-3">
                  Você terá 3 ajustes de artes. O prazo de entrega será avaliado pela equipe.
                </p>
              </div>
              </div>

              {/* AI Assistant sidebar - desktop */}
              <div className="hidden md:flex md:flex-col w-72 lg:w-80 shrink-0 sticky top-6 border-l border-border/50 pl-6">
                <AIBriefingAssistant
                  onApply={handleApplySuggestion}
                  currentForm={{ ...form, selections }}
                />
              </div>
            </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={prevStep} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            {step < TOTAL_STEPS && (
              <Button type="button" onClick={nextStep} className="gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
