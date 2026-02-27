import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { Heart, X, Loader2, Mail, CheckCircle, ImageIcon, Download, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
      fetchImages(emailParam.trim().toLowerCase());
    }
  }, []);

  const fetchImages = async (clientEmail: string) => {
    setLoading(true);
    try {
      const { data: requests, error: reqErr } = await supabase
        .from('briefing_requests')
        .select('id, requester_name')
        .eq('requester_email', clientEmail);

      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) {
        toast.error('Nenhuma solicitação encontrada para este email');
        setLoading(false);
        return;
      }

      if (requests[0]?.requester_name) {
        setClientName(requests[0].requester_name.split(' ')[0]);
      }

      const requestIds = requests.map(r => r.id);

      const { data: imgs, error: imgErr } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, assigned_email, revision_count, request_id, briefing_requests!inner(requester_name, platform_url)')
        .in('request_id', requestIds)
        .eq('status', 'review')
        .order('created_at', { ascending: true });

      if (imgErr) throw imgErr;

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
      await supabase
        .from('briefing_images')
        .update({ status: 'completed' })
        .eq('id', currentImage.id);

      await supabase
        .from('briefing_reviews')
        .insert({
          briefing_image_id: currentImage.id,
          action: 'approved',
          reviewed_by: email,
          reviewer_comments: null,
        });

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

      toast.success('Arte aprovada! 🎉');
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
      await supabase
        .from('briefing_images')
        .update({
          status: 'in_progress' as any,
          revision_count: currentImage.revision_count + 1,
        })
        .eq('id', currentImage.id);

      await supabase
        .from('briefing_reviews')
        .insert({
          briefing_image_id: currentImage.id,
          action: 'revision_requested',
          reviewed_by: email,
          reviewer_comments: rejectionReason,
        });

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

  // Wrapper with CursEduca header
  const PageWrapper = ({ children, headerTitle, headerSubtitle }: { children: React.ReactNode; headerTitle: string; headerSubtitle?: string }) => (
    <div className="min-h-screen bg-background">
      {/* CursEduca Hero Header */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '160px' }}>
        <img
          src="/images/bg-curseduca.png"
          alt="Curseduca"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-8 min-h-[160px]">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 mb-3">
            <Sparkles className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm font-medium tracking-wide">Validação de Artes</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-lg"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {headerTitle}
          </h1>
          {headerSubtitle && (
            <p className="text-white/70 mt-2 text-sm max-w-xl">{headerSubtitle}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 -mt-6">
        {children}
      </div>
    </div>
  );

  // Login screen
  if (!authenticated) {
    return (
      <PageWrapper
        headerTitle="Validação de Artes"
        headerSubtitle="Aprove ou solicite ajustes nas suas artes de forma rápida e divertida!"
      >
        <div className="flex items-center justify-center px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Acesse suas artes</h2>
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
                  className="h-12 text-base"
                />
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full h-12 text-base font-semibold">
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Acessar minhas artes
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  // All reviewed
  if (allDone) {
    return (
      <PageWrapper
        headerTitle="Tudo revisado! 🎉"
        headerSubtitle={`Obrigado pela sua avaliação${clientName ? `, ${clientName}` : ''}!`}
      >
        <div className="flex items-center justify-center px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"
              >
                <CheckCircle className="h-12 w-12 text-primary" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">Parabéns!</h2>
                <p className="text-muted-foreground mt-2">
                  Você revisou <span className="font-bold text-primary">{completedCount}</span> arte(s).
                  <br />Sua opinião é muito importante para nós!
                </p>
              </div>
              <div className="flex gap-3 text-4xl justify-center">
                {['🎨', '✨', '🚀'].map((emoji, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.15 }}
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentIndex(0);
                  setCompletedCount(0);
                  fetchImages(email);
                }}
                className="w-full"
              >
                Verificar novamente
              </Button>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  // No images to review
  if (images.length === 0) {
    return (
      <PageWrapper
        headerTitle="Validação de Artes"
        headerSubtitle={clientName ? `Olá, ${clientName}!` : undefined}
      >
        <div className="flex items-center justify-center px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-4">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Nenhuma arte para validar</h2>
              <p className="text-muted-foreground text-sm">
                Não há artes aguardando sua aprovação no momento. Volte mais tarde!
              </p>
              <Button variant="outline" onClick={() => fetchImages(email)} className="w-full">
                Atualizar
              </Button>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  // Tinder-like review card
  return (
    <PageWrapper
      headerTitle={clientName ? `Olá, ${clientName}! 👋` : 'Validação de Artes'}
      headerSubtitle="Aprove ou solicite ajustes nas suas artes"
    >
      <div className="flex flex-col items-center px-4 pb-12">
        {/* Progress */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2 shadow-sm">
            <span className="text-sm font-medium text-foreground">
              Arte {currentIndex + 1} de {images.length}
            </span>
          </div>
          <div className="w-48 h-2 bg-muted rounded-full mt-3 overflow-hidden mx-auto">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={false}
              animate={{ width: `${((currentIndex) / images.length) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentImage.id}
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{
              opacity: direction ? 0 : 1,
              x: direction === 'left' ? -300 : direction === 'right' ? 300 : 0,
              rotate: direction === 'left' ? -12 : direction === 'right' ? 12 : 0,
              scale: direction ? 0.85 : 1,
              y: 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-lg"
          >
            <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
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
                    <div className="flex flex-col items-center gap-3 p-8">
                      <Download className="h-12 w-12 text-muted-foreground" />
                      <a
                        href={currentImage.delivery.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline text-sm font-medium"
                      >
                        Baixar arquivo entregue
                      </a>
                    </div>
                  )}
                  <Badge className="absolute top-3 right-3 bg-background/90 text-foreground backdrop-blur-sm border border-border">
                    {imageTypeLabel}
                  </Badge>
                </div>
              ) : (
                <div className="bg-muted aspect-video flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Sem preview disponível</p>
                </div>
              )}

              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {currentImage.product_name || imageTypeLabel}
                  </h2>
                  <p className="text-sm text-muted-foreground">{imageTypeLabel}</p>
                  {currentImage.revision_count > 0 && (
                    <Badge variant="outline" className="mt-2 text-destructive border-destructive/30">
                      ⚠️ Refação {currentImage.revision_count}
                    </Badge>
                  )}
                </div>

                {currentImage.delivery?.comments && (
                  <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                    <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase tracking-wider">💬 Comentário do designer</p>
                    <p className="text-sm text-foreground">{currentImage.delivery.comments}</p>
                  </div>
                )}

                {/* Rejection form */}
                {rejecting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 border-t border-border pt-4"
                  >
                    <Label className="text-destructive font-semibold flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4" />
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
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        {!rejecting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-8 mt-8"
          >
            {/* Reject button */}
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setRejecting(true)}
              disabled={submitting}
              className="w-16 h-16 rounded-full bg-destructive/10 hover:bg-destructive/20 border-2 border-destructive/30 hover:border-destructive flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg"
            >
              <X className="h-8 w-8 text-destructive" />
            </motion.button>

            {/* Approve button */}
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleApprove}
              disabled={submitting}
              className="w-20 h-20 rounded-full bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary flex items-center justify-center transition-colors disabled:opacity-50 shadow-lg"
            >
              <Heart className="h-10 w-10 text-primary fill-primary" />
            </motion.button>
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground mt-5">
          {rejecting ? '👆 Justifique a reprovação acima' : '❌ Reprovar   •   💚 Aprovar'}
        </p>
      </div>
    </PageWrapper>
  );
}
