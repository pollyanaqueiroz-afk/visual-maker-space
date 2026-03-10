import { useState, useEffect, useMemo, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IMAGE_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types/briefing';
import { Loader2, Clock, ExternalLink, FileImage, Filter, MessageSquare, BarChart3, LogOut, Eye, Globe, Image, Wrench, Upload, Sparkles, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import CursEducaLayout from '@/components/CursEducaLayout';
import DesignerFeedback from '@/components/designer/DesignerFeedback';
import DesignerAnalytics from '@/components/designer/DesignerAnalytics';
import { EmptyState } from '@/components/ui/EmptyState';

interface DesignerImage {
  id: string;
  image_type: string;
  product_name: string | null;
  deadline: string | null;
  status: string;
  revision_count: number;
  delivery_token: string | null;
  extra_info: string | null;
  image_text: string | null;
  font_suggestion: string | null;
  element_suggestion: string | null;
  orientation: string | null;
  observations: string | null;
  professional_photo_url: string | null;
  briefing_requests: {
    requester_name: string;
    platform_url: string;
  };
  _source?: 'briefing' | 'adjustment';
  _adjustment_id?: string;
}

interface ReferenceImage {
  id: string;
  briefing_image_id: string;
  file_url: string;
  is_exact_use: boolean;
}

interface AdjustmentItem {
  id: string;
  adjustment_id: string;
  file_url: string;
  file_name: string | null;
  observations: string | null;
}

function CountdownBadge({ deadline, status }: { deadline: string; status: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(deadline).getTime();
  const diff = target - now;
  const isOverdue = diff < 0 && status !== 'completed';
  const hours = Math.abs(Math.floor(diff / 3600000));
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  const label = days > 0 ? `${days}d ${remainHours}h` : `${hours}h`;

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${isOverdue ? 'text-destructive' : diff < 86400000 ? 'text-warning' : ''}`}>
      <Clock className="h-3 w-3" />
      <span className={isOverdue ? 'animate-pulse font-bold' : ''}>
        {isOverdue ? `-${label}` : label}
      </span>
    </span>
  );
}

function BriefingDetailDialog({ img, referenceImages, brandAssets }: { img: DesignerImage; referenceImages: ReferenceImage[]; brandAssets: any[] }) {
  const imgRefs = referenceImages.filter(r => r.briefing_image_id === img.id);
  const platformUrl = img.briefing_requests?.platform_url || '';
  const imgBrandAssets = brandAssets.filter((a: any) => a.platform_url === platformUrl);
  const isAdjustment = img._source === 'adjustment';

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isAdjustment ? <Wrench className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
          {isAdjustment ? 'Ajuste de Briefing' : (IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type)}
          {img.product_name && ` — ${img.product_name}`}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="text-sm font-medium">{img.briefing_requests.requester_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Prazo</p>
            <p className="text-sm font-medium">{img.deadline ? new Date(img.deadline).toLocaleDateString('pt-BR') : 'Não definido'}</p>
          </div>
        </div>

        {platformUrl && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">URL do Cliente</p>
            <a href={platformUrl.startsWith('http') ? platformUrl : `https://${platformUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 break-all">
              <Globe className="h-3 w-3 shrink-0" /> {platformUrl}
            </a>
          </div>
        )}

        <Separator />

        {img.image_text && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Texto da imagem</p><p className="text-sm">{img.image_text}</p></div>}
        {img.font_suggestion && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Sugestão de fonte</p><p className="text-sm">{img.font_suggestion}</p></div>}
        {img.element_suggestion && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Elemento sugerido</p><p className="text-sm">{img.element_suggestion}</p></div>}
        {img.professional_photo_url && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Foto profissional</p>
            <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
              {img.professional_photo_url} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
        {img.orientation && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Orientação</p><p className="text-sm">{img.orientation}</p></div>}
        {img.observations && <div><p className="text-xs font-semibold text-muted-foreground mb-1">Observações</p><p className="text-sm">{img.observations}</p></div>}
        {img.extra_info && <div><p className="text-xs font-semibold text-muted-foreground mb-1">📋 Informações do Mooni</p><p className="text-sm whitespace-pre-wrap">{img.extra_info}</p></div>}

        {/* Reference Images */}
        {imgRefs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">📎 Imagens de Referência ({imgRefs.length})</p>
            <div className="grid grid-cols-2 gap-2">
              {imgRefs.map(ref => (
                <a key={ref.id} href={ref.file_url} target="_blank" rel="noopener noreferrer" className="block group relative rounded-lg overflow-hidden border border-border hover:border-primary transition-colors">
                  <img src={ref.file_url} alt="Referência" className="w-full h-24 object-cover" loading="lazy" />
                  {ref.is_exact_use && (
                    <Badge className="absolute top-1 right-1 text-[10px] bg-primary/90">Uso exato</Badge>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Brand Assets */}
        {imgBrandAssets.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">🎨 Assets da Marca ({imgBrandAssets.length})</p>
            <div className="flex flex-wrap gap-2">
              {imgBrandAssets.map((asset: any) => (
                <a key={asset.id} href={asset.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded bg-muted">
                  <Image className="h-3 w-3" /> {asset.file_name || 'Asset'}
                </a>
              ))}
            </div>
          </div>
        )}

        {!img.image_text && !img.font_suggestion && !img.element_suggestion && !img.observations && !img.extra_info && imgRefs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum detalhe de briefing disponível</p>
        )}
      </div>
    </DialogContent>
  );
}

function AdjustmentDeliveryDialog({ img, designerEmail, onDelivered }: { img: DesignerImage; designerEmail: string; onDelivered: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!file || !img._adjustment_id) {
      toast.error('Selecione um arquivo para entregar');
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `deliveries/adjustments/${img._adjustment_id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('briefing-uploads').upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(filePath);

      const { data: result, error: submitErr } = await supabase.functions.invoke('delivery-data', {
        body: {
          action: 'submit_adjustment',
          adjustment_id: img._adjustment_id,
          file_url: urlData.publicUrl,
          comments: comments || null,
          delivered_by_email: designerEmail,
        },
      });
      if (submitErr) throw submitErr;
      if (result?.error) throw new Error(result.error);

      setDelivered(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      toast.success('Ajuste entregue com sucesso!');
      setTimeout(() => {
        setOpen(false);
        onDelivered();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao entregar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFile(null); setComments(''); setDelivered(false); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="gap-1">
          <Upload className="h-3 w-3" /> Entregar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" /> Entregar Ajuste
          </DialogTitle>
        </DialogHeader>

        {delivered ? (
          <div className="text-center py-6 space-y-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            </motion.div>
            <p className="text-lg font-bold">Ajuste entregue! 🎉</p>
            <p className="text-sm text-muted-foreground">O solicitante será notificado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {img.professional_photo_url && (
              <div>
                <Label className="text-xs text-muted-foreground">Imagem de referência</Label>
                <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={img.professional_photo_url} alt="Referência" className="mt-1 w-full max-h-32 object-contain rounded-lg border border-border" />
                </a>
              </div>
            )}
            {img.observations && (
              <div>
                <Label className="text-xs text-muted-foreground">Observações do ajuste</Label>
                <p className="text-sm mt-1">{img.observations}</p>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Arquivo da arte ajustada *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="space-y-1">
                    {file.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-28 mx-auto rounded object-contain" />
                    ) : (
                      <FileImage className="h-6 w-6 text-primary mx-auto" />
                    )}
                    <p className="text-xs font-medium">{file.name}</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Arraste ou clique para selecionar</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.psd,.ai,.pdf,.svg,.eps,.zip,.rar" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>

            <div className="space-y-2">
              <Label>Comentários (opcional)</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Observações sobre a entrega..." rows={2} />
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={submitting || !file}>
              <AnimatePresence mode="wait">
                {submitting ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" /> Entregar Ajuste
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DesignerPanel() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [images, setImages] = useState<DesignerImage[]>([]);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [brandAssets, setBrandAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('designer_email');
    if (!storedEmail) {
      navigate('/designer/login', { replace: true });
      return;
    }
    setEmail(storedEmail);
    loadData(storedEmail);
  }, [navigate]);

  const loadData = async (designerEmail: string) => {
    setLoading(true);
    const { data: result, error } = await supabase.functions.invoke('designer-data', {
      body: { email: designerEmail },
    });
    if (error) {
      console.error(error);
      setImages([]);
    } else {
      // Merge briefing images
      const briefingImages = ((result?.images || []) as DesignerImage[]).map(img => ({ ...img, _source: 'briefing' as const }));

      // Convert adjustment items into DesignerImage-like entries
      const adjustments = result?.adjustments || [];
      const adjItems = result?.adjustmentItems || [];
      const adjustmentImages: DesignerImage[] = [];

      for (const adj of adjustments) {
        const items = adjItems.filter((i: AdjustmentItem) => i.adjustment_id === adj.id);
        items.forEach((item: AdjustmentItem, idx: number) => {
          adjustmentImages.push({
            id: item.id,
            image_type: 'adjustment',
            product_name: item.file_name || `Ajuste ${idx + 1}`,
            deadline: adj.deadline,
            status: adj.status === 'allocated' ? 'in_progress' : adj.status,
            revision_count: 0,
            delivery_token: null,
            extra_info: null,
            image_text: null,
            font_suggestion: null,
            element_suggestion: null,
            orientation: null,
            observations: item.observations,
            professional_photo_url: item.file_url,
            briefing_requests: {
              requester_name: adj.client_email,
              platform_url: adj.client_url,
            },
            _source: 'adjustment',
          });
        });
      }

      setImages([...briefingImages, ...adjustmentImages]);
      setReferenceImages(result?.referenceImages || []);
      setBrandAssets(result?.brandAssets || []);
    }
    setLoading(false);
  };

  if (!email && !loading) return <Navigate to="/designer/login" replace />;

  const getStatusBadge = (img: DesignerImage) => {
    if (img._source === 'adjustment') {
      return <Badge className="bg-orange-500/20 text-orange-600 border-0">Ajuste</Badge>;
    }
    if (img.revision_count > 0 && img.status === 'in_progress') {
      return <Badge className="bg-destructive/20 text-destructive border-0 animate-badge-flip">Refação {img.revision_count}</Badge>;
    }
    const label = STATUS_LABELS[img.status as keyof typeof STATUS_LABELS] || img.status;
    const color = STATUS_COLORS[img.status as keyof typeof STATUS_COLORS] || 'bg-muted text-muted-foreground';
    return <Badge className={`${color} border-0`}>{label}</Badge>;
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const handleLogout = () => {
    sessionStorage.removeItem('designer_email');
    navigate('/designer/login', { replace: true });
  };

  const filtered = images.filter(img => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'adjustment') return img._source === 'adjustment';
    if (filterStatus === 'revision') return img.revision_count > 0 && img.status === 'in_progress';
    return img.status === filterStatus;
  });

  const getTypeLabel = (img: DesignerImage) => {
    if (img._source === 'adjustment') return 'Ajuste de Briefing';
    return IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type;
  };

  return (
    <CursEducaLayout
      title="Minhas Artes"
      subtitle={`Painel do Designer — ${email}`}
      actions={
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 text-white border-white/20 hover:bg-white/10">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      }
    >
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="artes" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="artes" className="gap-2"><FileImage className="h-4 w-4" />Minhas Artes</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" />Analytics</TabsTrigger>
              <TabsTrigger value="feedbacks" className="gap-2"><MessageSquare className="h-4 w-4" />Feedbacks</TabsTrigger>
            </TabsList>

            <TabsContent value="artes" className="mt-4">
              {images.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <EmptyState
                      icon={FileImage}
                      title="Nenhuma arte encontrada"
                      description="Não encontramos artes atribuídas para este email."
                    />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-lg">{filtered.length} de {images.length} arte{images.length !== 1 ? 's' : ''}</CardTitle>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <Filter className="h-3 w-3 mr-1" />
                          <SelectValue placeholder="Filtrar status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os status</SelectItem>
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                          <SelectItem value="revision">Em Refação</SelectItem>
                          <SelectItem value="adjustment">Ajustes de Briefing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tipo de Arte</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Briefing</TableHead>
                            <TableHead className="text-right">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((img, idx) => (
                            <motion.tr
                              key={img.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04, duration: 0.3 }}
                              className="border-b transition-colors hover:bg-muted/50"
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium">{getTypeLabel(img)}</p>
                                  {img.product_name && <p className="text-xs text-muted-foreground">{img.product_name}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{img.briefing_requests.requester_name}</span>
                              </TableCell>
                              <TableCell>
                                {img.briefing_requests.platform_url && (
                                  <a
                                    href={img.briefing_requests.platform_url.startsWith('http') ? img.briefing_requests.platform_url : `https://${img.briefing_requests.platform_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline flex items-center gap-1 text-xs max-w-[150px] truncate"
                                    title={img.briefing_requests.platform_url}
                                  >
                                    <Globe className="h-3 w-3 shrink-0" />
                                    {img.briefing_requests.platform_url.replace(/^https?:\/\//, '')}
                                  </a>
                                )}
                              </TableCell>
                              <TableCell>
                                {img.deadline ? (
                                  <CountdownBadge deadline={img.deadline} status={img.status} />
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(img)}</TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                                      <Eye className="h-3 w-3" /> Ver
                                    </Button>
                                  </DialogTrigger>
                                  <BriefingDetailDialog img={img} referenceImages={referenceImages} brandAssets={brandAssets} />
                                </Dialog>
                              </TableCell>
                              <TableCell className="text-right">
                                {img._source === 'adjustment' && img.professional_photo_url ? (
                                  <Button size="sm" variant="outline" asChild>
                                    <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                                      <Image className="h-3 w-3" /> Abrir
                                    </a>
                                  </Button>
                                ) : img.delivery_token ? (
                                  <Button size="sm" variant="outline" asChild>
                                    <Link to={`/delivery/${img.delivery_token}`}>Entregar</Link>
                                  </Button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Sem link</span>
                                )}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile stacked cards */}
                    <div className="md:hidden divide-y divide-border">
                      {filtered.map((img, idx) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04, duration: 0.3 }}
                          className={`p-4 space-y-3 ${isOverdue(img.deadline) && img.status !== 'completed' ? 'bg-destructive/5' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{getTypeLabel(img)}</p>
                              <p className="text-xs text-muted-foreground">{img.briefing_requests.requester_name}</p>
                              {img.briefing_requests.platform_url && (
                                <a
                                  href={img.briefing_requests.platform_url.startsWith('http') ? img.briefing_requests.platform_url : `https://${img.briefing_requests.platform_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-0.5"
                                >
                                  <Globe className="h-3 w-3" />
                                  {img.briefing_requests.platform_url.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                              {img.product_name && <p className="text-xs text-muted-foreground/70 truncate">{img.product_name}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {getStatusBadge(img)}
                              {img.deadline && <CountdownBadge deadline={img.deadline} status={img.status} />}
                            </div>
                          </div>
                          {img.observations && (
                            <div className="space-y-1 p-2 rounded-lg bg-muted/30 border border-border">
                              <p className="text-xs text-muted-foreground line-clamp-2"><span className="font-medium">Obs:</span> {img.observations}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1">
                                  <Eye className="h-3 w-3" /> Briefing
                                </Button>
                              </DialogTrigger>
                              <BriefingDetailDialog img={img} referenceImages={referenceImages} brandAssets={brandAssets} />
                            </Dialog>
                            {img._source === 'adjustment' && img.professional_photo_url ? (
                              <Button size="sm" className="flex-1 h-8 text-xs" variant="outline" asChild>
                                <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer">Abrir Imagem</a>
                              </Button>
                            ) : img.delivery_token ? (
                              <Button size="sm" className="flex-1 h-8 text-xs" variant="outline" asChild>
                                <Link to={`/delivery/${img.delivery_token}`}>Entregar</Link>
                              </Button>
                            ) : null}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <DesignerAnalytics designerEmail={email} />
            </TabsContent>

            <TabsContent value="feedbacks" className="mt-4">
              <DesignerFeedback designerEmail={email} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CursEducaLayout>
  );
}
