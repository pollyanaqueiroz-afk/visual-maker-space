import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ImageIcon, Upload, Loader2, Trash2, Download, ExternalLink, Mail, MessageSquare, X, Eye, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BrandAsset {
  id: string;
  platform_url: string;
  file_url: string;
  file_name: string | null;
  uploaded_by: string | null;
  source: string;
  briefing_image_id: string | null;
  created_at: string;
}

interface DeliveryGroup {
  request_id: string;
  requester_name: string;
  requester_email: string;
  platform_url: string;
  created_at: string;
  images: {
    id: string;
    image_type: string;
    product_name: string | null;
    status: string;
    deliveries: { file_url: string; delivered_by_email: string; created_at: string; comments: string | null }[];
  }[];
}

interface Props {
  platformUrl: string;
  clientName: string;
}

export default function BrandAssetsDialog({ platformUrl, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [deliveryGroups, setDeliveryGroups] = useState<DeliveryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DeliveryGroup | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    // Fetch manual brand assets
    const { data: brandData } = await (supabase
      .from('brand_assets' as any)
      .select('*')
      .eq('platform_url', platformUrl)
      .order('created_at', { ascending: false }) as any);
    setAssets((brandData || []) as BrandAsset[]);

    // Fetch deliveries from briefing system (arts with review/completed status)
    const { data: requestsData } = await supabase
      .from('briefing_requests')
      .select('id, requester_name, requester_email, platform_url, created_at')
      .eq('platform_url', platformUrl);

    if (requestsData && requestsData.length > 0) {
      const requestIds = requestsData.map(r => r.id);
      const { data: imagesData } = await supabase
        .from('briefing_images')
        .select('id, image_type, product_name, status, request_id')
        .in('request_id', requestIds)
        .in('status', ['review', 'completed']);

      if (imagesData && imagesData.length > 0) {
        const imageIds = imagesData.map(i => i.id);
        const { data: deliveriesData } = await supabase
          .from('briefing_deliveries')
          .select('briefing_image_id, file_url, delivered_by_email, created_at, comments')
          .in('briefing_image_id', imageIds);

        const groups: DeliveryGroup[] = [];
        for (const req of requestsData) {
          const reqImages = (imagesData || []).filter(i => i.request_id === req.id);
          if (reqImages.length === 0) continue;
          const imagesWithDeliveries = reqImages.map(img => ({
            ...img,
            deliveries: (deliveriesData || []).filter(d => d.briefing_image_id === img.id),
          })).filter(img => img.deliveries.length > 0);
          if (imagesWithDeliveries.length === 0) continue;
          groups.push({
            request_id: req.id,
            requester_name: req.requester_name,
            requester_email: req.requester_email,
            platform_url: req.platform_url,
            created_at: req.created_at,
            images: imagesWithDeliveries,
          });
        }
        setDeliveryGroups(groups);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) fetchAssets();
  }, [open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop();
        const path = `brand-assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('briefing-uploads').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(path);
        await (supabase.from('brand_assets' as any).insert({
          platform_url: platformUrl,
          file_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: 'admin',
          source: 'manual',
        }) as any);
      }
      toast.success(`${files.length} imagem(ns) adicionada(s) ao acervo`);
      fetchAssets();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('brand_assets' as any).delete().eq('id', id) as any);
    if (error) {
      toast.error('Erro ao remover');
    } else {
      toast.success('Imagem removida do acervo');
      setAssets(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleShareWhatsApp = (group: DeliveryGroup) => {
    const links = group.images.flatMap(i => i.deliveries.map(d => d.file_url));
    const msg = `Olá ${group.requester_name}! Suas artes estão prontas:\n\n${links.map((l, i) => `Arte ${i + 1}: ${l}`).join('\n')}\n\nAcesse seu portal para validar.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleShareEmail = async (group: DeliveryGroup) => {
    const links = group.images.flatMap(i => i.deliveries.map(d => d.file_url));
    try {
      const { error } = await supabase.functions.invoke('notify-delivery', {
        body: {
          client_email: group.requester_email,
          client_name: group.requester_name,
          delivery_links: links,
          platform_url: group.platform_url,
        },
      });
      if (error) throw error;
      toast.success('E-mail enviado com sucesso!');
    } catch {
      toast.error('Erro ao enviar e-mail');
    }
  };

  const handleExportAll = (group: DeliveryGroup) => {
    const links = group.images.flatMap(i => i.deliveries.map(d => d.file_url));
    links.forEach(url => window.open(url, '_blank'));
  };

  const manualAssets = assets.filter(a => a.source === 'manual');
  const deliveryAssets = assets.filter(a => a.source === 'delivery');

  const IMAGE_TYPE_LABELS: Record<string, string> = {
    login: 'Área de Login', banner_vitrine: 'Banner Vitrine', product_cover: 'Capa de Produto',
    trail_banner: 'Banner de Trilha', challenge_banner: 'Banner de Desafio',
    community_banner: 'Banner de Comunidade', app_mockup: 'Mockup do Aplicativo',
  };

  const STATUS_LABELS: Record<string, string> = {
    review: 'Aguardando Validação', completed: 'Aprovada',
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Acervo da marca">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Acervo — {clientName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Imagens de referência e entregas desta marca.
              </p>
              <div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Adicionar imagens
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (assets.length === 0 && deliveryGroups.length === 0) ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma imagem no acervo ainda.</p>
              </div>
            ) : (
              <>
                {/* Delivery Groups from briefing system */}
                {deliveryGroups.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Entregas ({deliveryGroups.reduce((acc, g) => acc + g.images.length, 0)} artes)
                    </p>
                    <div className="space-y-2">
                      {deliveryGroups.map(group => {
                        const latestDelivery = group.images
                          .flatMap(i => i.deliveries)
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                        const approvedCount = group.images.filter(i => i.status === 'completed').length;
                        const reviewCount = group.images.filter(i => i.status === 'review').length;

                        return (
                          <div
                            key={group.request_id}
                            className="border rounded-lg p-3 hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => setSelectedGroup(group)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{group.requester_name}</p>
                                <p className="text-xs text-muted-foreground">{group.platform_url}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {reviewCount > 0 && (
                                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600">{reviewCount} aguardando</Badge>
                                )}
                                {approvedCount > 0 && (
                                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600">{approvedCount} aprovadas</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Pedido: {format(new Date(group.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              {latestDelivery && (
                                <span>Entrega: {format(new Date(latestDelivery.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                              )}
                              <span>{group.images.length} arte(s)</span>
                            </div>
                            {/* Thumbnails */}
                            <div className="flex gap-2 mt-2 overflow-x-auto">
                              {group.images.slice(0, 6).flatMap(img =>
                                img.deliveries.slice(0, 1).map(d => (
                                  <img key={d.file_url} src={d.file_url} alt="" className="h-12 w-12 rounded object-cover border flex-shrink-0" />
                                ))
                              )}
                              {group.images.length > 6 && (
                                <div className="h-12 w-12 rounded border flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                                  +{group.images.length - 6}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {deliveryGroups.length > 0 && (manualAssets.length > 0 || deliveryAssets.length > 0) && <Separator />}

                {/* Manual assets */}
                {manualAssets.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      Imagens de Referência ({manualAssets.length})
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {manualAssets.map(asset => (
                        <div key={asset.id} className="relative group border rounded-lg overflow-hidden">
                          <img src={asset.file_url} alt={asset.file_name || ''} className="w-full aspect-square object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="secondary" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                            </a>
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(asset.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {asset.file_name && <p className="text-xs text-muted-foreground p-1 truncate">{asset.file_name}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy delivery assets */}
                {deliveryAssets.length > 0 && (
                  <>
                    {manualAssets.length > 0 && <Separator />}
                    <div>
                      <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Download className="h-4 w-4 text-primary" />
                        Entregas Aprovadas ({deliveryAssets.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {deliveryAssets.map(asset => (
                          <div key={asset.id} className="relative group border rounded-lg overflow-hidden">
                            <img src={asset.file_url} alt={asset.file_name || ''} className="w-full aspect-square object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="secondary" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                              </a>
                            </div>
                            <div className="p-1"><Badge variant="outline" className="text-xs">Entrega</Badge></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delivery Detail Modal */}
      <Dialog open={!!selectedGroup} onOpenChange={(v) => { if (!v) setSelectedGroup(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Entrega — {selectedGroup.requester_name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{selectedGroup.requester_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">URL:</span>
                    <p className="font-medium">{selectedGroup.platform_url}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data do Pedido:</span>
                    <p className="font-medium">{format(new Date(selectedGroup.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Artes Entregues:</span>
                    <p className="font-medium">{selectedGroup.images.length}</p>
                  </div>
                </div>

                <Separator />

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleExportAll(selectedGroup)} className="gap-2">
                    <Download className="h-4 w-4" /> Exportar todas
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShareEmail(selectedGroup)} className="gap-2">
                    <Mail className="h-4 w-4" /> Enviar por e-mail
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShareWhatsApp(selectedGroup)} className="gap-2">
                    <MessageSquare className="h-4 w-4" /> WhatsApp
                  </Button>
                </div>

                <Separator />

                {/* Images grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selectedGroup.images.map(img => (
                    <div key={img.id} className="space-y-1">
                      {img.deliveries.map((d, idx) => (
                        <div key={idx} className="border rounded-lg overflow-hidden">
                          <img src={d.file_url} alt="" className="w-full aspect-video object-cover" />
                          <div className="p-2 space-y-1">
                            <Badge variant="outline" className="text-xs">
                              {IMAGE_TYPE_LABELS[img.image_type] || img.image_type}
                            </Badge>
                            {img.product_name && <p className="text-xs text-muted-foreground">{img.product_name}</p>}
                            <Badge className={`text-xs ${img.status === 'completed' ? 'bg-green-500/10 text-green-600' : 'bg-purple-500/10 text-purple-600'}`}>
                              {STATUS_LABELS[img.status] || img.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(d.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
