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
  briefing_image_id: string;
}

interface ImageInfo {
  image_type: string;
  product_name: string | null;
}

interface GroupedArt {
  imageId: string;
  imageInfo: ImageInfo | null;
  reviews: ReviewRecord[];
  finalStatus: 'approved' | 'revision_requested';
}

interface Props {
  email: string;
  visible: boolean;
  onToggle: () => void;
}

export default function ReviewHistory({ email, visible, onToggle }: Props) {
  const [groups, setGroups] = useState<GroupedArt[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (visible && groups.length === 0) {
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
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      if (!data || data.length === 0) { setGroups([]); return; }

      // Group by image
      const map = new Map<string, ReviewRecord[]>();
      for (const r of data) {
        const list = map.get(r.briefing_image_id) || [];
        list.push(r);
        map.set(r.briefing_image_id, list);
      }

      // Fetch image info
      const imageIds = [...map.keys()];
      const { data: imgData } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name')
        .in('id', imageIds);

      const imgMap = new Map<string, ImageInfo>();
      (imgData || []).forEach(i => imgMap.set(i.id, { image_type: i.image_type, product_name: i.product_name }));

      const grouped: GroupedArt[] = imageIds.map(id => {
        const reviews = map.get(id) || [];
        const last = reviews[reviews.length - 1];
        return {
          imageId: id,
          imageInfo: imgMap.get(id) || null,
          reviews,
          finalStatus: last?.action === 'approved' ? 'approved' : 'revision_requested',
        };
      });

      // Sort: approved first, then by last review date desc
      grouped.sort((a, b) => {
        if (a.finalStatus !== b.finalStatus) return a.finalStatus === 'approved' ? -1 : 1;
        const aDate = a.reviews[a.reviews.length - 1]?.created_at || '';
        const bDate = b.reviews[b.reviews.length - 1]?.created_at || '';
        return bDate.localeCompare(aDate);
      });

      setGroups(grouped);
    } catch (err) {
      console.error('Error fetching review history:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedCount = groups.filter(g => g.finalStatus === 'approved').length;

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
            {/* Summary */}
            {groups.length > 0 && (
              <div className="flex items-center justify-center mt-3 mb-4">
                <Badge className="bg-primary/10 text-primary border-primary/30 gap-1.5 px-4 py-1.5 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  {approvedCount} arte(s) aprovada(s)
                </Badge>
              </div>
            )}

            <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Carregando histórico...
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma avaliação realizada ainda.
                </div>
              ) : (
                groups.map((group, gi) => {
                  const isApproved = group.finalStatus === 'approved';
                  const info = group.imageInfo;
                  const typeLabel = info
                    ? (IMAGE_TYPE_LABELS[info.image_type as ImageType] || info.image_type)
                    : 'Arte';
                  const hasMultiple = group.reviews.length > 1;
                  const isExpanded = expandedId === group.imageId;

                  return (
                    <motion.div
                      key={group.imageId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.03 }}
                      className="bg-card border border-border rounded-2xl overflow-hidden"
                    >
                      {/* Main row */}
                      <div
                        className={`p-4 flex items-center gap-3 ${hasMultiple ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                        onClick={() => hasMultiple && setExpandedId(isExpanded ? null : group.imageId)}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isApproved ? 'bg-primary/10' : 'bg-amber-500/10'
                        }`}>
                          {isApproved ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <XCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {info?.product_name || typeLabel}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isApproved ? '✅ Aprovada' : '⏳ Em revisão'}
                            {hasMultiple && (
                              <span className="ml-1.5 text-muted-foreground/70">
                                · {group.reviews.length} interações
                              </span>
                            )}
                          </p>
                        </div>
                        {hasMultiple && (
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </div>

                      {/* Expanded timeline */}
                      <AnimatePresence>
                        {isExpanded && hasMultiple && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 border-t border-border">
                              <div className="relative ml-4 pl-5 border-l-2 border-border space-y-3 pt-2">
                                {group.reviews.map((review, ri) => {
                                  const isApp = review.action === 'approved';
                                  return (
                                    <div key={review.id} className="relative">
                                      {/* Timeline dot */}
                                      <div className={`absolute -left-[1.4rem] top-0.5 w-3 h-3 rounded-full border-2 ${
                                        isApp
                                          ? 'bg-primary border-primary'
                                          : 'bg-amber-500 border-amber-500'
                                      }`} />
                                      <div>
                                        <p className="text-xs font-medium text-foreground">
                                          {isApp ? '✅ Aprovada' : '🔄 Refação solicitada'}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">
                                          {format(new Date(review.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                                        </p>
                                        {review.reviewer_comments && (
                                          <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                                            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span>{review.reviewer_comments}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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
