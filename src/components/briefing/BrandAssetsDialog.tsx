import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ImageIcon, Upload, Loader2, Trash2, Download, ExternalLink } from 'lucide-react';

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

interface Props {
  platformUrl: string;
  clientName: string;
}

export default function BrandAssetsDialog({ platformUrl, clientName }: Props) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('brand_assets' as any)
      .select('*')
      .eq('platform_url', platformUrl)
      .order('created_at', { ascending: false }) as any);
    if (error) {
      console.error(error);
    } else {
      setAssets((data || []) as BrandAsset[]);
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

        const { error: uploadError } = await supabase.storage
          .from('briefing-uploads')
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('briefing-uploads')
          .getPublicUrl(path);

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

  const manualAssets = assets.filter(a => a.source === 'manual');
  const deliveryAssets = assets.filter(a => a.source === 'delivery');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Acervo da marca">
          <ImageIcon className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Acervo — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Imagens de referência e entregas aprovadas desta marca.
            </p>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Adicionar imagens
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma imagem no acervo ainda.</p>
              <p className="text-xs mt-1">Adicione imagens de referência ou aprove entregas para popular o acervo.</p>
            </div>
          ) : (
            <>
              {manualAssets.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    Imagens de Referência ({manualAssets.length})
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {manualAssets.map(asset => (
                      <div key={asset.id} className="relative group border rounded-lg overflow-hidden">
                        <img
                          src={asset.file_url}
                          alt={asset.file_name || ''}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="secondary" size="icon" className="h-8 w-8">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(asset.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {asset.file_name && (
                          <p className="text-xs text-muted-foreground p-1 truncate">{asset.file_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                          <img
                            src={asset.file_url}
                            alt={asset.file_name || ''}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a href={asset.file_url} target="_blank" rel="noopener noreferrer">
                              <Button variant="secondary" size="icon" className="h-8 w-8">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                          <div className="p-1">
                            <Badge variant="outline" className="text-xs">Entrega</Badge>
                          </div>
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
  );
}
