import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, ImageIcon, FolderOpen, ExternalLink, Search, Calendar, User, SlidersHorizontal, PackageCheck, Loader2 } from 'lucide-react';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import JSZip from 'jszip';

interface AssetFile {
  id: string;
  file_url: string;
  file_name: string | null;
  display_name: string;
  source: string | null;
  created_at: string;
  requester_name: string | null;
  request_date: string | null;
  image_type: string | null;
}

export default function ClientAssetsPage() {
  const { platformUrl } = useParams<{ platformUrl: string }>();
  const decodedUrl = decodeURIComponent(platformUrl || '');
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'name'>('date_desc');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [zipping, setZipping] = useState(false);

  const extractClientSlug = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, '_');
    } catch {
      return url.replace(/[^a-zA-Z0-9]/g, '_');
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

  const buildDisplayName = (
    source: string | null,
    imageType: string | null,
    index: number,
    clientSlug: string
  ) => {
    const typeMap: Record<string, string> = {
      login: 'Login',
      banner_vitrine: 'Banner',
      product_cover: 'Capa',
      trail_banner: 'Trilha',
      challenge_banner: 'Desafio',
      community_banner: 'Comunidade',
      app_mockup: 'Mockup',
    };

    if (source === 'approved_delivery' && imageType) {
      const prefix = typeMap[imageType] || 'Arte';
      return `${prefix}_${index}_${clientSlug}`;
    }
    if (source === 'reference' || source === 'bulk_upload') {
      return `Referencia_${index}_${clientSlug}`;
    }
    if (source === 'manual') {
      return `Upload_${index}_${clientSlug}`;
    }
    return `Arquivo_${index}_${clientSlug}`;
  };

  useEffect(() => {
    if (!decodedUrl) return;
    const fetchAssets = async () => {
      setLoading(true);
      const clientSlug = extractClientSlug(decodedUrl);

      // Fetch assets with joined briefing image and request data
      const { data, error } = await supabase
        .from('brand_assets')
        .select(`
          id, file_url, file_name, source, created_at,
          briefing_image_id
        `)
        .eq('platform_url', decodedUrl)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        toast.error('Erro ao carregar arquivos');
        setLoading(false);
        return;
      }

      // Enrich with briefing data
      const enriched: AssetFile[] = [];
      const imageIds = (data || []).map(a => a.briefing_image_id).filter(Boolean) as string[];

      // Fetch briefing images + requests in batch
      let imageMap = new Map<string, { image_type: string; request_id: string }>();
      let requestMap = new Map<string, { requester_name: string; created_at: string }>();

      if (imageIds.length > 0) {
        const { data: imgData } = await supabase
          .from('briefing_images')
          .select('id, image_type, request_id')
          .in('id', imageIds);

        if (imgData) {
          imgData.forEach(i => imageMap.set(i.id, { image_type: i.image_type, request_id: i.request_id }));

          const requestIds = [...new Set(imgData.map(i => i.request_id))];
          if (requestIds.length > 0) {
            const { data: reqData } = await supabase
              .from('briefing_requests')
              .select('id, requester_name, created_at')
              .in('id', requestIds);

            if (reqData) {
              reqData.forEach(r => requestMap.set(r.id, { requester_name: r.requester_name, created_at: r.created_at }));
            }
          }
        }
      }

      // Build counters per source+type for sequential naming
      const counters = new Map<string, number>();

      for (const asset of (data || [])) {
        const imgInfo = asset.briefing_image_id ? imageMap.get(asset.briefing_image_id) : null;
        const reqInfo = imgInfo ? requestMap.get(imgInfo.request_id) : null;

        const counterKey = `${asset.source || 'manual'}_${imgInfo?.image_type || 'unknown'}`;
        const count = (counters.get(counterKey) || 0) + 1;
        counters.set(counterKey, count);

        enriched.push({
          id: asset.id,
          file_url: asset.file_url,
          file_name: asset.file_name,
          display_name: buildDisplayName(asset.source, imgInfo?.image_type || null, count, clientSlug),
          source: asset.source,
          created_at: asset.created_at,
          requester_name: reqInfo?.requester_name || null,
          request_date: reqInfo?.created_at || null,
          image_type: imgInfo?.image_type || null,
        });
      }

      setAssets(enriched);
      setLoading(false);
    };
    fetchAssets();
  }, [decodedUrl]);

  const clientName = extractClientName(decodedUrl);

  const sourceLabels: Record<string, string> = {
    manual: 'Upload manual',
    approved_delivery: 'Arte aprovada',
    reference: 'Referência',
    bulk_upload: 'Importação em massa',
  };

  const isImage = (url: string) =>
    /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);

  const getFileExtension = (url: string) => {
    const match = url.match(/\.(\w+)(\?|$)/);
    return match ? match[1].toUpperCase() : 'FILE';
  };

  // Filter and sort
  const filteredAssets = useMemo(() => {
    let result = [...assets];

    // Search by name or date
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        (a.display_name || '').toLowerCase().includes(q) ||
        (a.file_name || '').toLowerCase().includes(q) ||
        (a.requester_name || '').toLowerCase().includes(q) ||
        new Date(a.created_at).toLocaleDateString('pt-BR').includes(q) ||
        (a.request_date && new Date(a.request_date).toLocaleDateString('pt-BR').includes(q))
      );
    }

    // Filter by source
    if (filterSource !== 'all') {
      result = result.filter(a => a.source === filterSource);
    }

    // Sort
    if (sortBy === 'date_desc') {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'date_asc') {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      result.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    return result;
  }, [assets, searchQuery, sortBy, filterSource]);

  // Unique sources for filter
  const availableSources = useMemo(() => {
    const sources = new Set(assets.map(a => a.source || 'manual'));
    return Array.from(sources);
  }, [assets]);

  const handleDownloadZip = async () => {
    if (filteredAssets.length === 0) return;
    setZipping(true);
    const toastId = toast.loading(`Preparando ZIP com ${filteredAssets.length} arquivo(s)...`);
    try {
      const zip = new JSZip();
      const usedNames = new Set<string>();

      await Promise.all(
        filteredAssets.map(async (asset) => {
          try {
            const response = await fetch(asset.file_url);
            if (!response.ok) return;
            const blob = await response.blob();
            const ext = asset.file_url.match(/\.(\w+)(\?|$)/)?.[1] || 'png';
            let name = `${asset.display_name}.${ext}`;
            // Deduplicate names
            let counter = 1;
            while (usedNames.has(name)) {
              name = `${asset.display_name}_${counter}.${ext}`;
              counter++;
            }
            usedNames.add(name);
            zip.file(name, blob);
          } catch {
            // Skip failed downloads
          }
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${extractClientSlug(decodedUrl)}_assets.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download concluído!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar ZIP', { id: toastId });
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <FolderOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold capitalize truncate">{clientName}</h1>
            <p className="text-sm text-muted-foreground">
              {assets.length} arquivo(s) · {filteredAssets.length} exibido(s)
            </p>
            <a href={decodedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              {decodedUrl} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        {filteredAssets.length > 0 && (
          <Button onClick={handleDownloadZip} disabled={zipping} variant="outline" className="shrink-0">
            {zipping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}
            Baixar ZIP ({filteredAssets.length})
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      {assets.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, solicitante ou data (dd/mm/aaaa)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[160px] h-10 rounded-xl">
                <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Mais recentes</SelectItem>
                <SelectItem value="date_asc">Mais antigos</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[160px] h-10 rounded-xl">
                <SlidersHorizontal className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {availableSources.map(s => (
                  <SelectItem key={s} value={s}>{sourceLabels[s] || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum arquivo encontrado para este cliente</p>
          </CardContent>
        </Card>
      ) : filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum resultado encontrado</p>
            <p className="text-sm mt-1">Tente outro termo de busca ou filtro</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAssets.map(asset => (
            <Card key={asset.id} className="overflow-hidden group rounded-2xl border-border">
              <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                {isImage(asset.file_url) ? (
                  <img
                    src={asset.file_url}
                    alt={asset.display_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground mt-2">{getFileExtension(asset.file_url)}</p>
                  </div>
                )}
                <a
                  href={asset.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Download className="h-8 w-8 text-primary-foreground" />
                </a>
                {/* Source badge overlay */}
                <Badge
                  variant="outline"
                  className="absolute top-2 left-2 text-[9px] bg-card/90 backdrop-blur-sm border-border shadow-sm"
                >
                  {sourceLabels[asset.source || 'manual'] || asset.source}
                </Badge>
              </div>
              <CardContent className="p-3 space-y-1.5">
                <p className="text-xs font-semibold text-foreground truncate" title={asset.display_name}>
                  {asset.display_name}
                </p>
                {asset.image_type && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {IMAGE_TYPE_LABELS[asset.image_type as ImageType] || asset.image_type}
                  </p>
                )}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{new Date(asset.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                {asset.requester_name && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span className="truncate">{asset.requester_name}</span>
                  </div>
                )}
                {asset.request_date && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="ml-4">Pedido: {new Date(asset.request_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
