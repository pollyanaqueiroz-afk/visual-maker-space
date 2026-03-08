import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Upload, FileImage, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import CursEducaLayout from '@/components/CursEducaLayout';

const IMAGE_TYPE_LABELS: Record<string, string> = {
  login: 'Área de Login',
  banner_vitrine: 'Banner Vitrine Principal',
  product_cover: 'Capa de Produto',
  trail_banner: 'Banner de Trilha',
  challenge_banner: 'Banner de Desafio',
  community_banner: 'Banner de Comunidade',
};

interface BriefingImage {
  id: string;
  image_type: string;
  product_name: string | null;
  image_text: string | null;
  deadline: string | null;
  assigned_email: string | null;
  status: string;
  observations: string | null;
  orientation: string | null;
  font_suggestion: string | null;
  element_suggestion: string | null;
  professional_photo_url: string | null;
  extra_info: string | null;
  briefing_requests: {
    requester_name: string;
    platform_url: string;
  };
}

export default function DeliveryPage() {
  const { token } = useParams<{ token: string }>();
  const [image, setImage] = useState<BriefingImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }

      const { data: result, error } = await supabase.functions.invoke('delivery-data', {
        body: { action: 'fetch', token },
      });

      if (error || !result?.data) {
        setNotFound(true);
      } else {
        setImage(result.data as any);
        if (result.data.assigned_email) setEmail(result.data.assigned_email);
      }
      setLoading(false);
    };
    fetchImage();
  }, [token]);

  const handleSubmit = async () => {
    if (!file || !email || !image) {
      toast.error('Preencha o email e selecione um arquivo');
      return;
    }

    // Validate email matches assigned designer
    if (image.assigned_email && email.toLowerCase() !== image.assigned_email.toLowerCase()) {
      toast.error(`Este briefing foi atribuído para ${image.assigned_email}. Use o email correto para entregar.`);
      return;
    }

    setSubmitting(true);
    try {
      // Upload file
      const ext = file.name.split('.').pop();
      const filePath = `deliveries/${image.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('briefing-uploads')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('briefing-uploads')
        .getPublicUrl(filePath);

      // Save delivery and update status via edge function
      const { data: submitResult, error: submitErr } = await supabase.functions.invoke('delivery-data', {
        body: {
          action: 'submit',
          image_id: image.id,
          file_url: urlData.publicUrl,
          comments: comments || null,
          delivered_by_email: email,
        },
      });

      if (submitErr) throw submitErr;
      if (submitResult?.error) throw new Error(submitResult.error);

      // Notify requester via email (fire-and-forget)
      supabase.functions.invoke('notify-delivery', {
        body: {
          image_id: image.id,
          file_url: urlData.publicUrl,
          delivered_by_email: email,
          comments: comments || null,
          app_url: window.location.origin,
        },
      }).catch(err => console.error('Notify error:', err));

      setDelivered(true);
      toast.success('Arte entregue com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao entregar arte: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CursEducaLayout title="Entrega de Arte" subtitle="Carregando...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CursEducaLayout>
    );
  }

  if (notFound) {
    return (
      <CursEducaLayout title="Link Inválido">
        <div className="flex justify-center px-4 py-12">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <FileImage className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Link inválido</h2>
              <p className="text-muted-foreground">Este link de entrega não foi encontrado ou já expirou.</p>
            </CardContent>
          </Card>
        </div>
      </CursEducaLayout>
    );
  }

  if (delivered) {
    return (
      <CursEducaLayout title="Arte Entregue!">
        <div className="flex justify-center px-4 py-12">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">Arte entregue!</h2>
              <p className="text-muted-foreground">Sua entrega foi registrada com sucesso. O solicitante será notificado.</p>
            </CardContent>
          </Card>
        </div>
      </CursEducaLayout>
    );
  }

  return (
    <CursEducaLayout title="Entrega de Arte" subtitle="Curseduca Design">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        {/* Briefing summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileImage className="h-5 w-5 text-primary" />
              Resumo do Briefing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Tipo de Arte</span>
                <p className="font-medium">{IMAGE_TYPE_LABELS[image!.image_type] || image!.image_type}</p>
              </div>
              {image!.product_name && (
                <div>
                  <span className="text-muted-foreground">Produto</span>
                  <p className="font-medium">{image!.product_name}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Solicitante</span>
                <p className="font-medium">{image!.briefing_requests.requester_name}</p>
              </div>
              {image!.deadline && (
                <div>
                  <span className="text-muted-foreground">Prazo</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-warning" />
                    <p className="font-medium">{new Date(image!.deadline).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
              )}
            </div>
            {image!.observations && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Observações</span>
                  <p>{image!.observations}</p>
                </div>
              </>
            )}
            <Badge variant="secondary" className="mt-2">
              Status: {image!.status === 'review' ? 'Em Validação' : image!.status === 'in_progress' ? 'Em Execução' : image!.status === 'completed' ? 'Aprovada' : image!.status === 'pending' ? 'Solicitada' : image!.status}
            </Badge>
          </CardContent>
        </Card>

        {/* Upload form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Enviar Arte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Seu email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="designer@email.com"
                readOnly={!!image?.assigned_email}
                className={image?.assigned_email ? 'bg-muted' : ''}
              />
              {image?.assigned_email && (
                <p className="text-xs text-muted-foreground">Email vinculado ao briefing — não pode ser alterado</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Arquivo da arte *</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                {file ? (
                  <div>
                    <FileImage className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo</p>
                  </div>
                )}
              </div>
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept="image/*,.psd,.ai,.pdf,.svg,.eps,.zip,.rar"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="comments">Comentários (opcional)</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder="Observações sobre a entrega..."
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !file || !email}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Entregar Arte
            </Button>
          </CardContent>
        </Card>
      </div>
    </CursEducaLayout>
  );
}
