import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, ImageIcon, FolderOpen, ExternalLink } from 'lucide-react';

interface AssetFile {
  id: string;
  file_url: string;
  file_name: string | null;
  source: string | null;
  created_at: string;
}

export default function ClientAssetsPage() {
  const { platformUrl } = useParams<{ platformUrl: string }>();
  const decodedUrl = decodeURIComponent(platformUrl || '');
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [loading, setLoading] = useState(true);

  const extractClientName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
    } catch {
      return url;
    }
  };

  useEffect(() => {
    if (!decodedUrl) return;
    const fetchAssets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('brand_assets')
        .select('id, file_url, file_name, source, created_at')
        .eq('platform_url', decodedUrl)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        toast.error('Erro ao carregar arquivos');
      }
      setAssets(data || []);
      setLoading(false);
    };
    fetchAssets();
  }, [decodedUrl]);

  const clientName = extractClientName(decodedUrl);

  const sourceLabels: Record<string, string> = {
    manual: 'Upload manual',
    approved_delivery: 'Arte aprovada',
    reference: 'Referência do briefing',
    bulk_upload: 'Importação em massa',
  };

  const getFileExtension = (url: string) => {
    const match = url.match(/\.(\w+)(\?|$)/);
    return match ? match[1].toUpperCase() : 'FILE';
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url);
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <FolderOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold capitalize">{clientName}</h1>
          <p className="text-sm text-muted-foreground">
            Pasta de arquivos — {assets.length} arquivo(s)
          </p>
          <a href={decodedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
            {decodedUrl} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum arquivo encontrado para este cliente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map(asset => (
            <Card key={asset.id} className="overflow-hidden group">
              <div className="aspect-square bg-muted flex items-center justify-center relative">
                {isImage(asset.file_url) ? (
                  <img
                    src={asset.file_url}
                    alt={asset.file_name || 'Asset'}
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
                  <Download className="h-8 w-8 text-white" />
                </a>
              </div>
              <CardContent className="p-3 space-y-1">
                <p className="text-xs font-medium truncate" title={asset.file_name || ''}>
                  {asset.file_name || 'Sem nome'}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {sourceLabels[asset.source || 'manual'] || asset.source}
                </Badge>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(asset.created_at).toLocaleDateString('pt-BR')}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
