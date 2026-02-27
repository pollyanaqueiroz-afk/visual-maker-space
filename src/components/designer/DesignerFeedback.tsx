import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IMAGE_TYPE_LABELS } from '@/types/briefing';
import { MessageSquare, CheckCircle, XCircle, TrendingUp, AlertTriangle, ThumbsUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

interface FeedbackRecord {
  id: string;
  action: string;
  reviewer_comments: string | null;
  reviewed_by: string;
  created_at: string;
  briefing_image_id: string;
  image_type: string | null;
  product_name: string | null;
  requester_name: string | null;
}

interface Props {
  designerEmail: string;
}

export default function DesignerFeedback({ designerEmail }: Props) {
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedbacks();
  }, [designerEmail]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('designer-data', {
        body: { email: designerEmail },
      });

      if (error) throw error;

      const imgs = result?.feedbackImages || [];
      const reviews = result?.reviews || [];

      if (imgs.length === 0) {
        setFeedbacks([]);
        setLoading(false);
        return;
      }

      const imageMap = new Map(imgs.map((i: any) => [i.id, i]));

      const enriched: FeedbackRecord[] = reviews.map((r: any) => {
        const img = imageMap.get(r.briefing_image_id) as any;
        return {
          ...r,
          image_type: img?.image_type || null,
          product_name: img?.product_name || null,
          requester_name: img?.briefing_requests?.requester_name || null,
        };
      });

      setFeedbacks(enriched);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  const approvedCount = feedbacks.filter(f => f.action === 'approved').length;
  const revisionCount = feedbacks.filter(f => f.action === 'revision_requested').length;
  const totalCount = approvedCount + revisionCount;
  const approvalRate = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0;

  // Extract common themes from revision comments
  const revisionComments = feedbacks
    .filter(f => f.action === 'revision_requested' && f.reviewer_comments)
    .map(f => f.reviewer_comments!);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando feedbacks...
        </CardContent>
      </Card>
    );
  }

  if (feedbacks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Nenhum feedback recebido ainda.</p>
          <p className="text-muted-foreground text-xs mt-1">Os feedbacks dos clientes aparecerão aqui após as validações.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ThumbsUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground leading-none">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Aprovações</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground leading-none">{revisionCount}</p>
                <p className="text-xs text-muted-foreground">Refações pedidas</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-5 pb-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                approvalRate >= 80 ? 'bg-primary/10' : approvalRate >= 50 ? 'bg-amber-500/10' : 'bg-destructive/10'
              }`}>
                <TrendingUp className={`h-5 w-5 ${
                  approvalRate >= 80 ? 'text-primary' : approvalRate >= 50 ? 'text-amber-500' : 'text-destructive'
                }`} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-foreground leading-none">{approvalRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de aprovação</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revision comments - learning section */}
      {revisionComments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-destructive" />
              Feedbacks de Refação — Pontos de Melhoria
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Analise os comentários dos clientes para identificar padrões e evoluir suas entregas.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {feedbacks
              .filter(f => f.action === 'revision_requested' && f.reviewer_comments)
              .map((f, i) => {
                const typeLabel = f.image_type
                  ? (IMAGE_TYPE_LABELS[f.image_type as keyof typeof IMAGE_TYPE_LABELS] || f.image_type)
                  : 'Arte';

                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-destructive/5 border border-destructive/10 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <span className="text-xs font-semibold text-foreground">
                        {f.product_name || typeLabel}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {typeLabel}
                      </Badge>
                      {f.requester_name && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          por {f.requester_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">
                      "{f.reviewer_comments}"
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(f.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </motion.div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Recent approvals */}
      {approvedCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Últimas Aprovações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[300px] overflow-y-auto">
            {feedbacks
              .filter(f => f.action === 'approved')
              .slice(0, 20)
              .map((f, i) => {
                const typeLabel = f.image_type
                  ? (IMAGE_TYPE_LABELS[f.image_type as keyof typeof IMAGE_TYPE_LABELS] || f.image_type)
                  : 'Arte';

                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3"
                  >
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {f.product_name || typeLabel}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {f.requester_name && `${f.requester_name} • `}
                        {format(new Date(f.created_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                      {typeLabel}
                    </Badge>
                  </motion.div>
                );
              })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
