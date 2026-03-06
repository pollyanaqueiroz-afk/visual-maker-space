import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Trash2, ExternalLink, Package, FileArchive, Loader2, Link, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function ClienteScorm() {
  const { user } = useAuth();
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
      const { data: files } = await supabase.storage
        .from('scorm-packages')
        .list(pkg.storage_path, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f: any) => `${pkg.storage_path}/${f.name}`);
        await supabase.storage.from('scorm-packages').remove(paths);
      }
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

  const getPublicUrl = (pkg: any) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/storage/v1/object/public/scorm-packages/${pkg.storage_path}/${pkg.entry_point}`;
  };

  const copyPublicLink = (pkg: any) => {
    navigator.clipboard.writeText(getPublicUrl(pkg));
    toast.success('Link público copiado!');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">📦 SCORM</h1>
            <p className="text-white/50 text-sm mt-1">Importe e gerencie seus pacotes SCORM</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-[#1E293B] border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Importar Pacote SCORM</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-white/70">Título *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome do conteúdo" className="bg-white/5 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-white/70">Descrição</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional" rows={2} className="bg-white/5 border-white/10 text-white" />
                </div>
                <div>
                  <Label className="text-white/70">Arquivo ZIP (SCORM)</Label>
                  <div
                    className={`mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
                      dragOver ? 'border-primary bg-primary/10' : 'border-white/20 hover:border-primary/50'
                    }`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('scorm-file-input-cliente')?.click()}
                  >
                    <FileArchive className="h-8 w-8 text-white/30 mb-2" />
                    {file ? (
                      <p className="text-sm font-medium">{file.name} ({formatSize(file.size)})</p>
                    ) : (
                      <p className="text-sm text-white/40">Arraste um .zip ou clique para selecionar</p>
                    )}
                    <input
                      id="scorm-file-input-cliente"
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
      </motion.div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      ) : !packages?.length ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Card className="bg-[#1E293B] border-white/10 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-white/20 mb-3" />
              <p className="font-medium text-white/60">Nenhum pacote SCORM importado</p>
              <p className="text-sm text-white/30 mt-1">Clique em "Importar" para adicionar seu primeiro pacote</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg: any, i: number) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Card className="bg-[#1E293B] border-white/10 hover:border-white/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{pkg.title}</p>
                      {pkg.description && <p className="text-xs text-white/40 mt-0.5">{pkg.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
                        <span>{pkg.file_count} arquivos</span>
                        <span>{formatSize(pkg.file_size_bytes)}</span>
                        <span>{format(new Date(pkg.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => navigate(`/scorm/${pkg.id}`)}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" /> Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => copyPublicLink(pkg)}
                    >
                      <Link className="mr-1 h-3 w-3" /> Link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
                      onClick={() => {
                        if (confirm('Excluir este pacote SCORM?')) deleteMutation.mutate(pkg);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
