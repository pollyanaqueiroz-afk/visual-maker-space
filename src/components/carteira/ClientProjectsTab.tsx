import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus, Calendar, Tag, Loader2, FolderKanban, CircleDot,
  Clock, Play, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  clientName: string;
  clientIdCurseduca?: string;
}

const CATEGORY_OPTIONS = [
  { value: 'engenharia', label: 'Engenharia', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { value: 'produto', label: 'Produto', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'cs', label: 'CS', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'implantacao', label: 'Implantação', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
];

const STATUS_OPTIONS = [
  { value: 'na_fila', label: 'Na Fila', icon: Clock, color: 'bg-muted text-muted-foreground' },
  { value: 'em_andamento', label: 'Em Andamento', icon: Play, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'concluido', label: 'Concluído', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'cancelado', label: 'Cancelado', icon: AlertCircle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
];

function getCategoryStyle(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.color || 'bg-muted text-muted-foreground';
}
function getCategoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.label || cat;
}
function getStatusStyle(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.color || 'bg-muted text-muted-foreground';
}
function getStatusLabel(s: string) {
  return STATUS_OPTIONS.find(o => o.value === s)?.label || s;
}

export default function ClientProjectsTab({ clientName, clientIdCurseduca }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('cs');
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['client-projects', clientIdCurseduca],
    queryFn: async () => {
      if (!clientIdCurseduca) return [];
      const { data, error } = await supabase
        .from('client_projects')
        .select('*')
        .eq('client_id_curseduca', clientIdCurseduca)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientIdCurseduca,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('client_projects').insert({
        client_id_curseduca: clientIdCurseduca!,
        client_name: clientName,
        title,
        description: description || null,
        category,
        requested_by: user?.email || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects', clientIdCurseduca] });
      toast.success('Pedido criado com sucesso');
      setShowForm(false);
      setTitle('');
      setDescription('');
      setCategory('cs');
    },
    onError: (e: any) => toast.error(`Erro ao criar pedido: ${e.message}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('client_projects')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-projects', clientIdCurseduca] });
      toast.success('Status atualizado');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Gestão de Projetos</h3>
          {projects && projects.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{projects.length}</Badge>
          )}
        </div>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-3 w-3" /> Novo Pedido
        </Button>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="text-center py-8">
          <FolderKanban className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum pedido ou projeto registrado</p>
          <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="h-3 w-3" /> Criar Primeiro Pedido
          </Button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((project: any) => (
            <Card key={project.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <CircleDot className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium">{project.title}</span>
                    </div>
                    {project.description && (
                      <p className="text-xs text-muted-foreground ml-5.5 mb-1.5 line-clamp-2">{project.description}</p>
                    )}
                    <div className="flex items-center gap-2 ml-5.5 flex-wrap">
                      <Badge className={`text-[10px] border-0 ${getCategoryStyle(project.category)}`}>
                        <Tag className="h-2.5 w-2.5 mr-0.5" />
                        {getCategoryLabel(project.category)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {format(new Date(project.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      {project.requested_by && (
                        <span className="text-[10px] text-muted-foreground">por {project.requested_by}</span>
                      )}
                    </div>
                  </div>
                  <Select
                    value={project.status}
                    onValueChange={(val) => updateStatusMutation.mutate({ id: project.id, status: val })}
                  >
                    <SelectTrigger className="h-6 w-auto min-w-[110px] text-[10px] border-0 px-2">
                      <Badge className={`text-[10px] border-0 ${getStatusStyle(project.status)}`}>
                        {getStatusLabel(project.status)}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Novo Pedido / Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Título do Pedido *</label>
              <Input
                placeholder="Ex: Configuração de SSO para o cliente"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
              <Textarea
                placeholder="Detalhes adicionais sobre o pedido..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria (Time Responsável)</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!title.trim() || createMutation.isPending}
              className="gap-1"
            >
              {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Criar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
