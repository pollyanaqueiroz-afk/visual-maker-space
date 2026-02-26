import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ImageIcon, Upload, Loader2, X, Link2 } from 'lucide-react';

interface Props {
  onUploaded?: () => void;
}

export default function BulkPhotoUploadDialog({ onUploaded }: Props) {
  const [open, setOpen] = useState(false);
  const [platformUrl, setPlatformUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [driveLink, setDriveLink] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPlatformUrl('');
    setFiles([]);
    setDriveLink('');
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadFiles = async () => {
    if (!platformUrl.trim()) {
      toast.error('Digite a URL da plataforma do cliente');
      return;
    }
    if (files.length === 0) {
      toast.error('Selecione pelo menos uma imagem');
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `brand-assets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('briefing-uploads')
          .upload(path, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('briefing-uploads')
          .getPublicUrl(path);

        const { error: insertError } = await supabase
          .from('brand_assets')
          .insert({
            platform_url: platformUrl.trim(),
            file_url: urlData.publicUrl,
            file_name: file.name,
            uploaded_by: 'admin',
            source: 'manual',
          });

        if (!insertError) successCount++;
      }

      if (successCount > 0) {
        toast.success(`${successCount} imagem(ns) adicionada(s) ao acervo de ${platformUrl.trim()}`);
        onUploaded?.();
        reset();
        setOpen(false);
      } else {
        toast.error('Nenhuma imagem foi enviada com sucesso');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDriveLink = async () => {
    if (!platformUrl.trim()) {
      toast.error('Digite a URL da plataforma do cliente');
      return;
    }
    if (!driveLink.trim()) {
      toast.error('Cole o link do Google Drive');
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase
        .from('brand_assets')
        .insert({
          platform_url: platformUrl.trim(),
          file_url: driveLink.trim(),
          file_name: `Google Drive — ${platformUrl.trim()}`,
          uploaded_by: 'admin',
          source: 'manual',
        });

      if (error) throw error;

      toast.success('Link do Google Drive salvo no acervo');
      onUploaded?.();
      reset();
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar link');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ImageIcon className="h-4 w-4" />
          Importar Fotos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Importar Fotos para Acervo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-platform-url">URL da Plataforma do Cliente *</Label>
            <Input
              id="bulk-platform-url"
              value={platformUrl}
              onChange={e => setPlatformUrl(e.target.value)}
              placeholder="https://cliente.curseduca.pro"
            />
            <p className="text-xs text-muted-foreground">
              As fotos serão vinculadas a este cliente no acervo da marca.
            </p>
          </div>

          <Tabs defaultValue="upload">
            <TabsList className="w-full">
              <TabsTrigger value="upload" className="flex-1 gap-1">
                <Upload className="h-3.5 w-3.5" />
                Upload de Imagens
              </TabsTrigger>
              <TabsTrigger value="drive" className="flex-1 gap-1">
                <Link2 className="h-3.5 w-3.5" />
                Link Google Drive
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-3 mt-3">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFilesSelected}
                />
                <Button
                  variant="outline"
                  className="w-full border-dashed h-20 gap-2"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Clique para selecionar imagens
                  </span>
                </Button>
              </div>

              {files.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium">{files.length} arquivo(s) selecionado(s)</p>
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                      <span className="truncate max-w-[300px]">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={() => removeFile(i)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full gap-2"
                onClick={handleUploadFiles}
                disabled={uploading || files.length === 0 || !platformUrl.trim()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Enviar {files.length} imagem(ns)
              </Button>
            </TabsContent>

            <TabsContent value="drive" className="space-y-3 mt-3">
              <div className="space-y-2">
                <Label htmlFor="drive-link">Link da pasta no Google Drive</Label>
                <Input
                  id="drive-link"
                  value={driveLink}
                  onChange={e => setDriveLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                />
                <p className="text-xs text-muted-foreground">
                  Cole o link compartilhado da pasta com as imagens do cliente.
                </p>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSaveDriveLink}
                disabled={uploading || !driveLink.trim() || !platformUrl.trim()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Salvar Link do Drive
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
