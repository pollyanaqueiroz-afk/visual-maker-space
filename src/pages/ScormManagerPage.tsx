import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Trash2, ExternalLink, Package, FileArchive, Loader2, Copy, Link } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ScormManagerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['scorm-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scorm_packages' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (pkg: any) => {
      // Delete storage files
      const { data: files } = await supabase.storage
        .from('scorm-packages')
        .list(pkg.storage_path, { limit: 1000 });
      
      if (files && files.length > 0) {
        const paths = files.map((f: any) => `${pkg.storage_path}/${f.name}`);
        await supabase.storage.from('scorm-packages').remove(paths);
      }

      // Delete record
      const { error } = await (supabase.from('scorm_packages' as any) as any).delete().eq('id', pkg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorm-packages'] });
      toast.success('Pacote SCORM excluído');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error('Preencha o título e selecione um arquivo ZIP');
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      formData.append('description', description.trim());

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/process-scorm`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao processar SCORM');

      toast.success('Pacote SCORM importado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['scorm-packages'] });
      setOpen(false);
      setTitle('');
      setDescription('');
      setFile(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.zip') || dropped.type === 'application/zip')) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace('.zip', ''));
    } else {
      toast.error('Selecione um arquivo .zip');
    }
  }, [title]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPlayerUrl = (pkg: any) => `/scorm/${pkg.id}`;

  const getPublicUrl = (pkg: any) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/storage/v1/object/public/scorm-packages/${pkg.storage_path}/${pkg.entry_point}`;
  };

  const copyPublicLink = (pkg: any) => {
    const url = getPublicUrl(pkg);
    navigator.clipboard.writeText(url);
    toast.success('Link público copiado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciador SCORM</h1>
          <p className="text-muted-foreground">Importe e gerencie pacotes SCORM</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="mr-2 h-4 w-4" /> Importar SCORM</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Importar Pacote SCORM</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do conteúdo" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional" rows={2} />
              </div>
              <div>
                <Label>Arquivo ZIP (SCORM)</Label>
                <div
                  className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                    dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('scorm-file-input')?.click()}
                >
                  <FileArchive className="h-8 w-8 text-muted-foreground mb-2" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name} ({formatSize(file.size)})</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Arraste um arquivo .zip ou clique para selecionar</p>
                  )}
                  <input
                    id="scorm-file-input"
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setFile(f);
                        if (!title) setTitle(f.name.replace('.zip', ''));
                      }
                    }}
                  />
                </div>
              </div>
              <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()} className="w-full">
                {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : 'Importar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pacotes Importados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !packages?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum pacote SCORM importado ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Arquivos</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((pkg: any) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pkg.title}</p>
                        {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pkg.file_count} arquivos</Badge>
                    </TableCell>
                    <TableCell>{formatSize(pkg.file_size_bytes)}</TableCell>
                    <TableCell>{format(new Date(pkg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(getPlayerUrl(pkg))}>
                        <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Excluir este pacote SCORM?')) deleteMutation.mutate(pkg);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
