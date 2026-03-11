import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Upload, Send, Clock, CheckCircle, Loader2, Smartphone, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-amber-500/15 text-amber-600 border-amber-500/20' },
  in_progress: { label: 'Em andamento', color: 'bg-blue-500/15 text-blue-600 border-blue-500/20' },
  completed: { label: 'Concluído', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20' },
};

export default function AjusteAplicativosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [clientUrl, setClientUrl] = useState('');
  const [tipo, setTipo] = useState<'icone' | 'descricao' | ''>('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [iconeFile, setIconeFile] = useState<File | null>(null);
  const [iconePreview, setIconePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: ajustes = [], isLoading } = useQuery({
    queryKey: ['app-ajustes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_ajustes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setClientUrl('');
    setTipo('');
    setNovaDescricao('');
    setIconeFile(null);
    setIconePreview('');
  };

  const handleSubmit = async () => {
    if (!clientUrl.trim()) { toast.error('Informe a URL do cliente'); return; }
    if (!tipo) { toast.error('Selecione o tipo de ajuste'); return; }
    if (tipo === 'descricao' && !novaDescricao.trim()) { toast.error('Informe a nova descrição'); return; }
    if (tipo === 'icone' && !iconeFile) { toast.error('Envie o novo ícone'); return; }

    setSubmitting(true);
    try {
      let iconeUrl: string | null = null;

      if (tipo === 'icone' && iconeFile) {
        const path = `app-ajustes/${Date.now()}_${iconeFile.name}`;
        const { error: uploadError } = await supabase.storage.from('briefing-uploads').upload(path, iconeFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(path);
        iconeUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('app_ajustes').insert({
        client_url: clientUrl.trim(),
        tipo,
        nova_descricao: tipo === 'descricao' ? novaDescricao.trim() : null,
        icone_url: iconeUrl,
        created_by: user?.id,
      } as any);

      if (error) throw error;

      toast.success('Solicitação de ajuste de aplicativo registrada!');
      resetForm();
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['app-ajustes'] });
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ajuste de Aplicativos</h1>
          <p className="text-sm text-muted-foreground">Solicite alterações de ícone ou descrição de aplicativos</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Solicitar Ajuste
        </Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(STATUS_MAP).map(([key, { label }]) => {
          const count = ajustes.filter((a: any) => a.status === key).length;
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

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : ajustes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma solicitação de ajuste registrada.</p>
            <p className="text-sm mt-1">Clique em "Solicitar Ajuste" para criar a primeira.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {ajustes.map((aj: any) => {
            const statusInfo = STATUS_MAP[aj.status] || STATUS_MAP.pending;
            return (
              <Card key={aj.id}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{aj.client_url}</p>
                        <p className="text-xs text-muted-foreground">
                          {aj.tipo === 'icone' ? '🎨 Alteração do ícone' : '📝 Alteração da descrição'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`text-xs border ${statusInfo.color}`}>{statusInfo.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(aj.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  {aj.tipo === 'descricao' && aj.nova_descricao && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted/30 rounded p-2 line-clamp-3">{aj.nova_descricao}</p>
                  )}
                  {aj.tipo === 'icone' && aj.icone_url && (
                    <div className="mt-2">
                      <img src={aj.icone_url} alt="Novo ícone" className="w-16 h-16 rounded-xl border object-cover" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) resetForm(); setFormOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar Ajuste de Aplicativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>URL do Cliente <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://cliente.curseduca.pro"
                value={clientUrl}
                onChange={e => setClientUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Ajuste <span className="text-destructive">*</span></Label>
              <Select value={tipo} onValueChange={v => setTipo(v as 'icone' | 'descricao')}>
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="icone">🎨 Alteração do ícone</SelectItem>
                  <SelectItem value="descricao">📝 Alteração da descrição</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipo === 'icone' && (
              <div className="space-y-2">
                <Label>Novo ícone <span className="text-destructive">*</span></Label>
                {iconePreview ? (
                  <div className="relative inline-block">
                    <img src={iconePreview} alt="Preview" className="w-24 h-24 rounded-xl border object-cover" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 bg-background border shadow-sm"
                      onClick={() => { setIconeFile(null); setIconePreview(''); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Clique para enviar o novo ícone</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setIconeFile(file);
                          setIconePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {tipo === 'descricao' && (
              <div className="space-y-2">
                <Label>Nova descrição <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="Digite a nova descrição do aplicativo..."
                  value={novaDescricao}
                  onChange={e => setNovaDescricao(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            )}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Registrar solicitação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
