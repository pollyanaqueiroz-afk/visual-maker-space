import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Upload, Trash2, Send, Eye, Clock, UserCheck, CheckCircle, Loader2, ExternalLink, Copy, Mail, Edit2, Save, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdjustmentItem {
  file: File | null;
  filePreview: string;
  observations: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Aguardando Alocação', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20', icon: Clock },
  allocated: { label: 'Alocado para Design', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20', icon: UserCheck },
  in_progress: { label: 'Em Execução', color: 'bg-violet-500/15 text-violet-600 border-violet-500/20', icon: Loader2 },
  review: { label: 'Em Revisão', color: 'bg-orange-500/15 text-orange-600 border-orange-500/20', icon: Eye },
  completed: { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20', icon: CheckCircle },
};

export default function AjusteBriefingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [items, setItems] = useState<AdjustmentItem[]>([{ file: null, filePreview: '', observations: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [detailAdjustment, setDetailAdjustment] = useState<any>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [resending, setResending] = useState(false);

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

  const addItem = () => {
    setItems(prev => [...prev, { file: null, filePreview: '', observations: '' }]);
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
    setItems([{ file: null, filePreview: '', observations: '' }]);
  };

  const handleSubmit = async () => {
    if (!clientUrl.trim()) { toast.error('Informe a URL do cliente'); return; }
    if (!clientEmail.trim()) { toast.error('Informe o e-mail do cliente'); return; }
    const validItems = items.filter(i => i.file);
    if (validItems.length === 0) { toast.error('Adicione pelo menos uma imagem'); return; }

    setSubmitting(true);
    try {
      // Create adjustment record
      const { data: adjustment, error: adjError } = await supabase
        .from('briefing_adjustments')
        .insert({
          client_url: clientUrl.trim(),
          client_email: clientEmail.trim(),
          created_by: user?.id,
        } as any)
        .select()
        .single();

      if (adjError) throw adjError;

      // Upload files and create items
      for (const item of validItems) {
        const file = item.file!;
        const filePath = `adjustments/${adjustment.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('briefing-uploads')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('briefing-uploads')
          .getPublicUrl(filePath);

        await supabase.from('briefing_adjustment_items').insert({
          adjustment_id: adjustment.id,
          file_url: urlData.publicUrl,
          file_name: file.name,
          observations: item.observations || null,
        } as any);
      }

      toast.success('Solicitação de ajuste registrada!');
      resetForm();
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['briefing-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['briefing-adjustment-items'] });
    } catch (err: any) {
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
                        <Label className="text-xs">Arte atual</Label>
                        {item.filePreview ? (
                          <div className="relative">
                            <img
                              src={item.filePreview}
                              alt="Preview"
                              className="w-full h-32 object-cover rounded-lg border"
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
                          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">Clique para enviar</span>
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
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Observação do ajuste</Label>
                        <Textarea
                          placeholder="Descreva qual alteração o cliente solicitou..."
                          value={item.observations}
                          onChange={(e) => updateItem(index, 'observations', e.target.value)}
                          className="h-32 resize-none"
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
      <Dialog open={!!detailAdjustment} onOpenChange={(v) => { if (!v) setDetailAdjustment(null); }}>
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
                    <p className="text-sm">{detailAdjustment.client_email}</p>
                  </div>
                  {detailAdjustment.assigned_email && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Designer Responsável</p>
                      <p className="text-sm">{detailAdjustment.assigned_email}</p>
                    </div>
                  )}
                </div>

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

                {/* Link to client review when completed */}
                {detailAdjustment.status === 'completed' && (
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-sm font-medium text-emerald-600 mb-1">Artes finalizadas</p>
                    <p className="text-xs text-muted-foreground">
                      Encaminhe o link de revisão para o cliente em <strong>{detailAdjustment.client_email}</strong>
                    </p>
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
