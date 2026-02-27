import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { Heart, X, Loader2, Mail, CheckCircle, ImageIcon, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReviewableImage {
  id: string;
  image_type: string;
  product_name: string | null;
  assigned_email: string | null;
  revision_count: number;
  request_id: string;
  briefing_requests: {
    requester_name: string;
    platform_url: string;
  };
  delivery: {
    file_url: string;
    comments: string | null;
    created_at: string;
  } | null;
}

export default function ClientReviewPage() {
  const [email, setEmail] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ReviewableImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [completedCount, setCompletedCount] = useState(0);

  const fetchImages = async (clientEmail: string) => {
    setLoading(true);
    try {
      // Get request IDs for this client email
      const { data: requests, error: reqErr } = await supabase
        .from('briefing_requests')
        .select('id')
        .eq('requester_email', clientEmail);

      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) {
        toast.error('Nenhuma solicitação encontrada para este email');
        setLoading(false);
        return;
      }

      const requestIds = requests.map(r => r.id);

      // Get images in review status for these requests
      const { data: imgs, error: imgErr } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, assigned_email, revision_count, request_id, briefing_requests!inner(requester_name, platform_url)')
        .in('request_id', requestIds)
        .eq('status', 'review')
        .order('created_at', { ascending: true });

      if (imgErr) throw imgErr;

      // Fetch latest delivery for each image
      const imagesWithDelivery: ReviewableImage[] = [];
      for (const img of (imgs || [])) {
        const { data: deliveries } = await supabase
          .from('briefing_deliveries')
          .select('file_url, comments, created_at')
          .eq('briefing_image_id', img.id)
          .order('created_at', { ascending: false })
          .limit(1);

        imagesWithDelivery.push({
          ...img,
          delivery: deliveries && deliveries.length > 0 ? deliveries[0] : null,
        } as ReviewableImage);
      }

      setImages(imagesWithDelivery);
      setAuthenticated(true);
      if (imagesWithDelivery.length === 0) {
        toast.info('Nenhuma arte aguardando sua validação no momento');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao buscar artes: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!email.trim()) {
      toast.error('Informe seu email');
      return;
    }
    fetchImages(email.trim().toLowerCase());
  };

  const currentImage = images[currentIndex];

  const handleApprove = async () => {
    if (!currentImage) return;
    setSubmitting(true);
    setDirection('right');

    try {
      // Update status to completed
      await supabase
        .from('briefing_images')
        .update({ status: 'completed' })
        .eq('id', currentImage.id);

      // Create review record
      await supabase
        .from('briefing_reviews')
        .insert({
          briefing_image_id: currentImage.id,
          action: 'approved',
          reviewed_by: email,
          reviewer_comments: null,
        });

      // Archive approved delivery to brand_assets
      if (currentImage.delivery?.file_url) {
        const platformUrl = currentImage.briefing_requests?.platform_url;
        if (platformUrl) {
          await supabase.from('brand_assets').insert({
            file_url: currentImage.delivery.file_url,
            platform_url: platformUrl,
            briefing_image_id: currentImage.id,
            source: 'approved_delivery',
            file_name: `${IMAGE_TYPE_LABELS[currentImage.image_type as ImageType] || currentImage.image_type}${currentImage.product_name ? ` — ${currentImage.product_name}` : ''}`,
          } as any);
        }
      }

      toast.success('Arte aprovada! ✅');
      setCompletedCount(c => c + 1);

      setTimeout(() => {
        setDirection(null);
        setCurrentIndex(i => i + 1);
        setSubmitting(false);
      }, 400);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao aprovar: ' + (err.message || ''));
      setSubmitting(false);
      setDirection(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('A justificativa é obrigatória para reprovar');
      return;
    }
    if (!currentImage) return;
    setSubmitting(true);
    setDirection('left');

    try {
      // Update status to in_progress (refação) and increment revision_count
      await supabase
        .from('briefing_images')
        .update({
          status: 'in_progress' as any,
          revision_count: currentImage.revision_count + 1,
        })
        .eq('id', currentImage.id);

      // Create review record
      await supabase
        .from('briefing_reviews')
        .insert({
          briefing_image_id: currentImage.id,
          action: 'revision_requested',
          reviewed_by: email,
          reviewer_comments: rejectionReason,
        });

      // Notify designer via edge function
      await supabase.functions.invoke('notify-revision', {
        body: {
          image_id: currentImage.id,
          reviewer_comments: rejectionReason,
          reviewed_by: email,
          app_url: window.location.origin,
        },
      });

      toast.success('Refação solicitada! O designer foi notificado.');
      setCompletedCount(c => c + 1);
      setRejecting(false);
      setRejectionReason('');

      setTimeout(() => {
        setDirection(null);
        setCurrentIndex(i => i + 1);
        setSubmitting(false);
      }, 400);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao solicitar refação: ' + (err.message || ''));
      setSubmitting(false);
      setDirection(null);
    }
  };

  const allDone = currentIndex >= images.length && images.length > 0;
  const imageTypeLabel = currentImage ? (IMAGE_TYPE_LABELS[currentImage.image_type as ImageType] || currentImage.image_type) : '';

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Validação de Artes</h1>
              <p className="text-muted-foreground text-sm">
                Informe o email utilizado na solicitação do briefing para visualizar e aprovar suas artes.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Seu email</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="seuemail@empresa.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} disabled={loading} className="w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</>
              ) : (
                'Acessar minhas artes'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All reviewed
  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
             <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
               <CheckCircle className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Tudo revisado! 🎉</h1>
            <p className="text-muted-foreground">
              Você revisou {completedCount} arte(s). Obrigado pela sua avaliação!
            </p>
            <Button variant="outline" onClick={() => {
              setCurrentIndex(0);
              setCompletedCount(0);
              fetchImages(email);
            }}>
              Verificar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No images to review
  if (images.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold">Nenhuma arte para validar</h1>
            <p className="text-muted-foreground">
              Não há artes aguardando sua aprovação no momento. Volte mais tarde!
            </p>
            <Button variant="outline" onClick={() => fetchImages(email)}>
              Atualizar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tinder-like review card
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col items-center justify-center p-4">
      {/* Progress */}
      <div className="mb-6 text-center">
        <p className="text-sm text-muted-foreground">
          Arte {currentIndex + 1} de {images.length}
        </p>
        <div className="w-48 h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex) / images.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage.id}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{
            opacity: direction ? 0 : 1,
            x: direction === 'left' ? -300 : direction === 'right' ? 300 : 0,
            rotate: direction === 'left' ? -15 : direction === 'right' ? 15 : 0,
            scale: direction ? 0.9 : 1,
            y: 0,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-lg"
        >
          <Card className="overflow-hidden shadow-xl border-2">
            {/* Delivery preview */}
            {currentImage.delivery ? (
            <div className="relative bg-muted aspect-video flex items-center justify-center overflow-hidden">
                {currentImage.delivery.file_url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                  <img
                    src={currentImage.delivery.file_url}
                    alt={imageTypeLabel}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8">
                    <Download className="h-12 w-12 text-muted-foreground" />
                    <a
                      href={currentImage.delivery.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline text-sm"
                    >
                      Baixar arquivo entregue
                    </a>
                  </div>
                )}
                <Badge className="absolute top-3 right-3 bg-background/90 text-foreground">
                  {imageTypeLabel}
                </Badge>
              </div>
            ) : (
              <div className="bg-muted aspect-video flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Sem preview disponível</p>
              </div>
            )}

            <CardContent className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold">
                  {currentImage.product_name || imageTypeLabel}
                </h2>
                <p className="text-sm text-muted-foreground">{imageTypeLabel}</p>
                {currentImage.revision_count > 0 && (
                  <Badge variant="outline" className="mt-1 text-destructive border-destructive/30">
                    Refação {currentImage.revision_count}
                  </Badge>
                )}
              </div>

              {currentImage.delivery?.comments && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Comentário do designer:</p>
                  <p className="text-sm">{currentImage.delivery.comments}</p>
                </div>
              )}

              {/* Rejection form */}
              {rejecting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 border-t pt-4"
                >
                  <Label className="text-destructive font-semibold">
                    Por que você está reprovando? *
                  </Label>
                  <Textarea
                    placeholder="Descreva o que precisa ser ajustado na arte..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    rows={3}
                    className="border-destructive/30 focus-visible:ring-destructive"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={submitting || !rejectionReason.trim()}
                      className="flex-1"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                      Confirmar Reprovação
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setRejecting(false); setRejectionReason(''); }}
                      disabled={submitting}
                    >
                      Cancelar
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Action buttons */}
      {!rejecting && (
        <div className="flex items-center gap-8 mt-8">
          {/* Reject button */}
          <button
            onClick={() => setRejecting(true)}
            disabled={submitting}
            className="w-16 h-16 rounded-full bg-destructive/10 hover:bg-destructive/20 border-2 border-destructive/30 hover:border-destructive flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <X className="h-8 w-8 text-destructive" />
          </button>

          {/* Approve button */}
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="w-20 h-20 rounded-full bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
          >
            <Heart className="h-10 w-10 text-primary fill-primary" />
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        {rejecting ? 'Justifique a reprovação acima' : 'Toque no ❌ para reprovar ou no 💚 para aprovar'}
      </p>
    </div>
  );
}
