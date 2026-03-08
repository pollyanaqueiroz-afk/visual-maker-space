import { useEffect, useState, useRef } from 'react';
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
import { Upload, FileImage, Clock, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
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
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fire confetti + celebration on delivery success
  useEffect(() => {
    if (delivered) {
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899'] });
      setTimeout(() => {
        confetti({ particleCount: 60, angle: 60, spread: 50, origin: { x: 0, y: 0.7 } });
        confetti({ particleCount: 60, angle: 120, spread: 50, origin: { x: 1, y: 0.7 } });
      }, 300);
    }
  }, [delivered]);

  const handleSubmit = async () => {
    if (!file || !email || !image) {
      toast.error('Preencha o email e selecione um arquivo');
      return;
    }
    if (image.assigned_email && email.toLowerCase() !== image.assigned_email.toLowerCase()) {
      toast.error(`Este briefing foi atribuído para ${image.assigned_email}. Use o email correto para entregar.`);
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `deliveries/${image.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('briefing-uploads').upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(filePath);
      const { data: submitResult, error: submitErr } = await supabase.functions.invoke('delivery-data', {
        body: { action: 'submit', image_id: image.id, file_url: urlData.publicUrl, comments: comments || null, delivered_by_email: email },
      });
      if (submitErr) throw submitErr;
      if (submitResult?.error) throw new Error(submitResult.error);
      supabase.functions.invoke('notify-delivery', {
        body: { image_id: image.id, file_url: urlData.publicUrl, delivered_by_email: email, comments: comments || null, app_url: window.location.origin },
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
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
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15 }}
          >
            <Card className="max-w-md w-full overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary" />
              <CardContent className="pt-8 pb-8 text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
                </motion.div>
                <h2 className="text-2xl font-bold text-foreground">Arte entregue! 🎉</h2>
                <p className="text-muted-foreground">Sua entrega foi registrada com sucesso. O solicitante será notificado.</p>
                <motion.div
                  className="flex gap-2 text-3xl justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {['🎨', '✨', '🚀'].map((e, i) => (
                    <motion.span key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 + i * 0.15 }}>{e}</motion.span>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </CursEducaLayout>
    );
  }

  return (
    <CursEducaLayout title="Entrega de Arte" subtitle="Curseduca Design">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Briefing summary */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileImage className="h-5 w-5 text-primary" />
                Resumo do Briefing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Tipo de Arte</span><p className="font-medium">{IMAGE_TYPE_LABELS[image!.image_type] || image!.image_type}</p></div>
                {image!.product_name && <div><span className="text-muted-foreground">Produto</span><p className="font-medium">{image!.product_name}</p></div>}
                <div><span className="text-muted-foreground">Solicitante</span><p className="font-medium">{image!.briefing_requests.requester_name}</p></div>
                {image!.deadline && <div><span className="text-muted-foreground">Prazo</span><div className="flex items-center gap-1"><Clock className="h-3 w-3 text-warning" /><p className="font-medium">{new Date(image!.deadline).toLocaleDateString('pt-BR')}</p></div></div>}
              </div>
              {image!.observations && <><Separator /><div><span className="text-muted-foreground">Observações</span><p>{image!.observations}</p></div></>}
              {image!.image_text && <><Separator /><div><span className="text-muted-foreground">Texto da imagem</span><p>{image!.image_text}</p></div></>}
              {image!.font_suggestion && <div><span className="text-muted-foreground">Fonte sugerida</span><p>{image!.font_suggestion}</p></div>}
              {image!.element_suggestion && <div><span className="text-muted-foreground">Elemento / Referência visual</span><p>{image!.element_suggestion}</p></div>}
              {image!.professional_photo_url && <div><span className="text-muted-foreground">Foto do profissional</span><a href={image!.professional_photo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all text-sm">{image!.professional_photo_url}</a></div>}
              {image!.extra_info && <div className="border-l-2 border-primary/30 pl-3"><span className="text-primary text-xs font-semibold">Informações adicionais</span><p className="whitespace-pre-wrap">{image!.extra_info}</p></div>}
              <Badge variant="secondary" className="mt-2">
                Status: {image!.status === 'review' ? 'Em Validação' : image!.status === 'in_progress' ? 'Em Execução' : image!.status === 'completed' ? 'Aprovada' : image!.status === 'pending' ? 'Solicitada' : image!.status}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload form */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
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
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="designer@email.com" readOnly={!!image?.assigned_email} className={image?.assigned_email ? 'bg-muted' : ''} />
                {image?.assigned_email && <p className="text-xs text-muted-foreground">Email vinculado ao briefing — não pode ser alterado</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Arquivo da arte *</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50'}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  {file ? (
                    <div>
                      <FileImage className="h-8 w-8 text-primary mx-auto mb-2" />
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <motion.div animate={dragOver ? { y: -8 } : { y: 0 }} transition={{ type: 'spring', stiffness: 300 }}>
                        <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${dragOver ? 'text-primary animate-float' : 'text-muted-foreground'}`} />
                      </motion.div>
                      <p className="text-sm text-muted-foreground">
                        {dragOver ? 'Solte o arquivo aqui!' : 'Arraste ou clique para selecionar'}
                      </p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} id="file-input" type="file" className="hidden" accept="image/*,.psd,.ai,.pdf,.svg,.eps,.zip,.rar" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Comentários (opcional)</Label>
                <Textarea id="comments" value={comments} onChange={e => setComments(e.target.value)} placeholder="Observações sobre a entrega..." rows={3} />
              </div>

              <Button className="w-full relative overflow-hidden" onClick={handleSubmit} disabled={submitting || !file || !email}>
                <AnimatePresence mode="wait">
                  {submitting ? (
                    <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                      <Sparkles className="h-4 w-4 mr-2" /> Entregar Arte
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </CursEducaLayout>
  );
}
