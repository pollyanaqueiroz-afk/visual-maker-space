import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
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
import { AlertTriangle, AlertCircle, Send } from 'lucide-react';
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
  { key: 'pending', label: 'Pendentes', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-l-amber-500' },
  { key: 'in_progress', label: 'Em Produção', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-l-blue-500' },
  { key: 'review', label: 'Em Revisão', color: 'text-primary', bg: 'bg-primary/5', border: 'border-l-primary' },
  { key: 'completed', label: 'Concluídas', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-l-emerald-500' },
  { key: 'cancelled', label: 'Canceladas', color: 'text-destructive', bg: 'bg-destructive/5', border: 'border-l-destructive' },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['review', 'pending', 'cancelled'],
  review: ['completed', 'in_progress', 'cancelled'],
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
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{ requestId: string; name: string; fromStatus: string; toStatus: string } | null>(null);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');

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

      let status = 'completed';
      if (cancelledCount === imgs.length) status = 'cancelled';
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

  const kanbanColumns = useMemo(() => {
    const cols: Record<string, KanbanCard[]> = {};
    KANBAN_COLUMNS.forEach(c => { cols[c.key] = []; });
    kanbanCards.forEach(card => {
      if (cols[card.status]) cols[card.status].push(card);
    });
    Object.values(cols).forEach(col => col.sort((a, b) => {
      if (a.slaOverdue && !b.slaOverdue) return -1;
      if (!a.slaOverdue && b.slaOverdue) return 1;
      return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    }));
    return cols;
  }, [kanbanCards]);

  const handleKanbanDrop = async () => {
    if (!pendingDrop) return;
    const { requestId, toStatus } = pendingDrop;
    try {
      const targetImages = images.filter(i => i.request_id === requestId && i.status !== 'completed');
      for (const img of targetImages) {
        await supabase.from('briefing_images').update({ status: toStatus } as any).eq('id', img.id);
      }
      queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
      toast.success(`Solicitação movida para "${KANBAN_COLUMNS.find(c => c.key === toStatus)?.label}"`);
    } catch (err: any) {
      toast.error('Erro ao mover: ' + err.message);
    }
    setDropConfirmOpen(false);
    setPendingDrop(null);
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

      {/* Kanban board */}
      <div className="overflow-x-auto pb-4">
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
                if (fromStatus === col.key) return;
                if (!VALID_TRANSITIONS[fromStatus]?.includes(col.key)) {
                  toast.error(`Não é possível mover de "${KANBAN_COLUMNS.find(c => c.key === fromStatus)?.label}" para "${col.label}"`);
                  return;
                }
                setPendingDrop({ requestId, name, fromStatus, toStatus: col.key });
                setDropConfirmOpen(true);
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                <Badge variant="outline" className="text-xs">{kanbanColumns[col.key]?.length || 0}</Badge>
              </div>

              <div className="space-y-2">
                {(kanbanColumns[col.key] || []).map(card => (
                  <Card
                    key={card.requestId}
                    draggable={col.key !== 'completed'}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('requestId', card.requestId);
                      e.dataTransfer.setData('fromStatus', card.status);
                      e.dataTransfer.setData('cardName', card.requesterName || card.platformUrl);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${col.border} ${card.slaOverdue ? 'bg-destructive/5' : ''} ${col.key !== 'completed' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onClick={() => setEditingCard(card)}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{card.requesterName || 'Sem nome'}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{extractClientName(card.platformUrl)}</p>
                      </div>
                      {card.slaOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                    </div>

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

                    {card.receivedAt && card.status !== 'completed' && card.status !== 'cancelled' && (() => {
                      const days = Math.floor((Date.now() - new Date(card.receivedAt).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <p className={`text-[10px] mt-1 ${days > 7 ? 'text-destructive font-medium' : days > 5 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {days > 7 ? `⚠️ SLA excedido (${days}d)` : `${7 - days}d restante(s) no SLA`}
                        </p>
                      );
                    })()}
                  </Card>
                ))}
                {(kanbanColumns[col.key] || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma solicitação</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          {editingCard && (
            <>
              <DialogHeader>
                <DialogTitle>{editingCard.requesterName || extractClientName(editingCard.platformUrl)}</DialogTitle>
                <p className="text-xs text-muted-foreground">{editingCard.platformUrl}</p>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
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
              </ScrollArea>
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
    </div>
  );
}
