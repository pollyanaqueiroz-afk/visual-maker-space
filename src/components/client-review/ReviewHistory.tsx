import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { CheckCircle, XCircle, History, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReviewRecord {
  id: string;
  action: string;
  reviewer_comments: string | null;
  created_at: string;
  briefing_image: {
    image_type: string;
    product_name: string | null;
  } | null;
}

interface Props {
  email: string;
  visible: boolean;
  onToggle: () => void;
}

export default function ReviewHistory({ email, visible, onToggle }: Props) {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && reviews.length === 0) {
      fetchHistory();
    }
  }, [visible]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('briefing_reviews')
        .select('id, action, reviewer_comments, created_at, briefing_image_id')
        .eq('reviewed_by', email)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch image details for each review
      const enriched: ReviewRecord[] = [];
      for (const review of (data || [])) {
        const { data: img } = await supabase
          .from('briefing_images')
          .select('image_type, product_name')
          .eq('id', review.briefing_image_id)
          .single();

        enriched.push({
          ...review,
          briefing_image: img || null,
        });
      }

      setReviews(enriched);
    } catch (err) {
      console.error('Error fetching review history:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedCount = reviews.filter(r => r.action === 'approved').length;
  const rejectedCount = reviews.filter(r => r.action === 'revision_requested').length;

  return (
    <div className="w-full max-w-lg mx-auto px-4 mb-6">
      <Button
        variant="ghost"
        onClick={onToggle}
        className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <History className="h-4 w-4" />
        <span className="text-sm font-medium">Meu Histórico</span>
        {visible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Summary badges */}
            {reviews.length > 0 && (
              <div className="flex items-center justify-center gap-3 mt-3 mb-4">
                <Badge className="bg-primary/10 text-primary border-primary/30 gap-1.5 px-3 py-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {approvedCount} aprovada(s)
                </Badge>
                <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1.5 px-3 py-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  {rejectedCount} refação(ões)
                </Badge>
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Carregando histórico...
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma avaliação realizada ainda.
                </div>
              ) : (
                reviews.map((review, i) => {
                  const isApproved = review.action === 'approved';
                  const typeLabel = review.briefing_image
                    ? (IMAGE_TYPE_LABELS[review.briefing_image.image_type as ImageType] || review.briefing_image.image_type)
                    : 'Arte';

                  return (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border rounded-xl p-4 flex items-start gap-3"
                    >
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isApproved ? 'bg-primary/10' : 'bg-destructive/10'
                      }`}>
                        {isApproved ? (
                          <CheckCircle className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {review.briefing_image?.product_name || typeLabel}
                          </p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {typeLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isApproved ? '✅ Aprovada' : '🔄 Refação solicitada'} • {format(new Date(review.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {review.reviewer_comments && (
                          <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{review.reviewer_comments}</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
