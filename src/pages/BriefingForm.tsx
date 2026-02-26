import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { BriefingFormData, defaultImageBriefing, ImageBriefingFormData } from '@/types/briefing';
import RequesterInfo from '@/components/briefing/RequesterInfo';
import ImageBriefingSection from '@/components/briefing/ImageBriefingSection';
import ProductCoversSection from '@/components/briefing/ProductCoversSection';
import BrandIdentity from '@/components/briefing/BrandIdentity';
import { CheckCircle, Loader2 } from 'lucide-react';

const initialForm: BriefingFormData = {
  requester_name: '',
  requester_email: '',
  platform_url: '',
  has_trail: false,
  has_challenge: false,
  has_community: false,
  brand_file: null,
  brand_drive_link: '',
  login_image: { ...defaultImageBriefing },
  banner_vitrine: { ...defaultImageBriefing },
  product_covers: [],
  trail_banner: { ...defaultImageBriefing },
  challenge_banner: { ...defaultImageBriefing },
  community_banner: { ...defaultImageBriefing },
};

export default function BriefingForm() {
  const [form, setForm] = useState<BriefingFormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (updates: Partial<BriefingFormData>) => setForm(prev => ({ ...prev, ...updates }));

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
    const { data: img, error } = await supabase.from('briefing_images').insert({
      request_id: requestId,
      image_type: type,
      sort_order: sortOrder,
      product_name: data.product_name || null,
      image_text: data.image_text || null,
      font_suggestion: data.font_suggestion || null,
      element_suggestion: data.element_suggestion || null,
      professional_photo_url: data.professional_photo_url || null,
      orientation: data.orientation || null,
      observations: data.observations || null,
    } as any).select('id').single();
    if (error) throw error;
    if (data.reference_images.length > 0 && img) {
      await uploadReferenceImages(data.reference_images, requestId, (img as any).id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.requester_name || !form.requester_email || !form.platform_url) {
      toast.error('Preencha todos os campos obrigatórios do solicitante');
      return;
    }

    const hasAnyImage = form.login_image.enabled || form.banner_vitrine.enabled ||
      form.product_covers.length > 0 ||
      (form.has_trail && form.trail_banner.enabled) ||
      (form.has_challenge && form.challenge_banner.enabled) ||
      (form.has_community && form.community_banner.enabled);

    if (!hasAnyImage) {
      toast.error('Selecione pelo menos um tipo de arte para solicitar');
      return;
    }

    setSubmitting(true);
    try {
      // Upload brand file if present
      let brandFileUrl: string | null = null;
      if (form.brand_file) {
        brandFileUrl = await uploadFile(form.brand_file, 'brand-files');
      }

      // Create request
      const { data: request, error } = await supabase.from('briefing_requests').insert({
        requester_name: form.requester_name,
        requester_email: form.requester_email,
        platform_url: form.platform_url,
        has_trail: form.has_trail,
        has_challenge: form.has_challenge,
        has_community: form.has_community,
        brand_file_url: brandFileUrl,
        brand_drive_link: form.brand_drive_link || null,
      } as any).select('id').single();

      if (error) throw error;
      const requestId = (request as any).id;

      let sortOrder = 0;

      // Insert each enabled image section
      if (form.login_image.enabled) {
        await insertImage(requestId, 'login', form.login_image, sortOrder++);
      }
      if (form.banner_vitrine.enabled) {
        await insertImage(requestId, 'banner_vitrine', form.banner_vitrine, sortOrder++);
      }
      for (const cover of form.product_covers) {
        await insertImage(requestId, 'product_cover', cover, sortOrder++);
      }
      if (form.has_trail && form.trail_banner.enabled) {
        await insertImage(requestId, 'trail_banner', form.trail_banner, sortOrder++);
      }
      if (form.has_challenge && form.challenge_banner.enabled) {
        await insertImage(requestId, 'challenge_banner', form.challenge_banner, sortOrder++);
      }
      if (form.has_community && form.community_banner.enabled) {
        await insertImage(requestId, 'community_banner', form.community_banner, sortOrder++);
      }

      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso!');
    } catch (err: any) {
      console.error('Error submitting briefing:', err);
      toast.error('Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold">Briefing Enviado!</h2>
            <p className="text-muted-foreground">
              Sua solicitação foi recebida. Nossa equipe de design entrará em contato em breve através do email informado.
            </p>
            <Button onClick={() => { setForm(initialForm); setSubmitted(false); }} variant="outline">
              Enviar novo briefing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Welcome Section */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '340px' }}>
        <img
          src="/images/bg-curseduca.png"
          alt="Curseduca escritório"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-16 min-h-[340px]">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 mb-6">
            <span className="text-white/90 text-sm font-medium tracking-wide">Plataforma Curseduca</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white drop-shadow-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Bem-vindo ao Briefing
          </h1>
          <p className="text-white/80 mt-3 text-lg max-w-xl leading-relaxed">
            Solicite as artes da sua área de membros de forma prática e organizada.
          </p>
          <p className="text-white/50 mt-2 text-sm">
            Preencha as seções abaixo com as informações do que você precisa.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 py-10 space-y-2">
        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardContent className="pt-6">
              <RequesterInfo data={form} onChange={update} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <BrandIdentity data={form} onChange={update} />
            </CardContent>
          </Card>

          <Separator />

          <ImageBriefingSection
            title="1. Imagem da Área de Login"
            description="Imagem onde o aluno insere email e senha para acessar a plataforma"
            data={form.login_image}
            onChange={d => update({ login_image: d })}
          />

          <ImageBriefingSection
            title="2. Banner da Vitrine Principal"
            description="Banner principal disponibilizado também na versão mobile"
            data={form.banner_vitrine}
            onChange={d => update({ banner_vitrine: d })}
          />

          <Separator />

          <ProductCoversSection
            covers={form.product_covers}
            onChange={covers => update({ product_covers: covers })}
          />

          {form.has_trail && (
            <>
              <Separator />
              <ImageBriefingSection
                title="Banner da Trilha"
                description="Imagem de capa para a trilha da plataforma"
                data={form.trail_banner}
                onChange={d => update({ trail_banner: d })}
              />
            </>
          )}

          {form.has_challenge && (
            <>
              <Separator />
              <ImageBriefingSection
                title="Banner do Desafio"
                description="Imagem de capa para o desafio da plataforma"
                data={form.challenge_banner}
                onChange={d => update({ challenge_banner: d })}
              />
            </>
          )}

          {form.has_community && (
            <>
              <Separator />
              <ImageBriefingSection
                title="Banner da Comunidade"
                description="Imagem de capa para a comunidade da plataforma"
                data={form.community_banner}
                onChange={d => update({ community_banner: d })}
              />
            </>
          )}

          <div className="text-center pt-4">
            <Button type="submit" size="lg" disabled={submitting} className="min-w-[200px]">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : 'Enviar Briefing'}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Você terá 3 ajustes de artes. O prazo de entrega será avaliado pela equipe.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
