import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IMAGE_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types/briefing';
import { Loader2, Clock, ExternalLink, FileImage, Filter, MessageSquare, BarChart3, LogOut, Eye, Globe, Image, Wrench, Upload, Sparkles, CheckCircle2, Package, ChevronDown, ChevronRight } from 'lucide-react';
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
  created_at?: string;
  request_id?: string;
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

// Group key = client_url + date
interface ImageGroup {
  key: string;
  clientName: string;
  platformUrl: string;
  date: string;
  dateLabel: string;
  images: DesignerImage[];
  pendingCount: number;
  deliveredCount: number;
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

// Unified delivery dialog for BOTH briefing and adjustment arts
function DeliveryDialog({ img, designerEmail, onDelivered }: { img: DesignerImage; designerEmail: string; onDelivered: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdjustment = img._source === 'adjustment';
  const artLabel = isAdjustment
    ? (img.product_name || 'Ajuste')
    : (IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type) + (img.product_name ? ` — ${img.product_name}` : '');

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Selecione um arquivo para entregar');
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.name.split('.').pop();
      const folder = isAdjustment ? `deliveries/adjustments/${img._adjustment_id}` : `deliveries/${img.id}`;
      const filePath = `${folder}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('briefing-uploads').upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(filePath);

      if (isAdjustment) {
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
      } else {
        const { data: result, error: submitErr } = await supabase.functions.invoke('delivery-data', {
          body: {
            action: 'submit',
            image_id: img.id,
            file_url: urlData.publicUrl,
            comments: comments || null,
            delivered_by_email: designerEmail,
          },
        });
        if (submitErr) throw submitErr;
        if (result?.error) throw new Error(result.error);
      }

      setDelivered(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      toast.success('Arte entregue com sucesso!');
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
        <Button size="sm" variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Upload className="h-3 w-3" /> Entregar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAdjustment ? <Wrench className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
            Entregar Arte
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{artLabel}</p>
        </DialogHeader>

        {delivered ? (
          <div className="text-center py-6 space-y-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            </motion.div>
            <p className="text-lg font-bold">Arte entregue! 🎉</p>
            <p className="text-sm text-muted-foreground">O solicitante será notificado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isAdjustment && img.professional_photo_url && (
              <div>
                <Label className="text-xs text-muted-foreground">Imagem de referência</Label>
                <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer">
                  <img src={img.professional_photo_url} alt="Referência" className="mt-1 w-full max-h-32 object-contain rounded-lg border border-border" />
                </a>
              </div>
            )}
            {isAdjustment && img.observations && (
              <div>
                <Label className="text-xs text-muted-foreground">Observações do ajuste</Label>
                <p className="text-sm mt-1">{img.observations}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Arquivo da arte *</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-emerald-500/50'}`}
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
                      <FileImage className="h-6 w-6 text-emerald-500 mx-auto" />
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

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={submitting || !file}>
              <AnimatePresence mode="wait">
                {submitting ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" /> Entregar Arte
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

// Batch delivery dialog with manual matching fallback
function BatchDeliveryDialog({ group, designerEmail, onDelivered }: { group: ImageGroup; designerEmail: string; onDelivered: () => void }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [delivered, setDelivered] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [matchResults, setMatchResults] = useState<{ image: DesignerImage; file: File | null; confidence: string }[]>([]);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingImages = group.images.filter(img =>
    img.status !== 'completed' && img.status !== 'review' && img.status !== 'cancelled'
  );

  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const tokenize = (str: string): string[] => {
    return (normalize(str).match(/[a-z0-9]+/g) || []).filter(t => t.length > 1);
  };

  const getArtLabel = (img: DesignerImage) => {
    return (IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type) + (img.product_name ? ` — ${img.product_name}` : '');
  };

  const matchFiles = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    const usedFileKeys = new Set<string>();

    // Pre-compute art info for each pending image
    const artInfos = pendingImages.map(img => {
      const typeLabel = IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type;
      const productName = img.product_name || '';
      const fullName = typeLabel + ' ' + productName;
      return {
        img,
        typeNorm: normalize(typeLabel),
        productNorm: normalize(productName),
        fullNorm: normalize(fullName),
        typeTokens: tokenize(typeLabel),
        productTokens: tokenize(productName),
        fullTokens: tokenize(fullName),
        hasProduct: !!productName.trim(),
      };
    });

    // Count how many arts share the same type (for ambiguity detection)
    const typeCountMap: Record<string, number> = {};
    artInfos.forEach(a => { typeCountMap[a.typeNorm] = (typeCountMap[a.typeNorm] || 0) + 1; });

    // Score each file against each art
    const fileInfos = selectedFiles.map(f => {
      const baseName = f.name.replace(/\.[^.]+$/, '');
      return {
        file: f,
        key: f.name + f.size,
        norm: normalize(baseName),
        tokens: tokenize(baseName),
      };
    });

    // Build a score matrix: [artIdx][fileIdx] = { score, confidence }
    type MatchScore = { score: number; confidence: 'exact' | 'high' | 'partial' | 'low' | 'none' };
    const scoreMatrix: MatchScore[][] = artInfos.map(art => {
      return fileInfos.map(fi => {
        const fileName = fi.norm;
        const fileTokens = fi.tokens;

        // Layer 1: Full exact match (type + product)
        if (fileName === art.fullNorm || art.fullNorm.includes(fileName) || fileName.includes(art.fullNorm)) {
          return { score: 100, confidence: 'exact' as const };
        }

        // Layer 2: Product-specific match (when product exists)
        if (art.hasProduct && art.productTokens.length > 0) {
          const productMatchCount = art.productTokens.filter(t =>
            fileTokens.some(ft => ft.includes(t) || t.includes(ft))
          ).length;
          const productRatio = productMatchCount / art.productTokens.length;

          const typeMatchCount = art.typeTokens.filter(t =>
            fileTokens.some(ft => ft.includes(t) || t.includes(ft))
          ).length;
          const typeRatio = typeMatchCount / Math.max(art.typeTokens.length, 1);

          // Both type and product match well
          if (productRatio >= 0.6 && typeRatio >= 0.4) {
            return { score: 80 + productRatio * 10, confidence: 'exact' as const };
          }

          // Strong product match alone (type may be implicit from context)
          if (productRatio >= 0.6) {
            // But if multiple arts share same type, product match alone is ambiguous
            const sameTypeArts = artInfos.filter(a =>
              a.typeNorm === art.typeNorm && a.hasProduct
            );
            const otherProductMatches = sameTypeArts.filter(other => {
              if (other.img.id === art.img.id) return false;
              const otherProdMatch = other.productTokens.filter(t =>
                fileTokens.some(ft => ft.includes(t) || t.includes(ft))
              ).length / other.productTokens.length;
              return otherProdMatch >= 0.5;
            });
            if (otherProductMatches.length > 0) {
              // Ambiguous: multiple products match this file
              return { score: 40 + productRatio * 10, confidence: 'partial' as const };
            }
            return { score: 70 + productRatio * 10, confidence: 'high' as const };
          }

          // Partial product match
          if (productRatio >= 0.3) {
            return { score: 30 + productRatio * 20, confidence: 'partial' as const };
          }
        }

        // Layer 3: Type-only match (no product or generic file name)
        const typeMatchCount = art.typeTokens.filter(t =>
          fileTokens.some(ft => ft.includes(t) || t.includes(ft))
        ).length;
        const typeRatio = typeMatchCount / Math.max(art.typeTokens.length, 1);

        if (typeRatio >= 0.5) {
          // If multiple arts share this type, it's ambiguous
          if (typeCountMap[art.typeNorm] > 1) {
            return { score: 20 + typeRatio * 10, confidence: 'low' as const };
          }
          // Only one art of this type — safe to match
          return { score: 60 + typeRatio * 10, confidence: 'high' as const };
        }

        // Layer 4: General token overlap
        const allMatchCount = art.fullTokens.filter(t =>
          fileTokens.some(ft => ft.includes(t) || t.includes(ft))
        ).length;
        const overallRatio = allMatchCount / Math.max(art.fullTokens.length, 1);

        if (overallRatio >= 0.3) {
          return { score: 10 + overallRatio * 20, confidence: 'low' as const };
        }

        return { score: 0, confidence: 'none' as const };
      });
    });

    // Greedy assignment: pick best score first, mark used
    const results: { image: DesignerImage; file: File | null; confidence: string }[] =
      artInfos.map(a => ({ image: a.img, file: null, confidence: 'none' }));

    // Build flat list of (artIdx, fileIdx, score, confidence), sort desc
    const candidates: { ai: number; fi: number; score: number; confidence: string }[] = [];
    scoreMatrix.forEach((row, ai) => {
      row.forEach((cell, fi) => {
        if (cell.score > 0) {
          candidates.push({ ai, fi, score: cell.score, confidence: cell.confidence });
        }
      });
    });
    candidates.sort((a, b) => b.score - a.score);

    const usedArts = new Set<number>();
    const usedFiles = new Set<number>();

    for (const c of candidates) {
      if (usedArts.has(c.ai) || usedFiles.has(c.fi)) continue;
      results[c.ai] = {
        image: artInfos[c.ai].img,
        file: fileInfos[c.fi].file,
        confidence: c.confidence,
      };
      usedArts.add(c.ai);
      usedFiles.add(c.fi);
    }

    setMatchResults(results);

    // Show manual matching if there are unmatched or low/partial confidence
    const needsAttention = results.filter(r => !r.file || r.confidence === 'low' || r.confidence === 'partial' || r.confidence === 'none').length;
    if (needsAttention > 0 && selectedFiles.length > 0) {
      setShowManualMatch(true);
    } else {
      setShowManualMatch(false);
    }
  }, [pendingImages]);

  const handleManualAssign = (imageIdx: number, fileName: string) => {
    setMatchResults(prev => {
      const updated = [...prev];
      if (!fileName) {
        updated[imageIdx] = { ...updated[imageIdx], file: null, confidence: 'none' };
      } else {
        const selectedFile = files.find(f => f.name === fileName);
        if (selectedFile) {
          // Remove this file from any other assignment
          const cleaned = updated.map((r, i) => {
            if (i !== imageIdx && r.file?.name === fileName) {
              return { ...r, file: null, confidence: 'none' };
            }
            return r;
          });
          cleaned[imageIdx] = { ...cleaned[imageIdx], file: selectedFile, confidence: 'manual' };
          return cleaned;
        }
      }
      return updated;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const fileList = Array.from(e.dataTransfer.files);
    if (fileList.length > 0) matchFiles(fileList);
  };

  const handleSubmit = async () => {
    const toDeliver = matchResults.filter(r => r.file !== null);
    if (toDeliver.length === 0) {
      toast.error('Nenhum arquivo corresponde às artes');
      return;
    }
    setSubmitting(true);
    let successCount = 0;
    try {
      for (const item of toDeliver) {
        if (!item.file) continue;
        const ext = item.file.name.split('.').pop();
        const isAdj = item.image._source === 'adjustment';
        const folder = isAdj ? `deliveries/adjustments/${item.image._adjustment_id}` : `deliveries/${item.image.id}`;
        const filePath = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('briefing-uploads').upload(filePath, item.file);
        if (uploadErr) { console.error(uploadErr); continue; }
        const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(filePath);

        if (isAdj) {
          await supabase.functions.invoke('delivery-data', {
            body: {
              action: 'submit_adjustment',
              adjustment_id: item.image._adjustment_id,
              file_url: urlData.publicUrl,
              comments: comments || null,
              delivered_by_email: designerEmail,
            },
          });
        } else {
          await supabase.functions.invoke('delivery-data', {
            body: {
              action: 'submit',
              image_id: item.image.id,
              file_url: urlData.publicUrl,
              comments: comments || null,
              delivered_by_email: designerEmail,
            },
          });
        }
        successCount++;
      }

      setDelivered(true);
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.5 } });
      toast.success(`${successCount} arte${successCount > 1 ? 's' : ''} entregue${successCount > 1 ? 's' : ''} com sucesso!`);
      setTimeout(() => {
        setOpen(false);
        onDelivered();
      }, 2500);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao entregar: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Files not assigned to any art
  const assignedFileNames = new Set(matchResults.filter(r => r.file).map(r => r.file!.name));
  const unassignedFiles = files.filter(f => !assignedFileNames.has(f.name));

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setFiles([]); setComments(''); setDelivered(false); setMatchResults([]); setShowManualMatch(false); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Package className="h-3 w-3" /> Entrega em Lote ({pendingImages.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Entrega em Lote
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{group.clientName} — {group.dateLabel} — {pendingImages.length} arte{pendingImages.length !== 1 ? 's' : ''} pendente{pendingImages.length !== 1 ? 's' : ''}</p>
        </DialogHeader>

        {delivered ? (
          <div className="text-center py-8 space-y-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
            </motion.div>
            <p className="text-lg font-bold">Entrega em lote concluída! 🎉</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione os arquivos das artes</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:border-emerald-500/50'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {files.length > 0 ? (
                  <div className="space-y-1">
                    <Package className="h-8 w-8 text-emerald-500 mx-auto" />
                    <p className="text-sm font-medium">{files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">Clique para alterar</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Arraste ou clique para selecionar múltiplos arquivos</p>
                    <p className="text-xs text-muted-foreground mt-1">O sistema fará o de-para automático pelos nomes</p>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,.psd,.ai,.pdf,.svg,.eps,.zip,.rar" onChange={e => {
                const fileList = Array.from(e.target.files || []);
                if (fileList.length > 0) matchFiles(fileList);
              }} />
            </div>

            {matchResults.length > 0 && (
              <div className="space-y-2">
                {/* Warning banners */}
                {matchResults.some(r => !r.file || r.confidence === 'none') && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <span className="text-lg mt-0.5">❌</span>
                    <div>
                      <p className="text-sm font-medium">Arquivos sem correspondência</p>
                      <p className="text-xs text-muted-foreground">Não foi possível identificar correspondência. Selecione manualmente.</p>
                    </div>
                  </div>
                )}
                {matchResults.some(r => r.confidence === 'partial') && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-amber-700">Correspondência sugerida — confirme</p>
                      <p className="text-xs text-amber-600/80">Foram encontradas correspondências parciais. Verifique se estão corretas ou altere manualmente.</p>
                    </div>
                  </div>
                )}
                {matchResults.some(r => r.confidence === 'low') && !matchResults.some(r => r.confidence === 'partial') && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <span className="text-lg mt-0.5">🔍</span>
                    <div>
                      <p className="text-sm font-medium text-amber-700">Múltiplas possibilidades encontradas</p>
                      <p className="text-xs text-amber-600/80">O arquivo pode corresponder a várias solicitações do mesmo tipo. Escolha a correta.</p>
                    </div>
                  </div>
                )}

                <Label className="text-sm">Correspondência dos arquivos</Label>
                <div className="divide-y divide-border border rounded-lg overflow-hidden">
                  {matchResults.map((r, idx) => {
                    const artLabel = getArtLabel(r.image);
                    const needsManual = !r.file || r.confidence === 'low' || r.confidence === 'none';
                    const needsConfirm = r.confidence === 'partial';
                    return (
                      <div key={idx} className={`flex items-center gap-2 p-2.5 text-xs ${needsManual ? 'bg-destructive/5' : needsConfirm ? 'bg-amber-500/5' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{artLabel}</p>
                          {needsConfirm && r.file && (
                            <p className="text-[10px] text-amber-600 mt-0.5">Sugestão: {r.file.name} — confirme ou altere</p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {needsManual || needsConfirm || showManualMatch ? (
                            <Select
                              value={r.file?.name || ''}
                              onValueChange={(v) => handleManualAssign(idx, v)}
                            >
                              <SelectTrigger className={`h-7 w-48 text-[11px] ${needsConfirm && r.file ? 'border-amber-500' : ''}`}>
                                <SelectValue placeholder="Selecionar arquivo..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Nenhum</SelectItem>
                                {files.map(f => {
                                  const isUsedElsewhere = matchResults.some((mr, mi) => mi !== idx && mr.file?.name === f.name);
                                  return (
                                    <SelectItem key={f.name} value={f.name} disabled={isUsedElsewhere}>
                                      {f.name.length > 30 ? f.name.slice(0, 30) + '…' : f.name}
                                      {isUsedElsewhere && ' (já usado)'}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={r.confidence === 'exact' ? 'bg-emerald-100 text-emerald-700 border-0' : r.confidence === 'high' ? 'bg-blue-100 text-blue-700 border-0' : r.confidence === 'manual' ? 'bg-violet-100 text-violet-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}>
                              ✓ {r.file!.name.length > 20 ? r.file!.name.slice(0, 20) + '…' : r.file!.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {matchResults.filter(r => r.file).length} de {matchResults.length} correspondência{matchResults.filter(r => r.file).length !== 1 ? 's' : ''}
                  </p>
                  {!showManualMatch && matchResults.every(r => r.file) && (
                    <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => setShowManualMatch(true)}>
                      Editar correspondências
                    </Button>
                  )}
                </div>
                {unassignedFiles.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {unassignedFiles.length} arquivo{unassignedFiles.length !== 1 ? 's' : ''} não atribuído{unassignedFiles.length !== 1 ? 's' : ''}: {unassignedFiles.map(f => f.name).join(', ')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Comentários (opcional)</Label>
              <Textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Observações gerais sobre a entrega..." rows={2} />
            </div>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={submitting || matchResults.filter(r => r.file).length === 0}>
              <AnimatePresence mode="wait">
                {submitting ? (
                  <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando {matchResults.filter(r => r.file).length} arte{matchResults.filter(r => r.file).length !== 1 ? 's' : ''}...
                  </motion.span>
                ) : (
                  <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" /> Entregar {matchResults.filter(r => r.file).length} arte{matchResults.filter(r => r.file).length !== 1 ? 's' : ''}
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
      const briefingImages = ((result?.images || []) as any[]).map((img: any) => ({ ...img, _source: 'briefing' as const }));

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
            status: adj.status === 'allocated' ? 'pending' : adj.status,
            revision_count: 0,
            delivery_token: null,
            extra_info: null,
            image_text: null,
            font_suggestion: null,
            element_suggestion: null,
            orientation: null,
            observations: item.observations,
            professional_photo_url: item.file_url,
            created_at: adj.created_at,
            request_id: adj.id,
            briefing_requests: {
              requester_name: adj.client_email,
              platform_url: adj.client_url,
            },
            _source: 'adjustment',
            _adjustment_id: adj.id,
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

  // Group filtered images by client (platform_url) + date
  const imageGroups: ImageGroup[] = useMemo(() => {
    const groupMap: Record<string, ImageGroup> = {};

    filtered.forEach(img => {
      const platformUrl = img.briefing_requests?.platform_url || 'unknown';
      const createdAt = img.created_at || '';
      const date = createdAt ? new Date(createdAt).toISOString().split('T')[0] : 'unknown';
      const key = `${platformUrl}__${date}`;

      if (!groupMap[key]) {
        const clientName = img.briefing_requests?.requester_name || platformUrl;
        const dateObj = createdAt ? new Date(createdAt) : null;
        const dateLabel = dateObj ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';

        groupMap[key] = {
          key,
          clientName,
          platformUrl,
          date,
          dateLabel,
          images: [],
          pendingCount: 0,
          deliveredCount: 0,
        };
      }

      groupMap[key].images.push(img);
      if (img.status === 'completed' || img.status === 'review') {
        groupMap[key].deliveredCount++;
      } else if (img.status !== 'cancelled') {
        groupMap[key].pendingCount++;
      }
    });

    return Object.values(groupMap).sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-expand first group
  useEffect(() => {
    if (imageGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([imageGroups[0].key]));
    }
  }, [imageGroups.length]);

  const canDeliver = (img: DesignerImage) => {
    return img.status !== 'completed' && img.status !== 'review' && img.status !== 'cancelled';
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
                <div className="space-y-4">
                  {/* Filter bar */}
                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-muted-foreground">
                          {filtered.length} arte{filtered.length !== 1 ? 's' : ''} em {imageGroups.length} pedido{imageGroups.length !== 1 ? 's' : ''}
                        </p>
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
                    </CardContent>
                  </Card>

                  {/* Grouped cards */}
                  {imageGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.key);
                    return (
                      <motion.div
                        key={group.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card>
                          <CardHeader
                            className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4"
                            onClick={() => toggleGroup(group.key)}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{group.clientName}</p>
                                    <Badge variant="outline" className="text-[10px]">{group.dateLabel}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {group.platformUrl && (
                                      <a
                                        href={group.platformUrl.startsWith('http') ? group.platformUrl : `https://${group.platformUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-primary hover:underline flex items-center gap-1"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <Globe className="h-3 w-3" />
                                        {group.platformUrl.replace(/^https?:\/\//, '')}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="secondary" className="text-xs">
                                  {group.images.length} arte{group.images.length !== 1 ? 's' : ''}
                                </Badge>
                                {group.pendingCount > 0 && (
                                  <Badge className="bg-amber-500/20 text-amber-600 border-0 text-xs">
                                    {group.pendingCount} pendente{group.pendingCount !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {group.deliveredCount > 0 && (
                                  <Badge className="bg-emerald-500/20 text-emerald-600 border-0 text-xs">
                                    {group.deliveredCount} entregue{group.deliveredCount !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <CardContent className="pt-0 pb-4">
                                  <Separator className="mb-3" />
                                  <div className="space-y-2">
                                    {group.images.map((img, idx) => (
                                      <div
                                        key={img.id}
                                        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                                      >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{getTypeLabel(img)}</p>
                                            {img.product_name && <p className="text-xs text-muted-foreground truncate">{img.product_name}</p>}
                                          </div>
                                          {img.deadline && <CountdownBadge deadline={img.deadline} status={img.status} />}
                                          {getStatusBadge(img)}
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs">
                                                <Eye className="h-3 w-3" /> Ver
                                              </Button>
                                            </DialogTrigger>
                                            <BriefingDetailDialog img={img} referenceImages={referenceImages} brandAssets={brandAssets} />
                                          </Dialog>
                                          {canDeliver(img) ? (
                                            <DeliveryDialog img={img} designerEmail={email} onDelivered={() => loadData(email)} />
                                          ) : (img.status === 'completed' || img.status === 'review') ? (
                                            <Badge variant="secondary" className="text-xs">Entregue</Badge>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Batch delivery button */}
                                  {group.pendingCount > 1 && (
                                    <div className="mt-4 pt-3 border-t border-border flex justify-end">
                                      <BatchDeliveryDialog group={group} designerEmail={email} onDelivered={() => loadData(email)} />
                                    </div>
                                  )}
                                </CardContent>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
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
