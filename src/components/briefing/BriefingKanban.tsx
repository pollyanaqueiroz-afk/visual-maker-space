import { useState, useMemo, useEffect, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RequestStatus, STATUS_LABELS, IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { AlertTriangle, AlertCircle, Send, Wrench } from 'lucide-react';
import { format } from 'date-fns';
import AssignBriefingDialog from '@/components/briefing/AssignBriefingDialog';

interface ImageWithRequest {
  id: string;
  image_type: string;
  product_name: string | null;
  image_text: string | null;
  status: RequestStatus;
  created_at: string;
  request_id: string;
  assigned_email: string | null;
  deadline: string | null;
  revision_count: number;
  requester_name: string;
  requester_email: string;
  platform_url: string;
  received_at: string;
  observations: string | null;
  extra_info: string | null;
  font_suggestion: string | null;
  element_suggestion: string | null;
  professional_photo_url: string | null;
  orientation: string | null;
  submitted_by: string | null;
}

const KANBAN_COLUMNS = [
  { key: 'adjustment', label: 'Solicitação de Ajustes', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-l-orange-500' },
  { key: 'pending', label: 'Pendente', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-l-amber-500' },
  { key: 'in_progress', label: 'Em Produção', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-l-blue-500' },
  { key: 'review', label: 'Aguardando Validação do Cliente', color: 'text-primary', bg: 'bg-primary/5', border: 'border-l-primary' },
  { key: 'revision', label: 'Em Refação', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-l-orange-400' },
  { key: 'completed', label: 'Aprovada', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-l-emerald-500' },
  { key: 'cancelled', label: 'Cancelada', color: 'text-destructive', bg: 'bg-destructive/5', border: 'border-l-destructive' },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  adjustment: ['pending', 'in_progress', 'cancelled'],
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'pending', 'cancelled'],
  review: ['completed', 'revision', 'cancelled'],
  revision: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: ['pending'],
};

interface KanbanCard {
  requestId: string;
  platformUrl: string;
  requesterName: string;
  totalImages: number;
  pendingImages: number;
  inProgressImages: number;
  reviewImages: number;
  completedImages: number;
  cancelledImages: number;
  status: string;
  assignedDesigners: string[];
  receivedAt: string;
  createdAt: string;
  imageTypes: string[];
  slaOverdue: boolean;
}

interface BriefingKanbanProps {
  images: ImageWithRequest[];
  loading?: boolean;
}

export default function BriefingKanban({ images, loading = false }: BriefingKanbanProps) {
  const queryClient = useQueryClient();
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ requestId: string; name: string; fromStatus: string; toStatus: string; isAdjustment?: boolean } | null>(null);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [editingAdjustment, setEditingAdjustment] = useState<any>(null);
  const [adjDesignerEmail, setAdjDesignerEmail] = useState('');
  const [adjDeadline, setAdjDeadline] = useState('');

  // Fetch adjustment requests for the Kanban
  const { data: adjustments = [] } = useQuery({
    queryKey: ['briefing-adjustments-kanban'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_adjustments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: adjustmentItems = [] } = useQuery({
    queryKey: ['briefing-adjustment-items-kanban'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_adjustment_items')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const kanbanCards = useMemo(() => {
    const requestMap: Record<string, ImageWithRequest[]> = {};
    images.forEach(img => {
      const rid = img.request_id;
      if (!requestMap[rid]) requestMap[rid] = [];
      requestMap[rid].push(img);
    });

    return Object.entries(requestMap).map(([requestId, imgs]) => {
      const first = imgs[0];
      const pendingCount = imgs.filter(i => i.status === 'pending').length;
      const inProgressCount = imgs.filter(i => i.status === 'in_progress').length;
      const reviewCount = imgs.filter(i => i.status === 'review').length;
      const completedCount = imgs.filter(i => i.status === 'completed').length;
      const cancelledCount = imgs.filter(i => i.status === 'cancelled').length;
      const revisionCount = imgs.filter(i => i.status === 'revision').length;

      let status = 'completed';
      if (cancelledCount === imgs.length) status = 'cancelled';
      else if (revisionCount > 0) status = 'revision';
      else if (pendingCount > 0) status = 'pending';
      else if (inProgressCount > 0) status = 'in_progress';
      else if (reviewCount > 0) status = 'review';

      const receivedAt = first.received_at || first.created_at;
      const daysSince = Math.floor((Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60 * 24));
      const slaOverdue = status !== 'completed' && status !== 'cancelled' && daysSince > 7;

      const designers = [...new Set(imgs.map(i => i.assigned_email).filter(Boolean))] as string[];
      const types = [...new Set(imgs.map(i => i.image_type))];

      return {
        requestId,
        platformUrl: first.platform_url,
        requesterName: first.requester_name,
        totalImages: imgs.length,
        pendingImages: pendingCount,
        inProgressImages: inProgressCount,
        reviewImages: reviewCount,
        completedImages: completedCount,
        cancelledImages: cancelledCount,
        status,
        assignedDesigners: designers,
        receivedAt,
        createdAt: first.created_at,
        imageTypes: types,
        slaOverdue,
      };
    });
  }, [images]);

  // Build adjustment cards — place them in their proper status column
  const adjustmentCards: (KanbanCard & { _isAdjustment?: boolean; _adjustmentData?: any })[] = useMemo(() => {
    return adjustments.map((a: any) => {
      const itemCount = adjustmentItems.filter((i: any) => i.adjustment_id === a.id).length;
      // Map adjustment statuses to kanban columns
      let kanbanStatus = 'adjustment';
      if (a.status === 'pending') kanbanStatus = 'adjustment'; // Not allocated
      else if (a.status === 'allocated') kanbanStatus = 'pending'; // Allocated but not started
      else if (a.status === 'in_progress') kanbanStatus = 'in_progress';
      else if (a.status === 'review') kanbanStatus = 'review';
      else if (a.status === 'revision') kanbanStatus = 'revision';
      else if (a.status === 'completed') kanbanStatus = 'completed';
      else if (a.status === 'cancelled') kanbanStatus = 'cancelled';

      return {
        requestId: a.id,
        platformUrl: a.client_url,
        requesterName: a.client_email,
        totalImages: itemCount,
        pendingImages: itemCount,
        inProgressImages: 0,
        reviewImages: 0,
        completedImages: 0,
        cancelledImages: 0,
        status: kanbanStatus,
        assignedDesigners: a.assigned_email ? [a.assigned_email] : [],
        receivedAt: a.created_at,
        createdAt: a.created_at,
        imageTypes: ['adjustment'],
        slaOverdue: false,
        _isAdjustment: true,
        _adjustmentData: a,
      };
    });
  }, [adjustments, adjustmentItems]);

  const kanbanColumns = useMemo(() => {
    const cols: Record<string, KanbanCard[]> = {};
    KANBAN_COLUMNS.forEach(c => { cols[c.key] = []; });

    // Add adjustment cards to their respective columns
    adjustmentCards.forEach(card => {
      if (cols[card.status]) cols[card.status].push(card);
    });

    kanbanCards.forEach(card => {
      if (cols[card.status]) cols[card.status].push(card);
    });
    Object.values(cols).forEach(col => col.sort((a, b) => {
      if (a.slaOverdue && !b.slaOverdue) return -1;
      if (!a.slaOverdue && b.slaOverdue) return 1;
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    }));
    return cols;
  }, [kanbanCards, adjustmentCards]);

  const handleKanbanDrop = async () => {
    if (!pendingDrop) return;
    const { requestId, toStatus, isAdjustment } = pendingDrop;
    try {
      if (isAdjustment) {
        // Update adjustment status
        const newStatus = toStatus === 'in_progress' ? 'in_progress' : toStatus;
        await supabase.from('briefing_adjustments').update({ status: newStatus } as any).eq('id', requestId);
        queryClient.invalidateQueries({ queryKey: ['briefing-adjustments-kanban'] });
        queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
      } else {
        const targetImages = images.filter(i => i.request_id === requestId && i.status !== 'completed');
        for (const img of targetImages) {
          await supabase.from('briefing_images').update({ status: toStatus } as any).eq('id', img.id);
        }
        queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
      }
      toast.success(`Solicitação movida para "${KANBAN_COLUMNS.find(c => c.key === toStatus)?.label}"`);
    } catch (err: any) {
      toast.error('Erro ao mover: ' + err.message);
    }
    setDropConfirmOpen(false);
    setPendingDrop(null);
  };

  const handleSaveAdjustment = async () => {
    if (!editingAdjustment) return;
    try {
      const updates: any = {};
      if (adjDesignerEmail.trim()) updates.assigned_email = adjDesignerEmail.trim();
      if (adjDeadline) updates.deadline = adjDeadline;
      if (adjDesignerEmail.trim() && editingAdjustment.status === 'pending') updates.status = 'allocated';
      
      await supabase.from('briefing_adjustments').update(updates).eq('id', editingAdjustment.id);
      queryClient.invalidateQueries({ queryKey: ['briefing-adjustments-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
      toast.success('Ajuste atualizado!');
      setEditingAdjustment(null);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleCancelRequest = async () => {
    if (!editingCard || !cancelMotivo.trim()) return;
    try {
      const targetImages = images.filter(i => i.request_id === editingCard.requestId && i.status !== 'completed');
      for (const img of targetImages) {
        await supabase.from('briefing_images').update({ status: 'cancelled' } as any).eq('id', img.id);
      }
      await supabase.from('briefing_requests').update({
        status: 'cancelled',
        notes: `Cancelado: ${cancelMotivo.trim()}`
      } as any).eq('id', editingCard.requestId);
      queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
      queryClient.invalidateQueries({ queryKey: ['briefing-requests'] });
      toast.success('Solicitação cancelada');
      setCancelConfirmOpen(false);
      setCancelMotivo('');
      setEditingCard(null);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const extractClientName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KANBAN_COLUMNS.filter(c => c.key !== 'cancelled').map(col => (
          <Card key={col.key}>
            <CardContent className="pt-3 pb-3 px-4">
              <p className={`text-2xl font-bold ${col.color}`}>{kanbanColumns[col.key]?.length || 0}</p>
              <p className="text-xs text-muted-foreground">{col.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1100px]">
            {KANBAN_COLUMNS.map(col => (
              <div key={col.key} className={`flex-1 min-w-[220px] rounded-lg p-3 ${col.bg}`}>
                <Skeleton className="h-5 w-24 mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      <div
        ref={topScrollRef}
        className="overflow-x-auto"
        style={{ overflowY: 'hidden' }}
        onScroll={() => { if (bottomScrollRef.current && topScrollRef.current) bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft; }}
      >
        <div style={{ width: 1100, height: 1 }} />
      </div>
      <div ref={bottomScrollRef} className="overflow-x-auto pb-4"
        onScroll={() => { if (topScrollRef.current && bottomScrollRef.current) topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft; }}
      >
        <div className="flex gap-4 min-w-[1100px]">
          {KANBAN_COLUMNS.map(col => (
            <div
              key={col.key}
              className={`flex-1 min-w-[220px] rounded-lg p-3 transition-colors ${col.bg} ${dragOverCol === col.key ? 'ring-2 ring-primary/50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverCol(null);
                const requestId = e.dataTransfer.getData('requestId');
                const fromStatus = e.dataTransfer.getData('fromStatus');
                const name = e.dataTransfer.getData('cardName');
                const isAdj = e.dataTransfer.getData('isAdjustment') === 'true';
                if (fromStatus === col.key) return;
                if (!VALID_TRANSITIONS[fromStatus]?.includes(col.key)) {
                  toast.error(`Não é possível mover de "${KANBAN_COLUMNS.find(c => c.key === fromStatus)?.label}" para "${col.label}"`);
                  return;
                }
                setPendingDrop({ requestId, name, fromStatus, toStatus: col.key, isAdjustment: isAdj });
                setDropConfirmOpen(true);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                <Badge variant="outline" className="text-xs">{kanbanColumns[col.key]?.length || 0}</Badge>
              </div>

              <div className="space-y-2">
                {(kanbanColumns[col.key] || []).map(card => {
                  const isAdj = (card as any)._isAdjustment === true;
                  // Conditional row colors
                  const rowBg = card.slaOverdue
                    ? 'bg-pink-50 dark:bg-pink-950/20'
                    : card.status === 'review'
                      ? 'bg-violet-50 dark:bg-violet-950/20'
                      : '';

                  // Deadline semaphore
                  const deadlineSemaphore = (() => {
                    if (card.status === 'completed' || card.status === 'cancelled' || isAdj) return null;
                    const days = Math.floor((Date.now() - new Date(card.receivedAt).getTime()) / (1000 * 60 * 60 * 24));
                    if (days > 7) return { color: 'text-destructive', dot: 'bg-destructive', label: `⚠️ SLA excedido (${days}d)` };
                    if (days > 5) return { color: 'text-amber-600', dot: 'bg-amber-500', label: `${7 - days}d restante(s)` };
                    return { color: 'text-emerald-600', dot: 'bg-emerald-500', label: `${7 - days}d restante(s)` };
                  })();

                  return (
                  <Card
                    key={card.requestId}
                    draggable={col.key !== 'completed'}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('requestId', card.requestId);
                      e.dataTransfer.setData('fromStatus', card.status);
                      e.dataTransfer.setData('cardName', card.requesterName || card.platformUrl);
                      e.dataTransfer.setData('isAdjustment', isAdj ? 'true' : 'false');
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${col.border} ${rowBg} ${col.key !== 'completed' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onClick={() => {
                      if (isAdj) {
                        const adjData = (card as any)._adjustmentData;
                        setEditingAdjustment(adjData);
                        setAdjDesignerEmail(adjData?.assigned_email || '');
                        setAdjDeadline(adjData?.deadline ? adjData.deadline.split('T')[0] : '');
                      } else {
                        setEditingCard(card);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        {isAdj && <Wrench className="h-3 w-3 text-orange-500 inline mr-1" />}
                        <p className="text-sm font-semibold truncate inline">{isAdj ? extractClientName(card.platformUrl) : (card.requesterName || 'Sem nome')}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{isAdj ? card.requesterName : extractClientName(card.platformUrl)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">
                          📅 {format(new Date(card.createdAt), 'dd/MM')}
                        </Badge>
                        {card.slaOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 animate-pulse" />}
                      </div>
                    </div>

                    {isAdj ? (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">Ajuste</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{card.totalImages} ajuste{card.totalImages !== 1 ? 's' : ''}</p>
                        {card.assignedDesigners.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{card.assignedDesigners[0]}</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {card.imageTypes.slice(0, 3).map(type => (
                            <Badge key={type} variant="outline" className="text-[9px] px-1 py-0">
                              {IMAGE_TYPE_LABELS[type as ImageType] || type}
                            </Badge>
                          ))}
                          {card.imageTypes.length > 3 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">+{card.imageTypes.length - 3}</Badge>
                          )}
                        </div>

                        <Progress value={card.totalImages > 0 ? (card.completedImages / card.totalImages) * 100 : 0} className="h-1.5 mt-2 mb-1" />

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{card.completedImages}/{card.totalImages} artes</span>
                          {card.assignedDesigners.length > 0 && (
                            <span className="truncate max-w-[100px]">{card.assignedDesigners[0]}</span>
                          )}
                        </div>

                        {deadlineSemaphore && (
                          <div className={`flex items-center gap-1.5 text-[10px] mt-1 ${deadlineSemaphore.color} font-medium`}>
                            <span className={`inline-block h-2 w-2 rounded-full ${deadlineSemaphore.dot}`} />
                            {deadlineSemaphore.label}
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                  );
                })}
                {(kanbanColumns[col.key] || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma solicitação</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* Drop confirm dialog */}
      <AlertDialog open={dropConfirmOpen} onOpenChange={setDropConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Mover <strong>{pendingDrop?.name}</strong> de{' '}
              <strong>{KANBAN_COLUMNS.find(c => c.key === pendingDrop?.fromStatus)?.label}</strong>{' '}
              para{' '}
              <strong>{KANBAN_COLUMNS.find(c => c.key === pendingDrop?.toStatus)?.label}</strong>?
              {pendingDrop?.toStatus === 'cancelled' && (
                <span className="block mt-2 text-destructive">Todas as artes desta solicitação serão canceladas.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={handleKanbanDrop}>Confirmar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit card dialog */}
      <Dialog open={!!editingCard} onOpenChange={(v) => { if (!v) setEditingCard(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          {editingCard && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle>{editingCard.requesterName || extractClientName(editingCard.platformUrl)}</DialogTitle>
                <p className="text-xs text-muted-foreground">{editingCard.platformUrl}</p>
              </DialogHeader>

              <div className="flex-1 min-h-0 overflow-y-auto pr-2">
                <div className="space-y-4 pb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                      {STATUS_LABELS[editingCard.status as RequestStatus] || editingCard.status}
                    </Badge>
                    {editingCard.receivedAt && (
                      <span className="text-xs text-muted-foreground">
                        Recebido em {format(new Date(editingCard.receivedAt), 'dd/MM/yyyy')}
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Artes ({editingCard.totalImages})</p>
                    <div className="space-y-2">
                      {images.filter(i => i.request_id === editingCard.requestId).map(img => (
                        <div key={img.id} className="flex items-center justify-between p-2 rounded border text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}
                              {img.product_name ? ` — ${img.product_name}` : ''}
                            </p>
                            {img.assigned_email && <p className="text-[10px] text-muted-foreground">{img.assigned_email}</p>}
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 ml-2">
                            {STATUS_LABELS[img.status as RequestStatus] || img.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {editingCard.assignedDesigners.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Designers</p>
                      <div className="flex flex-wrap gap-1">
                        {editingCard.assignedDesigners.map(d => (
                          <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edit designer per art */}
                  {editingCard.status !== 'cancelled' && editingCard.status !== 'completed' && (
                    <div>
                      <Separator className="mb-3" />
                      <p className="text-sm font-medium mb-2">Alterar Designer Responsável</p>
                      <div className="space-y-2">
                        {images.filter(i => i.request_id === editingCard.requestId && i.status !== 'completed' && i.status !== 'cancelled').map(img => (
                          <div key={img.id} className="flex items-center gap-2 p-2 rounded border">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-medium truncate">
                                {IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}
                                {img.product_name ? ` — ${img.product_name}` : ''}
                              </p>
                            </div>
                            <Input
                              type="email"
                              className="h-7 text-xs w-40"
                              placeholder="designer@email.com"
                              defaultValue={img.assigned_email || ''}
                              onBlur={async (e) => {
                                const newEmail = e.target.value.trim();
                                if (newEmail === (img.assigned_email || '')) return;
                                try {
                                  await supabase.from('briefing_images').update({ assigned_email: newEmail || null } as any).eq('id', img.id);
                                  queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
                                  toast.success(`Designer atualizado`);
                                } catch (err: any) {
                                  toast.error('Erro ao atualizar');
                                }
                              }}
                              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            />
                            <AssignBriefingDialog
                              imageId={img.id}
                              currentEmail={img.assigned_email}
                              currentDeadline={img.deadline}
                              imageLabel={`${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${img.product_name ? ` — ${img.product_name}` : ''}`}
                              onAssigned={() => {
                                queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Edite o email ou clique no ícone de envio para alocar com prazo + preço
                      </p>
                    </div>
                  )}

                  {/* Cancel section */}
                  {editingCard.status !== 'cancelled' && editingCard.status !== 'completed' && (
                    <div>
                      <Separator className="mb-3" />
                      <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div>
                          <p className="text-sm font-medium text-destructive">Cancelar solicitação</p>
                          <p className="text-[10px] text-muted-foreground">Cancela todas as artes desta solicitação</p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => setCancelConfirmOpen(true)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm dialog */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cancelar solicitação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Cancelar todas as artes de <strong>{editingCard?.requesterName || editingCard?.platformUrl}</strong>?
                </p>
                <div className="space-y-1">
                  <Label className="text-sm">Motivo do cancelamento</Label>
                  <Textarea
                    placeholder="Informe o motivo..."
                    value={cancelMotivo}
                    onChange={(e) => setCancelMotivo(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelMotivo('')}>Manter</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!cancelMotivo.trim()}
              onClick={handleCancelRequest}
            >
              Confirmar cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adjustment detail dialog */}
      <Dialog open={!!editingAdjustment} onOpenChange={(v) => { if (!v) setEditingAdjustment(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          {editingAdjustment && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Solicitação de Ajuste
                </DialogTitle>
                <p className="text-xs text-muted-foreground">{editingAdjustment.client_url}</p>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">E-mail do Cliente</p>
                    <p className="text-sm">{editingAdjustment.client_email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Data da Solicitação</p>
                    <p className="text-sm">{format(new Date(editingAdjustment.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <Separator />

                {/* Items */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Ajustes ({adjustmentItems.filter((i: any) => i.adjustment_id === editingAdjustment.id).length})
                  </p>
                  <div className="space-y-2">
                    {adjustmentItems
                      .filter((i: any) => i.adjustment_id === editingAdjustment.id)
                      .map((item: any) => (
                        <Card key={item.id}>
                          <CardContent className="py-2 px-3">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <a href={item.file_url} target="_blank" rel="noopener noreferrer">
                                <img src={item.file_url} alt="" className="w-full h-20 object-cover rounded border hover:opacity-80 transition-opacity" />
                              </a>
                              <p className="text-xs whitespace-pre-wrap">{item.observations || 'Sem observações'}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                <Separator />

                {/* Assign designer + deadline */}
                <div className="space-y-3">
                  <p className="text-sm font-medium">Alocar para Produção</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Designer Responsável</Label>
                    <Input
                      type="email"
                      placeholder="designer@email.com"
                      value={adjDesignerEmail}
                      onChange={(e) => setAdjDesignerEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Prazo de Entrega</Label>
                    <Input
                      type="date"
                      value={adjDeadline}
                      onChange={(e) => setAdjDeadline(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleSaveAdjustment} className="w-full gap-2">
                    <Send className="h-4 w-4" />
                    Salvar e Alocar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
