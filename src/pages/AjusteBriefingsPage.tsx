import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Upload, Trash2, Send, Eye, Clock, UserCheck, CheckCircle, Loader2, ExternalLink, Copy, Mail, Edit2, Save, Link2, LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';

interface AdjustmentItem {
  file: File | null;
  filePreview: string;
  observations: string;
  linkUrl: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Solicitação de Ajuste', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20', icon: Clock },
  allocated: { label: 'Pendente', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20', icon: UserCheck },
  in_progress: { label: 'Em Produção', color: 'bg-violet-500/15 text-violet-600 border-violet-500/20', icon: Loader2 },
  review: { label: 'Aguardando Validação do Cliente', color: 'bg-orange-500/15 text-orange-600 border-orange-500/20', icon: Eye },
  revision: { label: 'Em Refação', color: 'bg-rose-500/15 text-rose-600 border-rose-500/20', icon: Clock },
  completed: { label: 'Aprovada', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-600 border-red-500/20', icon: Clock },
};

export default function AjusteBriefingsPage() {
  const { user } = useAuth();
  const { hasRole } = usePermissions();
  const isAdmin = hasRole('admin');
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [items, setItems] = useState<AdjustmentItem[]>([{ file: null, filePreview: '', observations: '', linkUrl: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [detailAdjustment, setDetailAdjustment] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedBriefingImageId, setSelectedBriefingImageId] = useState<string>('');

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['briefing-adjustments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_adjustments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ['briefing-adjustment-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_adjustment_items')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch briefing images matching the client URL for linking
  const { data: matchingBriefingImages = [] } = useQuery({
    queryKey: ['briefing-images-for-linking', clientUrl],
    queryFn: async () => {
      if (!clientUrl.trim()) return [];
      const { data, error } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, status, briefing_requests!inner(platform_url)')
        .ilike('briefing_requests.platform_url', `%${clientUrl.trim().replace(/https?:\/\//, '').replace(/\/$/, '')}%`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    enabled: !!clientUrl.trim() && clientUrl.trim().length > 5,
  });

  const addItem = () => {
    setItems(prev => [...prev, { file: null, filePreview: '', observations: '', linkUrl: '' }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof AdjustmentItem, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'file') {
        const file = value as File;
        return { ...item, file, filePreview: file ? URL.createObjectURL(file) : '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const resetForm = () => {
    setClientUrl('');
    setClientEmail('');
    setItems([{ file: null, filePreview: '', observations: '', linkUrl: '' }]);
    setSelectedBriefingImageId('');
  };

  const handleSubmit = async () => {
    if (!clientUrl.trim()) { toast.error('Informe a URL do cliente'); return; }
    if (!clientEmail.trim()) { toast.error('Informe o e-mail do cliente'); return; }
    const validItems = items.filter(i => i.file || i.linkUrl.trim());
    if (validItems.length === 0) { toast.error('Adicione pelo menos uma imagem ou link'); return; }

    setSubmitting(true);
    try {
      // Create adjustment record
      const insertPayload: any = {
        client_url: clientUrl.trim(),
        client_email: clientEmail.trim(),
        created_by: user?.id,
      };
      if (selectedBriefingImageId) {
        insertPayload.source_briefing_image_id = selectedBriefingImageId;
      }

      const { data: adjustment, error: adjError } = await supabase
        .from('briefing_adjustments')
        .insert(insertPayload)
        .select()
        .single();

      if (adjError) throw adjError;

      // Upload files in parallel batches of 5
      let successCount = 0;
      let failCount = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batch = validItems.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            let fileUrl: string;
            let fileName: string;

            if (item.file) {
              const file = item.file;
              const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
              const filePath = `adjustments/${adjustment.id}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
              
              const { error: uploadError } = await supabase.storage
                .from('briefing-uploads')
                .upload(filePath, file);

              if (uploadError) {
                console.error('Upload failed:', file.name, uploadError);
                throw uploadError;
              }

              const { data: urlData } = supabase.storage
                .from('briefing-uploads')
                .getPublicUrl(filePath);

              fileUrl = urlData.publicUrl;
              fileName = file.name;
            } else {
              // Link-only item
              fileUrl = item.linkUrl.trim();
              fileName = `Link: ${fileUrl}`;
            }

            const { error: insertError } = await supabase.from('briefing_adjustment_items').insert({
              adjustment_id: adjustment.id,
              file_url: fileUrl,
              file_name: fileName,
              observations: item.observations || null,
            } as any);

            if (insertError) {
              console.error('Insert failed:', fileName, insertError);
              throw insertError;
            }
          })
        );

        results.forEach(r => {
          if (r.status === 'fulfilled') successCount++;
          else failCount++;
        });
      }

      if (successCount > 0) {
        if (failCount > 0) {
          toast.warning(`${successCount} de ${validItems.length} imagens enviadas. ${failCount} falharam.`);
        } else {
          toast.success(`Solicitação registrada com ${successCount} imagem(ns)!`);
        }
        resetForm();
        setFormOpen(false);
        queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
        queryClient.invalidateQueries({ queryKey: ['briefing-adjustment-items'] });
      } else {
        toast.error('Nenhuma imagem foi enviada com sucesso. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error('Erro ao registrar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = (adj: any) => {
    setDetailAdjustment(adj);
    setDetailItems(allItems.filter((i: any) => i.adjustment_id === adj.id));
  };

  const extractClientName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
    } catch {
      return url;
    }
  };

  const getItemCount = (adjId: string) => allItems.filter((i: any) => i.adjustment_id === adjId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ajuste de Briefings</h1>
          <p className="text-sm text-muted-foreground">Solicite e acompanhe ajustes em artes já produzidas</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Solicitar Ajuste
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_MAP).map(([key, { label, color }]) => {
          const count = adjustments.filter((a: any) => a.status === key).length;
          return (
            <Card key={key}>
              <CardContent className="pt-3 pb-3 px-4">
                <p className="text-2xl font-bold">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Adjustments list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : adjustments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhuma solicitação de ajuste registrada.</p>
            <p className="text-sm mt-1">Clique em "Solicitar Ajuste" para criar a primeira.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {adjustments.map((adj: any) => {
            const statusInfo = STATUS_MAP[adj.status] || STATUS_MAP.pending;
            const StatusIcon = statusInfo.icon;
            const itemCount = getItemCount(adj.id);
            return (
              <Card
                key={adj.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetail(adj)}
              >
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{extractClientName(adj.client_url)}</p>
                        <p className="text-xs text-muted-foreground truncate">{adj.client_url}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-xs">{itemCount} ajuste{itemCount !== 1 ? 's' : ''}</Badge>
                      <Badge className={`text-xs border ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(adj.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) resetForm(); setFormOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Solicitar Ajuste de Briefing</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-6">
            {/* Section 1 - Client identification */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Identificação do Cliente</h3>
                <p className="text-xs text-muted-foreground">Informe os dados do cliente</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>URL do Cliente <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="https://cliente.curseduca.pro"
                    value={clientUrl}
                    onChange={(e) => setClientUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail do Cliente <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    placeholder="cliente@email.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

             {/* Section 1b - Link to briefing image */}
             {matchingBriefingImages.length > 0 && (
               <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                 <div className="flex items-center gap-2">
                   <LinkIcon className="h-4 w-4 text-primary" />
                   <Label className="text-sm font-semibold text-primary">Vincular a uma Arte do Briefing</Label>
                 </div>
                 <p className="text-xs text-muted-foreground">Opcional: vincule este ajuste a uma arte existente para rastrear como refação</p>
                 <Select value={selectedBriefingImageId} onValueChange={setSelectedBriefingImageId}>
                   <SelectTrigger className="w-full">
                     <SelectValue placeholder="Selecione a arte original (opcional)" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">Nenhuma (ajuste avulso)</SelectItem>
                     {matchingBriefingImages.map((img: any) => {
                       const typeLabel = IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type;
                       return (
                         <SelectItem key={img.id} value={img.id}>
                           {typeLabel}{img.product_name ? ` — ${img.product_name}` : ''} ({img.status})
                         </SelectItem>
                       );
                     })}
                   </SelectContent>
                 </Select>
               </div>
             )}

             <Separator />

             {/* Section 2 - Adjustment items */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pedidos de Ajuste</h3>
                <p className="text-xs text-muted-foreground">Envie as artes que precisam de ajuste com as observações</p>
              </div>

              {items.map((item, index) => (
                <Card key={index} className="relative">
                  <CardContent className="pt-4 pb-4 px-4">
                    {items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Arte atual (arquivo ou link)</Label>
                        {item.filePreview ? (
                          <div className="relative">
                            <img
                              src={item.filePreview}
                              alt="Preview"
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                              onClick={() => updateItem(index, 'file', null)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Upload de imagem</span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.ai,.psd,.svg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateItem(index, 'file', file);
                              }}
                            />
                          </label>
                        )}
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input
                            placeholder="Ou cole um link (Google Drive, etc.)"
                            value={item.linkUrl}
                            onChange={(e) => updateItem(index, 'linkUrl', e.target.value)}
                            className="h-8 text-xs"
                            disabled={!!item.file}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Observação do ajuste</Label>
                        <Textarea
                          placeholder="Descreva qual alteração o cliente solicitou..."
                          value={item.observations}
                          onChange={(e) => updateItem(index, 'observations', e.target.value)}
                          className="h-[152px] resize-none"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addItem} className="w-full gap-2">
                <Plus className="h-4 w-4" />
                Adicionar novo pedido de ajuste
              </Button>
            </div>
          </div>

          <div className="shrink-0 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Registrar solicitação de ajuste
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!detailAdjustment} onOpenChange={(v) => { if (!v) { setDetailAdjustment(null); setEditingEmail(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {detailAdjustment && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle>Detalhes do Ajuste</DialogTitle>
                <p className="text-xs text-muted-foreground">{detailAdjustment.client_url}</p>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs border ${(STATUS_MAP[detailAdjustment.status] || STATUS_MAP.pending).color}`}>
                    {(STATUS_MAP[detailAdjustment.status] || STATUS_MAP.pending).label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Criado em {format(new Date(detailAdjustment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">E-mail do Cliente</p>
                    {editingEmail ? (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="novo@email.com"
                        />
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 gap-1"
                          disabled={savingEmail}
                          onClick={async () => {
                            if (!editEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
                              toast.error('E-mail inválido');
                              return;
                            }
                            setSavingEmail(true);
                            try {
                              const { error } = await supabase
                                .from('briefing_adjustments')
                                .update({ client_email: editEmail.trim() } as any)
                                .eq('id', detailAdjustment.id);
                              if (error) throw error;
                              setDetailAdjustment({ ...detailAdjustment, client_email: editEmail.trim() });
                              setEditingEmail(false);
                              queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
                              toast.success('E-mail atualizado!');
                            } catch (err: any) {
                              toast.error('Erro: ' + err.message);
                            } finally {
                              setSavingEmail(false);
                            }
                          }}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingEmail(false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm">{detailAdjustment.client_email}</p>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => { setEditEmail(detailAdjustment.client_email); setEditingEmail(true); }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {detailAdjustment.assigned_email && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Designer Responsável</p>
                      <p className="text-sm">{detailAdjustment.assigned_email}</p>
                    </div>
                  )}
                </div>

                {/* Linked briefing image */}
                {detailAdjustment.source_briefing_image_id && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <LinkIcon className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary">Vinculado a Arte do Briefing</p>
                      <p className="text-[11px] text-muted-foreground truncate">ID: {detailAdjustment.source_briefing_image_id.slice(0, 8)}…</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Refação</Badge>
                  </div>
                )}

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-3">Ajustes Solicitados ({detailItems.length})</p>
                  <div className="space-y-3">
                    {detailItems.map((item: any) => (
                      <Card key={item.id}>
                        <CardContent className="py-3 px-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="block">
                                <img
                                  src={item.file_url}
                                  alt={item.file_name || 'Ajuste'}
                                  className="w-full h-28 object-cover rounded-lg border hover:opacity-80 transition-opacity"
                                />
                              </a>
                              {item.file_name && (
                                <p className="text-[10px] text-muted-foreground mt-1 truncate">{item.file_name}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Observação</p>
                              <p className="text-sm whitespace-pre-wrap">{item.observations || 'Sem observações'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Delivery section - shows when designer has delivered */}
                {(detailAdjustment.status === 'review' || detailAdjustment.status === 'completed') && detailAdjustment.delivery_url && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        Entrega do Designer
                      </p>
                      <Card>
                        <CardContent className="py-3 px-4 space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Arte Entregue</p>
                            <a href={detailAdjustment.delivery_url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={detailAdjustment.delivery_url}
                                alt="Entrega"
                                className="w-full max-h-48 object-contain rounded-lg border hover:opacity-80 transition-opacity bg-muted"
                              />
                            </a>
                          </div>
                          {detailAdjustment.delivery_comments && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">Comentário do Designer</p>
                              <p className="text-sm">{detailAdjustment.delivery_comments}</p>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {detailAdjustment.delivered_by && (
                              <span>Entregue por: {detailAdjustment.delivered_by}</span>
                            )}
                            {detailAdjustment.delivered_at && (
                              <span>em {format(new Date(detailAdjustment.delivered_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                )}

                {/* Actions section for review/completed status */}
                {(detailAdjustment.status === 'review' || detailAdjustment.status === 'completed') && detailAdjustment.delivery_url && (
                  <div className="space-y-3 p-3 rounded-lg border border-primary/20 bg-primary/5">
                    <p className="text-sm font-medium">Ações do Operacional</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Generate review link */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          const link = detailAdjustment.delivery_url;
                          navigator.clipboard.writeText(link);
                          toast.success('Link da arte copiado!');
                        }}
                      >
                        <Link2 className="h-3 w-3" /> Copiar Link da Arte
                      </Button>

                      {/* Resend access to client */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={resending}
                        onClick={async () => {
                          setResending(true);
                          try {
                            const { error } = await supabase.functions.invoke('delivery-data', {
                              body: {
                                action: 'resend_adjustment_notification',
                                adjustment_id: detailAdjustment.id,
                              },
                            });
                            if (error) throw error;
                            toast.success(`E-mail reenviado para ${detailAdjustment.client_email}`);
                          } catch (err: any) {
                            toast.error('Erro ao reenviar: ' + err.message);
                          } finally {
                            setResending(false);
                          }
                        }}
                      >
                        {resending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        Reenviar para Cliente
                      </Button>

                      {/* Mark as completed if still in review */}
                      {detailAdjustment.status === 'review' && (
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={async () => {
                            try {
                              const { error } = await supabase
                                .from('briefing_adjustments')
                                .update({ status: 'completed' } as any)
                                .eq('id', detailAdjustment.id);
                              if (error) throw error;
                              setDetailAdjustment({ ...detailAdjustment, status: 'completed' });
                              queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
                              toast.success('Ajuste marcado como concluído!');
                            } catch (err: any) {
                              toast.error('Erro: ' + err.message);
                            }
                          }}
                        >
                          <CheckCircle className="h-3 w-3" /> Marcar como Concluído
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Admin delete - always visible */}
                {isAdmin && (
                  <div className="pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1 w-full"
                      disabled={deleting}
                      onClick={async () => {
                        if (!confirm('Tem certeza que deseja excluir esta solicitação e todos os seus itens?')) return;
                        setDeleting(true);
                        try {
                          // Delete items first
                          await supabase
                            .from('briefing_adjustment_items')
                            .delete()
                            .eq('adjustment_id', detailAdjustment.id);
                          // Delete adjustment
                          const { error } = await supabase
                            .from('briefing_adjustments')
                            .delete()
                            .eq('id', detailAdjustment.id);
                          if (error) throw error;
                          toast.success('Solicitação excluída!');
                          setDetailAdjustment(null);
                          queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
                          queryClient.invalidateQueries({ queryKey: ['briefing-adjustment-items'] });
                        } catch (err: any) {
                          toast.error('Erro ao excluir: ' + err.message);
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Excluir Solicitação
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
