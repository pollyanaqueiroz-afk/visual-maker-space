import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  Bug, Lightbulb, ChevronDown, ChevronRight, Plus, MessageSquare, Send,
  RefreshCw, Clock, CheckCircle2, AlertTriangle, Circle, Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientName: string;
  clientId?: string;
}

interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  type: string;
  created: string;
  updated: string;
  description: string;
  components: string[];
  comments: { id: string; author: string; body: string; created: string }[];
}

const STATUS_MAP: Record<string, string> = {
  'To Do': 'A Fazer',
  'In Progress': 'Em Andamento',
  'In Sprint': 'Em Desenvolvimento',
  'Done': 'Resolvido',
  'Waiting for Customer': 'Aguardando Cliente',
  'In Review': 'Em Revisão',
  'Backlog': 'Backlog',
};

const STATUS_COLORS: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  indeterminate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const PRIORITY_ICONS: Record<string, { color: string; icon: typeof AlertTriangle }> = {
  Critical: { color: 'text-red-500', icon: AlertTriangle },
  High: { color: 'text-orange-500', icon: AlertTriangle },
  Medium: { color: 'text-amber-500', icon: Circle },
  Low: { color: 'text-blue-400', icon: Circle },
};

export default function ClientTicketsTab({ clientName, clientId }: Props) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ summary: '', description: '', type: 'Bug', priority: 'Medium' });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['jira-tickets', clientName],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('jira-proxy', {
        body: { action: 'search', client_name: clientName, limit: 30 },
      });
      if (error) throw error;
      return data as { issues: JiraTicket[]; total: number };
    },
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('jira-proxy', {
        body: { action: 'create', ...form, client_name: clientName },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Ticket ${d.key} criado com sucesso`);
      setShowCreate(false);
      setForm({ summary: '', description: '', type: 'Bug', priority: 'Medium' });
      queryClient.invalidateQueries({ queryKey: ['jira-tickets', clientName] });
    },
    onError: () => toast.error('Erro ao criar ticket'),
  });

  const commentMutation = useMutation({
    mutationFn: async ({ issueKey, comment }: { issueKey: string; comment: string }) => {
      const { data, error } = await supabase.functions.invoke('jira-proxy', {
        body: { action: 'comment', issue_key: issueKey, comment },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success('Comentário adicionado');
      setNewComment(prev => ({ ...prev, [vars.issueKey]: '' }));
      queryClient.invalidateQueries({ queryKey: ['jira-tickets', clientName] });
    },
    onError: () => toast.error('Erro ao adicionar comentário'),
  });

  const tickets = data?.issues || [];
  const openCount = tickets.filter(t => t.statusCategory !== 'done').length;
  const criticalCount = tickets.filter(t => t.priority === 'Critical' && t.statusCategory !== 'done').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Tickets de Suporte</h3>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {isFetching ? (
              <><RefreshCw className="h-3 w-3 animate-spin" /> Atualizando...</>
            ) : (
              <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Sincronizado</>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 sm:h-7 text-xs gap-1 w-full sm:w-auto">
          <Plus className="h-3 w-3" /> Novo Ticket
        </Button>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-lg border bg-card p-2 sm:p-2.5 text-center">
          <p className="text-base sm:text-lg font-bold">{tickets.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border bg-card p-2 sm:p-2.5 text-center">
          <p className="text-base sm:text-lg font-bold text-amber-600">{openCount}</p>
          <p className="text-[10px] text-muted-foreground">Em Aberto</p>
        </div>
        <div className="rounded-lg border bg-card p-2 sm:p-2.5 text-center">
          <p className="text-base sm:text-lg font-bold text-red-600">{criticalCount}</p>
          <p className="text-[10px] text-muted-foreground">Críticos</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      )}

      {/* Ticket list */}
      {!isLoading && tickets.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum ticket encontrado para este cliente</p>
      )}

      <div className="space-y-1.5">
        {tickets.map(ticket => {
          const isOpen = expandedId === ticket.id;
          const priorityInfo = PRIORITY_ICONS[ticket.priority] || PRIORITY_ICONS.Medium;
          const PriorityIcon = priorityInfo.icon;

          return (
            <Collapsible key={ticket.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : ticket.id)}>
              <CollapsibleTrigger className="w-full">
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors hover:bg-muted/50 ${isOpen ? 'bg-muted/30 border-primary/20' : ''}`}>
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <PriorityIcon className={`h-3.5 w-3.5 shrink-0 ${priorityInfo.color}`} />
                  {ticket.type === 'Bug' ? <Bug className="h-3.5 w-3.5 shrink-0 text-red-400" /> : <Lightbulb className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">{ticket.key}</span>
                      <span className="text-xs font-medium truncate">{ticket.summary}</span>
                    </div>
                  </div>
                  <Badge className={`text-[10px] px-1.5 py-0 border-0 ${STATUS_COLORS[ticket.statusCategory] || STATUS_COLORS.indeterminate}`}>
                    {STATUS_MAP[ticket.status] || ticket.status}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(ticket.created), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-5 mr-1 mt-1 p-3 rounded-lg bg-muted/20 border border-border/50 space-y-3">
                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{ticket.type}</span></div>
                    <div><span className="text-muted-foreground">Severidade:</span> <span className="font-medium">{ticket.priority}</span></div>
                    {ticket.components.length > 0 && (
                      <div className="col-span-2"><span className="text-muted-foreground">Componente:</span> <span className="font-medium">{ticket.components.join(', ')}</span></div>
                    )}
                    <div><span className="text-muted-foreground">Criado:</span> <span>{new Date(ticket.created).toLocaleDateString('pt-BR')}</span></div>
                    <div><span className="text-muted-foreground">Atualizado:</span> <span>{new Date(ticket.updated).toLocaleDateString('pt-BR')}</span></div>
                  </div>

                  {ticket.description && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1">Descrição</p>
                      <p className="text-xs bg-background/50 rounded p-2 border">{ticket.description}</p>
                    </div>
                  )}

                  {/* Comments */}
                  {ticket.comments.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Comentários ({ticket.comments.length})
                      </p>
                      <div className="space-y-1.5">
                        {ticket.comments.map(c => (
                          <div key={c.id} className="text-xs bg-background/50 rounded p-2 border">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-medium">{c.author}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(c.created), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                            <p className="text-muted-foreground">{c.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Adicionar comentário..."
                      value={newComment[ticket.key] || ''}
                      onChange={e => setNewComment(prev => ({ ...prev, [ticket.key]: e.target.value }))}
                      className="h-7 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2"
                      disabled={!newComment[ticket.key]?.trim() || commentMutation.isPending}
                      onClick={() => commentMutation.mutate({ issueKey: ticket.key, comment: newComment[ticket.key] })}
                    >
                      {commentMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Create ticket dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Ticket — {clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Título do ticket"
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            />
            <Textarea
              placeholder="Descrição detalhada..."
              rows={4}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bug">Bug</SelectItem>
                  <SelectItem value="Improvement">Melhoria</SelectItem>
                  <SelectItem value="Task">Tarefa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Crítico</SelectItem>
                  <SelectItem value="High">Alto</SelectItem>
                  <SelectItem value="Medium">Médio</SelectItem>
                  <SelectItem value="Low">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              disabled={!form.summary.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Criar Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
