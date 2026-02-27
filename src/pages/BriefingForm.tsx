import { useState, useEffect } from 'react';
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
import { CheckCircle, Loader2, ArrowRight, ArrowLeft, Palette, MonitorSmartphone, Image, LayoutGrid, Route, Trophy, Users, Smartphone, PartyPopper } from 'lucide-react';
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

export default function BriefingForm() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<BriefingFormData>(initialForm);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selections, setSelections] = useState<ArtSelection>({
    login_image: false,
    banner_vitrine: false,
    product_covers: false,
    trail_banner: false,
    challenge_banner: false,
    community_banner: false,
    has_app: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('briefing-uploads').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('briefing-uploads').getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadReferenceImages = async (refs: ImageBriefingFormData['reference_images'], requestId: string, imageId: string) => {
    for (const ref of refs) {
      const url = await uploadFile(ref.file, `references/${requestId}`);
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
        const url = await uploadFile(file, `elements/${requestId}`);
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
    if (!form.requester_name || !form.requester_email || !form.platform_url) {
      toast.error('Preencha todos os campos obrigatórios do solicitante');
      setStep(2);
      return;
    }

    if (!form.brand_file && !form.brand_drive_link) {
      toast.error('Envie o arquivo de identidade visual ou informe o link do Google Drive');
      setStep(2);
      return;
    }

    if (selections.product_covers && form.product_covers.some(c => !c.orientation)) {
      toast.error('Selecione a orientação (horizontal/vertical) em todas as capas de produto');
      return;
    }

    setSubmitting(true);
    try {
      let brandFileUrl: string | null = null;
      if (form.brand_file) {
        brandFileUrl = await uploadFile(form.brand_file, 'brand-files');
      }

      const { data: request, error } = await supabase.from('briefing_requests').insert({
        requester_name: form.requester_name,
        requester_email: form.requester_email,
        platform_url: form.platform_url,
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

      if (selections.login_image) {
        for (const loginImg of form.login_image) {
          await insertImage(requestId, 'login', loginImg, sortOrder++);
        }
      }
      for (const banner of form.banner_vitrine) {
        await insertImage(requestId, 'banner_vitrine', banner, sortOrder++);
      }
      for (const cover of form.product_covers) {
        await insertImage(requestId, 'product_cover', cover, sortOrder++);
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

      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (err: any) {
      console.error('Error submitting briefing:', err);
      const msg = err?.message || 'Erro desconhecido';
      toast.error(`Erro ao enviar: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!form.requester_name || !form.requester_email || !form.platform_url)) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (step === 2 && !hasAnySelection) {
      toast.error('Selecione pelo menos um tipo de arte');
      return;
    }
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setStep(s => s - 1);
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
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {step === 1 && 'Passo 1 — Seus dados e identidade visual'}
                {step === 2 && 'Passo 2 — Escolha as artes'}
                {step === 3 && 'Passo 3 — Briefing das artes'}
              </h1>
              {/* Progress bar */}
              <div className="flex gap-2 mt-4">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'bg-white w-12' : 'bg-white/30 w-8'}`} />
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
