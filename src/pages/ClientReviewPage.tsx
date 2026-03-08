import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import {
  Heart, X, Loader2, Mail, CheckCircle, ImageIcon, Download,
  Sparkles, ThumbsDown, FolderOpen, Clock, Eye, Archive,
  ChevronRight, PlusCircle, ArrowRight, Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';
import ReviewHistory from '@/components/client-review/ReviewHistory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReviewableImage {
  id: string;
  image_type: string;
  product_name: string | null;
  observations: string | null;
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

interface ClientReviewPageProps {
  injectedEmail?: string;
  embedded?: boolean;
}

export default function ClientReviewPage({ injectedEmail, embedded = false }: ClientReviewPageProps = {}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(injectedEmail || '');
  const [authenticated, setAuthenticated] = useState(!!injectedEmail);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ReviewableImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [clientName, setClientName] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [platformUrls, setPlatformUrls] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [showProductionDialog, setShowProductionDialog] = useState(false);
  const [showAllImagesDialog, setShowAllImagesDialog] = useState(false);
  const [briefingDetailId, setBriefingDetailId] = useState<string | null>(null);
  const [briefingDetail, setBriefingDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [allImagesData, setAllImagesData] = useState<Array<{
    id: string;
    image_type: string;
    product_name: string | null;
    deadline: string | null;
    assigned_email: string | null;
    status: string;
    image_text: string | null;
    observations: string | null;
  }>>([]);
  const [productionImages, setProductionImages] = useState<Array<{
    id: string;
    image_type: string;
    product_name: string | null;
    deadline: string | null;
    assigned_email: string | null;
    status: string;
  }>>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    const emailParam = params.get('email');
    if (tokenParam) {
      fetchImages(undefined, tokenParam.trim());
    } else if (injectedEmail) {
      fetchImages(injectedEmail.trim().toLowerCase());
    } else if (emailParam) {
      setEmail(emailParam);
      fetchImages(emailParam.trim().toLowerCase());
    }
  }, [injectedEmail]);

  const fetchImages = async (clientEmail?: string, reviewToken?: string) => {
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (reviewToken) {
        body.review_token = reviewToken;
      } else if (clientEmail) {
        body.email = clientEmail;
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('client-review-data', {
        body,
      });

      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      // Set email from server response (resolved from token or echoed back)
      if (result?.resolvedEmail) {
        setEmail(result.resolvedEmail);
      }

      const requests = result.requests || [];
      if (requests.length === 0) {
        toast.error('Nenhuma solicitação encontrada para este email');
        setLoading(false);
        return;
      }

      if (requests[0]?.requester_name) {
        setClientName(requests[0].requester_name.split(' ')[0]);
      }

      const urls = [...new Set(requests.map((r: any) => r.platform_url).filter(Boolean))] as string[];
      setPlatformUrls(urls);

      const counts = result.counts || {};
      setTotalApproved(counts.completed || 0);
      setTotalImages(counts.total || 0);

      const prodData = result.images?.production || [];
      const inProduction = prodData.filter((i: any) => !!i.assigned_email);
      const requested = prodData.filter((i: any) => !i.assigned_email);
      setProductionImages(inProduction);
      setPendingCount(inProduction.length);
      setRequestedCount(requested.length);
      setAllImagesData((result.images?.all || []) as any);

      const imagesWithDelivery: ReviewableImage[] = (result.images?.review || []).map((img: any) => ({
        ...img,
        delivery: img.delivery || null,
      }));

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

  const fetchBriefingDetail = async (imageId: string) => {
    setBriefingDetailId(imageId);
    setLoadingDetail(true);
    try {
      // Use edge function to fetch detail securely
      const { data: result } = await supabase.functions.invoke('client-review-data', {
        body: { email, image_id: imageId },
      });
      const allImgs = result?.images?.all || [];
      const detail = allImgs.find((i: any) => i.id === imageId);
      setBriefingDetail(detail || null);
    } catch {
      toast.error('Erro ao carregar detalhes');
    } finally {
      setLoadingDetail(false);
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
      await supabase.functions.invoke('delivery-data', {
        body: {
          action: 'update_status',
          image_id: currentImage.id,
          status: 'completed',
          reviewed_by: email,
          reviewer_comments: null,
        },
      });

      // Brand asset archiving is now handled server-side in the delivery-data edge function

      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });
      // Side bursts
      setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 50, origin: { x: 0, y: 0.7 } });
        confetti({ particleCount: 50, angle: 120, spread: 50, origin: { x: 1, y: 0.7 } });
      }, 200);

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
      await supabase.functions.invoke('delivery-data', {
        body: {
          action: 'update_status',
          image_id: currentImage.id,
          status: 'in_progress',
          revision_count: currentImage.revision_count + 1,
          reviewed_by: email,
          reviewer_comments: rejectionReason,
        },
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
  const imageTypeLabel = currentImage 
    ? `${IMAGE_TYPE_LABELS[currentImage.image_type as ImageType] || currentImage.image_type}${currentImage.observations ? ' — ' + currentImage.observations : ''}`
    : '';

  const handleDownloadZip = async () => {
    if (!platformUrls.length) return;
    setDownloadingZip(true);
    try {
      const { data: assets, error } = await supabase
        .from('brand_assets')
        .select('file_url, file_name')
        .in('platform_url', platformUrls);

      if (error) throw error;
      if (!assets || assets.length === 0) {
        toast.error('Nenhuma arte aprovada encontrada para download');
        setDownloadingZip(false);
        return;
      }

      const zip = new JSZip();
      let fileIndex = 0;

      for (const asset of assets) {
        try {
          const response = await fetch(asset.file_url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const urlPath = new URL(asset.file_url).pathname;
          const ext = urlPath.substring(urlPath.lastIndexOf('.')) || '.png';
          const fileName = asset.file_name
            ? `${asset.file_name}${ext}`
            : `arte-${++fileIndex}${ext}`;
          zip.file(fileName, blob);
        } catch {
          console.warn('Failed to fetch file:', asset.file_url);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artes-aprovadas-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`${assets.length} arte(s) baixada(s) com sucesso! 📦`);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar ZIP: ' + (err.message || ''));
    } finally {
      setDownloadingZip(false);
    }
  };

  const cardBg = embedded ? 'bg-white/5 border-white/10' : 'bg-card/80 border-border';
  const cardBgSolid = embedded ? 'bg-[#1E293B] border-white/10' : 'bg-card border-border';
  const textMain = embedded ? 'text-white' : 'text-foreground';
  const textSub = embedded ? 'text-white/50' : 'text-muted-foreground';

  const StatsBar = () => (
    <div className="px-4 mb-8">
      {/* Stats grid */}
      <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {totalImages > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onClick={() => setShowAllImagesDialog(true)}
            className={`relative overflow-hidden rounded-2xl ${cardBg} backdrop-blur-sm p-4 text-center shadow-sm hover:shadow-md transition-all cursor-pointer group`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent group-hover:from-primary/10 transition-colors" />
            <div className="relative">
              <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <p className={`text-2xl font-extrabold ${textMain}`}>{totalImages}</p>
              <p className={`text-[11px] ${textSub} font-medium flex items-center justify-center gap-1`}>
                Solicitadas <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </motion.div>
        )}

        {requestedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`relative overflow-hidden rounded-2xl ${cardBg} backdrop-blur-sm p-4 text-center shadow-sm`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/5 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                <Clock className={`h-5 w-5 ${textSub}`} />
              </div>
              <p className={`text-2xl font-extrabold ${textMain}`}>{requestedCount}</p>
              <p className={`text-[11px] ${textSub} font-medium`}>Solicitado</p>
            </div>
          </motion.div>
        )}

        {pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            onClick={() => setShowProductionDialog(true)}
            className={`relative overflow-hidden rounded-2xl border border-amber-500/20 ${embedded ? 'bg-white/5' : 'bg-card/80'} backdrop-blur-sm p-4 text-center shadow-sm hover:shadow-md transition-all cursor-pointer group`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent group-hover:from-amber-500/10 transition-colors" />
            <div className="relative">
              <div className="mx-auto w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-2xl font-extrabold text-amber-500">{pendingCount}</p>
              <p className={`text-[11px] ${textSub} font-medium flex items-center justify-center gap-1`}>
                Em produção <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
          </motion.div>
        )}

        {images.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`relative overflow-hidden rounded-2xl border border-primary/20 ${embedded ? 'bg-white/5' : 'bg-card/80'} backdrop-blur-sm p-4 text-center shadow-sm`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-extrabold text-primary">{images.length}</p>
              <p className={`text-[11px] ${textSub} font-medium`}>Para aprovar</p>
            </div>
          </motion.div>
        )}

        {totalApproved > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`relative overflow-hidden rounded-2xl border border-primary/20 ${embedded ? 'bg-white/5' : 'bg-card/80'} backdrop-blur-sm p-4 text-center shadow-sm`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
            <div className="relative">
              <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-extrabold text-primary">{totalApproved}</p>
              <p className={`text-[11px] ${textSub} font-medium`}>Aprovadas</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Action buttons row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-2"
      >
        {platformUrls.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assets/${encodeURIComponent(platformUrls[0])}`)}
            className={`rounded-full gap-2 h-9 px-4 ${embedded ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-card/60 backdrop-blur-sm border-border hover:bg-card'}`}
          >
            <FolderOpen className="h-4 w-4" />
            Minha Pasta
          </Button>
        )}

        {totalApproved > 0 && platformUrls.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadZip}
            disabled={downloadingZip}
            className={`rounded-full gap-2 h-9 px-4 ${embedded ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-card/60 backdrop-blur-sm border-border hover:bg-card'}`}
          >
            {downloadingZip ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Baixar ZIP ({totalApproved})
          </Button>
        )}

      </motion.div>

      {/* Production images dialog */}
      <Dialog open={showProductionDialog} onOpenChange={setShowProductionDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Artes em Produção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {productionImages.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhuma arte em produção</p>
            ) : (
              productionImages.map((img) => {
                const typeLabel = `${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${(img as any).observations ? ' — ' + (img as any).observations : ''}`;
                const isLate = img.deadline && new Date(img.deadline) < new Date();
                return (
                  <div
                    key={img.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isLate ? 'bg-destructive/15' : 'bg-amber-500/15'}`}>
                      <ImageIcon className={`h-5 w-5 ${isLate ? 'text-destructive' : 'text-amber-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {img.product_name || typeLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">{typeLabel}</p>
                      {img.deadline ? (
                        <p className={`text-xs mt-1 font-medium ${isLate ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isLate ? '⚠️ Atrasada — ' : '📅 Prazo: '}
                          {format(new Date(img.deadline), "dd 'de' MMM', ' HH:mm", { locale: ptBR })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">📅 Sem prazo definido</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {img.status === 'pending' ? 'Aguardando' : 'Em andamento'}
                      </Badge>
                      <button
                        onClick={() => fetchBriefingDetail(img.id)}
                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                        title="Ver detalhes do briefing"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* All images dialog */}
      <Dialog open={showAllImagesDialog} onOpenChange={setShowAllImagesDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Todas as Artes Solicitadas
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {allImagesData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">Nenhuma arte encontrada</p>
            ) : (
              allImagesData.map((img) => {
                const typeLabel = `${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${img.observations ? ' — ' + img.observations : ''}`;
                const statusMap: Record<string, { label: string; color: string }> = {
                  pending: { label: 'Aguardando', color: 'text-amber-500 border-amber-500/30' },
                  in_progress: { label: 'Em andamento', color: 'text-info border-info/30' },
                  review: { label: 'Em validação', color: 'text-primary border-primary/30' },
                  completed: { label: 'Aprovada', color: 'text-primary border-primary/30' },
                  cancelled: { label: 'Cancelada', color: 'text-destructive border-destructive/30' },
                };
                const st = statusMap[img.status] || statusMap.pending;
                return (
                  <div
                    key={img.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30"
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
                      <ImageIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {img.product_name || typeLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">{typeLabel}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-xs ${st.color}`}>
                        {st.label}
                      </Badge>
                      <button
                        onClick={() => fetchBriefingDetail(img.id)}
                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                        title="Ver detalhes do briefing"
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Briefing detail dialog */}
      <Dialog open={!!briefingDetailId} onOpenChange={(open) => { if (!open) { setBriefingDetailId(null); setBriefingDetail(null); } }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes do Briefing
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : briefingDetail ? (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Tipo</p>
                  <p className="text-sm font-medium">{IMAGE_TYPE_LABELS[briefingDetail.image_type as ImageType] || briefingDetail.image_type}</p>
                </div>
                {briefingDetail.product_name && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Produto</p>
                    <p className="text-sm font-medium">{briefingDetail.product_name}</p>
                  </div>
                )}
                {briefingDetail.orientation && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Orientação</p>
                    <p className="text-sm font-medium">{briefingDetail.orientation}</p>
                  </div>
                )}
                {briefingDetail.deadline && (
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Prazo</p>
                    <p className="text-sm font-medium">{format(new Date(briefingDetail.deadline), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                )}
              </div>
              {briefingDetail.image_text && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Texto da Arte</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{briefingDetail.image_text}</p>
                </div>
              )}
              {briefingDetail.font_suggestion && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Sugestão de Fonte</p>
                  <p className="text-sm">{briefingDetail.font_suggestion}</p>
                </div>
              )}
              {briefingDetail.element_suggestion && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Sugestão de Elementos</p>
                  <p className="text-sm">{briefingDetail.element_suggestion}</p>
                </div>
              )}
              {briefingDetail.observations && (
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase font-semibold mb-1">Observações</p>
                  <p className="text-sm bg-muted/50 rounded-lg p-3">{briefingDetail.observations}</p>
                </div>
              )}
              <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                <span>Refações: {briefingDetail.revision_count}</span>
                {briefingDetail.assigned_email && <span>Designer: {briefingDetail.assigned_email}</span>}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">Nenhum detalhe encontrado</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  const PageWrapper = ({ children, headerTitle, headerSubtitle, showStats = false }: { children: React.ReactNode; headerTitle: string; headerSubtitle?: string; showStats?: boolean }) => {
    if (embedded) {
      return (
        <div className="space-y-6">
          {showStats && <StatsBar />}
          {showStats && <ReviewHistory email={email} visible={showHistory} onToggle={() => setShowHistory(v => !v)} />}
          {children}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background">
        {/* Hero header with enhanced gradient */}
        <div className="relative w-full overflow-hidden" style={{ minHeight: '200px' }}>
          <img
            src="/images/bg-curseduca.png"
            alt="Curseduca"
            className="absolute inset-0 w-full h-full object-cover scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
          {/* Decorative blur orbs */}
          <div className="absolute top-8 left-1/4 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
          <div className="absolute bottom-4 right-1/4 w-32 h-32 bg-primary/15 rounded-full blur-[60px]" />

          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-10 min-h-[200px]">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-5 py-2 mb-4 shadow-lg"
            >
              <Sparkles className="h-4 w-4 text-primary-foreground" />
              <span className="text-primary-foreground/90 text-sm font-semibold tracking-wide">Validação de Artes</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl font-extrabold text-primary-foreground drop-shadow-xl"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {headerTitle}
            </motion.h1>
            {headerSubtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-primary-foreground/70 mt-3 text-sm sm:text-base max-w-xl"
              >
                {headerSubtitle}
              </motion.p>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="relative z-10 -mt-8">
          {showStats && <StatsBar />}
          {showStats && <ReviewHistory email={email} visible={showHistory} onToggle={() => setShowHistory(v => !v)} />}
          {children}
        </div>
      </div>
    );
  };

  if (!authenticated) {
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      );
    }
    return (
      <PageWrapper
        headerTitle="Validação de Artes"
        headerSubtitle="Aprove ou solicite ajustes nas suas artes de forma rápida e visual"
      >
        <div className="flex items-center justify-center px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
            className="w-full max-w-md"
          >
            <div className="relative overflow-hidden bg-card border border-border rounded-3xl shadow-2xl p-8 space-y-6">
              {/* Decorative gradient */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-t-3xl" />

              <div className="text-center space-y-3 pt-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner"
                >
                  <Mail className="h-7 w-7 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Acesse suas artes</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Informe o email utilizado na solicitação para visualizar e aprovar suas artes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Seu email
                </Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="seuemail@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="h-12 text-base rounded-xl bg-muted/50 border-border focus:bg-card"
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Acessar minhas artes
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => navigate('/briefing')}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  <PlusCircle className="h-3 w-3" />
                  Precisa solicitar novas artes?
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  if (allDone) {
    return (
      <PageWrapper
        headerTitle="Tudo revisado! 🎉"
        headerSubtitle={`Obrigado pela sua avaliação${clientName ? `, ${clientName}` : ''}!`}
        showStats
      >
        <div className="flex items-center justify-center px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-full max-w-md"
          >
             <div className={`relative overflow-hidden ${cardBgSolid} border rounded-3xl shadow-2xl p-8 text-center space-y-6`}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary rounded-t-3xl" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner"
              >
                <CheckCircle className="h-12 w-12 text-primary" />
              </motion.div>
              <div>
                <h2 className={`text-2xl font-bold ${textMain}`}>Parabéns!</h2>
                <p className={`${textSub} mt-2`}>
                  Você revisou <span className="font-bold text-primary">{completedCount}</span> arte(s).
                  <br />Sua opinião é muito importante para nós!
                </p>
              </div>

              {/* Gamified counters */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Revisadas', value: completedCount, emoji: '🎨' },
                  { label: 'Aprovadas', value: totalApproved + completedCount, emoji: '✅' },
                  { label: 'Total', value: totalImages, emoji: '📊' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className={`rounded-xl ${cardBg} p-3`}
                  >
                    <p className="text-2xl">{stat.emoji}</p>
                    <p className={`text-xl font-extrabold ${textMain}`}>{stat.value}</p>
                    <p className={`text-[10px] ${textSub}`}>{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3 text-4xl justify-center">
                {['🎨', '✨', '🚀'].map((emoji, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.15 }}
                  >
                    {emoji}
                  </motion.span>
                ))}
              </div>
              <div className="space-y-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCurrentIndex(0);
                    setCompletedCount(0);
                    fetchImages(email);
                  }}
                  className="w-full rounded-xl"
                >
                  Verificar novamente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/briefing')}
                  className="w-full rounded-xl gap-2 text-primary hover:text-primary"
                >
                  <PlusCircle className="h-4 w-4" />
                  Solicitar novas artes
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  if (images.length === 0) {
    return (
      <PageWrapper
        headerTitle="Validação de Artes"
        headerSubtitle={clientName ? `Olá, ${clientName}!` : undefined}
        showStats
      >
        <div className="flex items-center justify-center px-4 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className={`relative overflow-hidden ${cardBgSolid} border rounded-3xl shadow-2xl p-8 text-center space-y-5`}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-muted-foreground/20 via-muted-foreground/10 to-muted-foreground/20 rounded-t-3xl" />
              <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <Palette className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className={`text-xl font-bold ${textMain}`}>Nenhuma arte para validar</h2>
              <p className={`${textSub} text-sm leading-relaxed`}>
                Não há artes aguardando sua aprovação no momento.<br/>Volte mais tarde ou solicite novas artes!
              </p>
              <div className="space-y-2 pt-2">
                <Button variant="outline" onClick={() => fetchImages(email)} className="w-full rounded-xl">
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/briefing')}
                  className="w-full rounded-xl gap-2 text-primary hover:text-primary"
                >
                  <PlusCircle className="h-4 w-4" />
                  Solicitar novas artes
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      headerTitle={clientName ? `Olá, ${clientName}! 👋` : 'Validação de Artes'}
      headerSubtitle="Aprove ou solicite ajustes nas suas artes"
      showStats
    >
      <div className="flex flex-col items-center px-4 pb-16">
        {/* Progress indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className={`inline-flex items-center gap-3 ${cardBg} backdrop-blur-sm border rounded-full px-5 py-2.5 shadow-sm`}>
            <span className={`text-sm font-semibold ${textMain}`}>
              {currentIndex + 1}
            </span>
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                initial={false}
                animate={{ width: `${((currentIndex) / images.length) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className={`text-sm ${textSub} font-medium`}>
              {images.length}
            </span>
          </div>
        </motion.div>

        {/* Review card */}
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
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-lg relative"
          >
            {/* APROVADO / REFAÇÃO overlay during swipe */}
            <AnimatePresence>
              {direction === 'right' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-primary/90 text-primary-foreground px-8 py-4 rounded-2xl text-3xl font-extrabold tracking-wider rotate-[-15deg] border-4 border-primary-foreground/30 shadow-2xl">
                    APROVADO ✓
                  </div>
                </motion.div>
              )}
              {direction === 'left' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
                >
                  <div className="bg-destructive/90 text-destructive-foreground px-8 py-4 rounded-2xl text-3xl font-extrabold tracking-wider rotate-[15deg] border-4 border-destructive-foreground/30 shadow-2xl">
                    REFAÇÃO ✗
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`relative ${cardBgSolid} border rounded-3xl shadow-2xl overflow-hidden`}>
              {/* Top accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-primary z-10" />

              {/* Delivery preview */}
              {currentImage.delivery ? (
                <div className="relative bg-muted/50 flex items-center justify-center overflow-hidden" style={{ minHeight: '60vh', maxHeight: '70vh' }}>
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
                  <Badge className="absolute top-4 right-4 bg-card/90 text-foreground backdrop-blur-xl border border-border shadow-md text-xs font-semibold">
                    {imageTypeLabel}
                  </Badge>
                </div>
              ) : (
                <div className="bg-muted/30 aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Sem preview disponível</p>
                  </div>
                </div>
              )}

              <div className="p-6 space-y-4">
                <div>
                  <h2 className={`text-xl font-bold ${textMain}`}>
                    {currentImage.product_name || imageTypeLabel}
                  </h2>
                  <p className={`text-sm ${textSub}`}>{imageTypeLabel}</p>
                  {currentImage.revision_count > 0 && (
                    <Badge variant="outline" className="mt-2 text-destructive border-destructive/30 bg-destructive/5">
                      ⚠️ Refação {currentImage.revision_count}
                    </Badge>
                  )}
                </div>

                {currentImage.delivery?.comments && (
                  <div className="bg-muted/40 rounded-2xl p-4 border border-border/50">
                    <p className="text-[11px] text-muted-foreground font-bold mb-1.5 uppercase tracking-widest">💬 Designer</p>
                    <p className={`text-sm ${textMain} leading-relaxed`}>{currentImage.delivery.comments}</p>
                  </div>
                )}

                {/* Rejection form */}
                {rejecting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 border-t border-border pt-4"
                  >
                    <Label className="text-destructive font-semibold flex items-center gap-2 text-sm">
                      <ThumbsDown className="h-4 w-4" />
                      Por que você está reprovando? *
                    </Label>
                    <Textarea
                      placeholder="Descreva o que precisa ser ajustado na arte..."
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      rows={3}
                      className="rounded-xl border-destructive/20 focus-visible:ring-destructive bg-destructive/5"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleReject}
                        disabled={submitting || !rejectionReason.trim()}
                        className="flex-1 rounded-xl"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                        Confirmar Reprovação
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setRejecting(false); setRejectionReason(''); }}
                        disabled={submitting}
                        className="rounded-xl"
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

        {/* Action buttons — larger with swipe hints */}
        {!rejecting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-8 mt-8"
          >
            {/* Reject */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{ x: [0, -4, 0] }}
                transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.6 }}
                className="text-[10px] text-destructive/50 font-medium flex items-center gap-1 mb-1"
              >
                ← Deslize
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => setRejecting(true)}
                disabled={submitting}
                className="w-[72px] h-[72px] rounded-full bg-destructive/10 hover:bg-destructive/20 border-2 border-destructive/30 hover:border-destructive flex items-center justify-center transition-all disabled:opacity-50 shadow-lg hover:shadow-destructive/25"
              >
                <X className="h-8 w-8 text-destructive" />
              </motion.button>
              <span className={`text-xs font-semibold ${textSub}`}>Reprovar</span>
            </div>

            {/* Approve */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.6 }}
                className="text-[10px] text-primary/50 font-medium flex items-center gap-1 mb-1"
              >
                Deslize →
              </motion.div>
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.88 }}
                onClick={handleApprove}
                disabled={submitting}
                className="w-[88px] h-[88px] rounded-full bg-primary/10 hover:bg-primary/20 border-3 border-primary/40 hover:border-primary flex items-center justify-center transition-all disabled:opacity-50 shadow-xl hover:shadow-primary/30"
              >
                <Heart className="h-11 w-11 text-primary fill-primary" />
              </motion.button>
              <span className={`text-xs font-semibold ${textSub}`}>Aprovar</span>
            </div>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
}
