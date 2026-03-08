import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Bell, AlertTriangle, Apple, Bot, Clock, CheckCircle, Users, TrendingUp, ClipboardList, Filter, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FASE_NAMES = [
  'Pré-Requisitos',
  'Primeiros Passos',
  'Validação Loja',
  'Criação',
  'Aprovação Lojas',
  'Teste',
  'Publicado ✅',
];

interface AppCliente {
  id: string;
  nome: string;
  empresa: string;
  email: string;
  telefone: string | null;
  whatsapp: string | null;
  plataforma: string;
  responsavel_nome: string | null;
  fase_atual: number;
  status: string;
  porcentagem_geral: number;
  prazo_estimado: string | null;
  data_criacao: string;
  ultima_acao_cliente: string | null;
  portal_token: string;
  updated_at: string;
}

interface AppFase {
  id: string;
  cliente_id: string;
  numero: number;
  sla_violado: boolean;
  sla_vencimento: string | null;
  porcentagem: number;
  status: string;
}

export default function AplicativosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = usePermissions();
  const { user } = useAuth();
  const canDrag = hasRole('admin') || hasRole('gerente_implantacao') || hasRole('analista_implantacao');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kanban');
  const [pendencyFilter, setPendencyFilter] = useState('todos');
  const [phaseFilter, setPhaseFilter] = useState('todas');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [kanbanFilter, setKanbanFilter] = useState<'todos' | 'atrasados'>('todos');
  const [mooniDialogOpen, setMooniDialogOpen] = useState(false);
  const [mooniItemId, setMooniItemId] = useState<string | null>(null);
  const [mooniClientName, setMooniClientName] = useState('');
  const [mooniClientEmpresa, setMooniClientEmpresa] = useState('');
  const [mooniText, setMooniText] = useState('');
  const [mooniSaving, setMooniSaving] = useState(false);

  // Drag and drop states
  const [dragOverColumn, setDragOverColumn] = useState<number | null>(null);
  const [dropConfirmOpen, setDropConfirmOpen] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<{
    clienteId: string;
    clienteNome: string;
    faseAtual: number;
    plataforma: string;
    targetFase: number;
  } | null>(null);
  const [dropPlataforma, setDropPlataforma] = useState<string>('ambas');
  const [dropping, setDropping] = useState(false);

  const [form, setForm] = useState({
    nome: '', url_cliente: '', email: '', whatsapp: '', plataforma: 'ambos', responsavel_nome: '',
  });

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['app-clientes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_clientes').select('*').order('data_criacao', { ascending: false });
      if (error) throw error;
      return data as AppCliente[];
    },
  });

  const { data: fases = [] } = useQuery({
    queryKey: ['app-fases-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_fases').select('id, cliente_id, numero, sla_violado, sla_vencimento, porcentagem, status');
      if (error) throw error;
      return data as AppFase[];
    },
  });

  const { data: checklistCounts = [] } = useQuery({
    queryKey: ['app-checklist-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_checklist_items').select('cliente_id, fase_numero, feito, obrigatorio');
      if (error) throw error;
      return data as { cliente_id: string; fase_numero: number; feito: boolean; obrigatorio: boolean }[];
    },
  });

  // Full checklist for internal pendencies tab
  const { data: allChecklist = [] } = useQuery({
    queryKey: ['app-checklist-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_checklist_items')
        .select('id, cliente_id, fase_numero, texto, descricao, ator, tipo, feito, feito_em, feito_por, created_at')
        .neq('ator', 'cliente')
        .order('fase_numero')
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Check for existing client by empresa (URL), email or nome
      const { data: existing } = await supabase
        .from('app_clientes')
        .select('id, nome')
        .or(`empresa.eq.${form.url_cliente},email.eq.${form.email},nome.eq.${form.nome}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update the existing record with responsavel info
        const { error } = await supabase.from('app_clientes').update({
          responsavel_nome: form.responsavel_nome || null,
        }).eq('id', existing.id);
        if (error) throw error;
        return { linked: true, name: existing.nome, id: existing.id };
      }

      const { error } = await supabase.from('app_clientes').insert({
        nome: form.nome,
        empresa: form.url_cliente,
        email: form.email,
        whatsapp: form.whatsapp || null,
        plataforma: form.plataforma,
        responsavel_nome: form.responsavel_nome || null,
      });
      if (error) throw error;
      return { linked: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });
      setDialogOpen(false);
      setForm({ nome: '', url_cliente: '', email: '', whatsapp: '', plataforma: 'ambos', responsavel_nome: '' });
      if (result?.linked) {
        toast.success(`Cliente "${result.name}" já existia — responsável vinculado com sucesso!`);
      } else {
        toast.success('Cliente criado com sucesso! Fases e checklist gerados automaticamente.');
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  const completeTask = useMutation({
    mutationFn: async (itemId: string) => {
      setCompletingIds(prev => new Set(prev).add(itemId));
      const { error } = await supabase.from('app_checklist_items').update({
        feito: true,
        feito_em: new Date().toISOString(),
        feito_por: 'equipe_interna',
      }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      // Small delay so user sees the "Concluído" state before item disappears
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });
        queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
        queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
        queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
        setCompletingIds(new Set());
      }, 800);
      toast.success('Tarefa concluída! A próxima etapa será desbloqueada automaticamente se todas as pendências da fase estiverem resolvidas. ✅');
    },
    onError: (e: any) => {
      setCompletingIds(new Set());
      toast.error(e.message);
    },
  });

  const handleMooniSave = async () => {
    if (!mooniText.trim() || !mooniItemId) return;
    setMooniSaving(true);
    try {
      const { data: requests } = await supabase
        .from('briefing_requests')
        .select('id, briefing_images(id, image_type)')
        .eq('platform_url', mooniClientEmpresa);

      const mockupImageIds = (requests || [])
        .flatMap((r: any) => r.briefing_images || [])
        .filter((img: any) => img.image_type === 'app_mockup')
        .map((img: any) => img.id);

      for (const imgId of mockupImageIds) {
        await supabase.from('briefing_images')
          .update({ extra_info: mooniText.trim() })
          .eq('id', imgId);
      }

      await supabase.from('app_checklist_items').update({
        feito: true,
        feito_em: new Date().toISOString(),
        feito_por: 'equipe_interna',
        dados_preenchidos: mooniText.trim(),
      }).eq('id', mooniItemId);

      queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
      queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
      setMooniDialogOpen(false);
      setMooniText('');
      setMooniItemId(null);
      toast.success('Mooni criado com sucesso! As informações foram enviadas para as artes de mockup. ✅');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar Mooni');
    } finally {
      setMooniSaving(false);
    }
  };

  const totalAbertos = clientes.filter(c => c.fase_atual < 6).length;
  const totalConcluidos = clientes.filter(c => c.fase_atual >= 6).length;
  const atrasados = clientes.filter(c => c.status === 'atrasado').length;
  const slaViolados = fases.filter(f => f.sla_violado).length;
  const fasesAtrasadas = fases.filter(f => f.sla_violado || f.status === 'atrasada').length;
  const clientesComFaseAtrasada = useMemo(() => {
    const ids = new Set(fases.filter(f => f.sla_violado || f.status === 'atrasada').map(f => f.cliente_id));
    return ids;
  }, [fases]);

  const avgProgress = totalAbertos > 0
    ? Math.round(clientes.filter(c => c.fase_atual < 6).reduce((sum, c) => sum + c.porcentagem_geral, 0) / totalAbertos)
    : 0;

  const columns = useMemo(() => {
    const cols: Record<number, AppCliente[]> = {};
    for (let i = 0; i <= 6; i++) cols[i] = [];
    const filtered = kanbanFilter === 'atrasados'
      ? clientes.filter(c => clientesComFaseAtrasada.has(c.id) || c.status === 'atrasado')
      : clientes;
    filtered.forEach(c => {
      const fase = Math.min(c.fase_atual, 6);
      cols[fase].push(c);
    });
    return cols;
  }, [clientes, kanbanFilter, clientesComFaseAtrasada]);

  // Internal pendencies grouped by client
  const internalPendencies = useMemo(() => {
    const clientMap = new Map<string, typeof allChecklist>();
    allChecklist.forEach(item => {
      const existing = clientMap.get(item.cliente_id) || [];
      existing.push(item);
      clientMap.set(item.cliente_id, existing);
    });

    return Array.from(clientMap.entries()).map(([clienteId, items]) => {
      const cliente = clientes.find(c => c.id === clienteId);
      return { clienteId, cliente, items };
    }).filter(g => {
      if (!g.cliente) return false;
      // Filter out items from phases the client has already passed (backfilled items), but keep Mooni tasks
      g.items = g.items.filter((item: any) => item.fase_numero >= g.cliente!.fase_atual || item.tipo === 'mooni' || item.texto === 'Criar Mooni');
      return g.items.length > 0;
    })
      .sort((a, b) => {
        const aPriority = a.items.some((i: any) => i.texto?.startsWith('⚠️ PRIORIDADE'));
        const bPriority = b.items.some((i: any) => i.texto?.startsWith('⚠️ PRIORIDADE'));
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return b.items.length - a.items.length;
      });
  }, [allChecklist, clientes]);

  // Filtered pendencies
  const filteredPendencies = useMemo(() => {
    let result = internalPendencies;
    if (pendencyFilter === 'sem_responsavel') {
      result = result.filter(g => !g.cliente?.responsavel_nome);
    } else if (pendencyFilter !== 'todos') {
      result = result.filter(g => g.cliente?.responsavel_nome === pendencyFilter);
    }
    if (phaseFilter !== 'todas') {
      const phase = parseInt(phaseFilter);
      result = result.map(g => ({
        ...g,
        items: g.items.filter((item: any) => item.fase_numero === phase),
      })).filter(g => g.items.length > 0);
    }
    if (statusFilter !== 'todos') {
      const feito = statusFilter === 'concluido';
      result = result.map(g => ({
        ...g,
        items: g.items.filter((item: any) => item.feito === feito),
      })).filter(g => g.items.length > 0);
    }
    return result;
  }, [internalPendencies, pendencyFilter, phaseFilter, statusFilter]);

  const uniquePhases = useMemo(() => {
    const phases = new Set<number>();
    internalPendencies.forEach(g => g.items.forEach((item: any) => phases.add(item.fase_numero)));
    return Array.from(phases).sort((a, b) => a - b);
  }, [internalPendencies]);

  // Unique responsáveis for filter
  const uniqueResponsaveis = useMemo(() => {
    const names = new Set<string>();
    internalPendencies.forEach(g => {
      if (g.cliente?.responsavel_nome) names.add(g.cliente.responsavel_nome);
    });
    return Array.from(names).sort();
  }, [internalPendencies]);

  const totalInternalPending = useMemo(() => {
    return internalPendencies.reduce((sum, g) => sum + g.items.filter((i: any) => !i.feito).length, 0);
  }, [internalPendencies]);

  const analystPending = useMemo(() => {
    return internalPendencies.reduce((sum, g) => sum + g.items.filter((i: any) => i.ator === 'analista' && !i.feito).length, 0);
  }, [internalPendencies]);

  const designerPending = useMemo(() => {
    return internalPendencies.reduce((sum, g) => sum + g.items.filter((i: any) => i.ator === 'designer' && !i.feito).length, 0);
  }, [internalPendencies]);

  const clientsWithPendencies = internalPendencies.filter(g => g.items.some((i: any) => !i.feito)).length;

  const getChecklistStats = (clienteId: string, faseNum: number) => {
    const items = checklistCounts.filter(i => i.cliente_id === clienteId && i.fase_numero === faseNum && i.obrigatorio);
    const total = items.length;
    const done = items.filter(i => i.feito).length;
    return { total, done };
  };

  const getInactivityDays = (c: AppCliente) => {
    if (!c.ultima_acao_cliente) return null;
    return differenceInDays(new Date(), new Date(c.ultima_acao_cliente));
  };

  const getSlaInfo = (clienteId: string, faseNum: number) => {
    const fase = fases.find(f => f.cliente_id === clienteId && f.numero === faseNum);
    if (!fase) return null;
    if (fase.sla_violado) return { label: '🚨 SLA vencido', color: 'destructive' as const };
    if (fase.sla_vencimento) {
      const hoursLeft = differenceInHours(new Date(fase.sla_vencimento), new Date());
      if (hoursLeft > 0 && hoursLeft < 24) return { label: `⏰ ${hoursLeft}h`, color: 'secondary' as const };
    }
    return null;
  };

  const PlatformIcon = ({ plataforma }: { plataforma: string }) => {
    if (plataforma === 'apple') return <Apple className="h-3.5 w-3.5" />;
    if (plataforma === 'google') return <Bot className="h-3.5 w-3.5" />;
    return <span className="flex gap-0.5"><Apple className="h-3 w-3" /><Bot className="h-3 w-3" /></span>;
  };

  const statusBorderColor = (status: string) => {
    if (status === 'atrasado') return 'border-l-destructive';
    if (status === 'concluido') return 'border-l-green-500';
    return 'border-l-primary';
  };

  const atorLabel = (ator: string) => {
    if (ator === 'analista') return { text: 'Analista', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    if (ator === 'designer') return { text: 'Designer', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' };
    return { text: ator, color: 'bg-muted text-muted-foreground border-border' };
  };
  const handleConfirmDrop = async () => {
    if (!pendingDrop) return;
    setDropping(true);
    try {
      const { clienteId, faseAtual, plataforma } = pendingDrop;
      const plat = plataforma === 'ambos' ? dropPlataforma : plataforma;

      let query = supabase.from('app_checklist_items').update({
        feito: true,
        feito_em: new Date().toISOString(),
        feito_por: user?.email || 'equipe_interna',
      }).eq('cliente_id', clienteId).eq('fase_numero', faseAtual).eq('feito', false);

      if (plat && plat !== 'ambas') {
        query = query.or(`plataforma.eq.${plat},plataforma.eq.compartilhada`);
      }

      const { error } = await query;
      if (error) throw error;

      await supabase.from('app_conversas').insert({
        cliente_id: clienteId,
        fase_numero: faseAtual,
        autor: user?.email || 'Sistema',
        tipo: 'sistema',
        mensagem: `Etapa "${FASE_NAMES[faseAtual]}" concluída via Kanban por ${user?.email}${plat && plat !== 'ambas' ? ` (${plat})` : ''}`,
      });

      queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });

      toast.success(`✅ ${pendingDrop.clienteNome} avançou para ${FASE_NAMES[pendingDrop.targetFase]}`);
    } catch (err: any) {
      toast.error('Erro ao avançar: ' + err.message);
    } finally {
      setDropping(false);
      setDropConfirmOpen(false);
      setPendingDrop(null);
      setDropPlataforma('ambas');
    }
  };

  // Count pending tasks for a client's current phase
  const getPendingCount = (clienteId: string, faseNum: number) => {
    return checklistCounts.filter(i => i.cliente_id === clienteId && i.fase_numero === faseNum && !i.feito).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Gestão de Aplicativos</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {clientes.filter(c => c.status !== 'concluido').length} clientes ativos · {atrasados} em atraso
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(slaViolados > 0 || atrasados > 0) && (
            <Button variant="outline" size="sm" className="text-destructive">
              <Bell className="h-4 w-4 mr-1" />
              {slaViolados + atrasados}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Cliente — Esteira de App</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>URL do Cliente *</Label>
                    <Input value={form.url_cliente} onChange={e => setForm(p => ({ ...p, url_cliente: e.target.value }))} placeholder="exemplo.curseduca.com" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-mail *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>WhatsApp</Label>
                    <Input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="5511999999999" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Plataforma *</Label>
                    <Select value={form.plataforma} onValueChange={v => setForm(p => ({ ...p, plataforma: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apple">🍎 Apple</SelectItem>
                        <SelectItem value="google">🤖 Google</SelectItem>
                        <SelectItem value="ambos">🍎+🤖 Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Responsável</Label>
                    <Input value={form.responsavel_nome} onChange={e => setForm(p => ({ ...p, responsavel_nome: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={createMutation.isPending}>
                    Fechar
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!form.nome || !form.url_cliente || !form.email || createMutation.isPending}
                    onClick={() => createMutation.mutate()}
                  >
                    {createMutation.isPending ? 'Criando...' : 'Criar cliente'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alert banner */}
      {(slaViolados > 0 || atrasados > 0) && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{slaViolados + atrasados} clientes precisam de atenção — SLA vencido ou cliente inativo</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            Kanban
          </TabsTrigger>
          <TabsTrigger value="pendencias" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Pendências Internas
            {totalInternalPending > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">{totalInternalPending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 mt-4 overflow-hidden">
          {/* Dashboard Gerencial */}
          {!isLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalAbertos}</p>
                      <p className="text-xs text-muted-foreground">Em aberto</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{atrasados}</p>
                      <p className="text-xs text-muted-foreground">Clientes atrasados</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className={`cursor-pointer transition-all ${kanbanFilter === 'atrasados' ? 'ring-2 ring-destructive' : ''}`}
                  onClick={() => setKanbanFilter(prev => prev === 'atrasados' ? 'todos' : 'atrasados')}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                      <Clock className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{fasesAtrasadas}</p>
                      <p className="text-xs text-muted-foreground">Etapas atrasadas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalConcluidos}</p>
                      <p className="text-xs text-muted-foreground">Publicados</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{avgProgress}%</p>
                      <p className="text-xs text-muted-foreground">Progresso médio</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {kanbanFilter === 'atrasados' && (
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="destructive" className="text-xs">Filtro ativo: Apenas clientes com etapas atrasadas</Badge>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setKanbanFilter('todos')}>Limpar filtro</Button>
                </div>
              )}

              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">Distribuição por etapa</p>
                  <div className="space-y-2">
                    {FASE_NAMES.map((name, idx) => {
                      const count = columns[idx]?.length || 0;
                      const pct = clientes.length > 0 ? Math.round((count / clientes.length) * 100) : 0;
                      const atrasadosNaFase = columns[idx]?.filter(c => c.status === 'atrasado').length || 0;
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{name}</span>
                          <div className="flex-1">
                            <Progress value={pct} className="h-2" />
                          </div>
                          <div className="flex items-center gap-1.5 w-16 shrink-0 justify-end">
                            <span className="text-xs font-medium">{count}</span>
                            {atrasadosNaFase > 0 && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0">{atrasadosNaFase}</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : (
            <div className="w-full overflow-x-auto pb-2">
              <div className="flex gap-3 pb-2" style={{ minWidth: `${7 * 280 + 6 * 12}px` }}>
                {FASE_NAMES.map((name, idx) => (
                  <div
                    key={idx}
                    className="w-[280px] shrink-0"
                    onDragOver={(e) => { e.preventDefault(); setDragOverColumn(idx); }}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverColumn(null);
                      const clienteId = e.dataTransfer.getData('clienteId');
                      const clienteNome = e.dataTransfer.getData('clienteNome');
                      const faseAtual = parseInt(e.dataTransfer.getData('faseAtual'));
                      const plataforma = e.dataTransfer.getData('plataforma');

                      if (idx !== faseAtual + 1) {
                        toast.error('Só é possível avançar para a próxima etapa');
                        return;
                      }
                      setPendingDrop({ clienteId, clienteNome, faseAtual, plataforma, targetFase: idx });
                      setDropPlataforma('ambas');
                      setDropConfirmOpen(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name}</span>
                      <Badge variant="secondary" className="text-[10px]">{columns[idx].length}</Badge>
                    </div>
                    <div className={`space-y-2 min-h-[200px] rounded-lg p-2 transition-all ${dragOverColumn === idx ? 'ring-2 ring-dashed ring-primary bg-primary/5' : 'bg-muted/30'}`}>
                      {columns[idx].map(c => {
                        const stats = getChecklistStats(c.id, c.fase_atual);
                        const sla = getSlaInfo(c.id, c.fase_atual);
                        const inactiveDays = getInactivityDays(c);
                        return (
                          <Card
                            key={c.id}
                            draggable={canDrag}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('clienteId', c.id);
                              e.dataTransfer.setData('clienteNome', c.nome);
                              e.dataTransfer.setData('faseAtual', String(c.fase_atual));
                              e.dataTransfer.setData('plataforma', c.plataforma);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${statusBorderColor(c.status)} ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                            onClick={() => navigate(`/hub/aplicativos/${c.id}`)}
                          >
                            <div className="flex items-start justify-between mb-1.5">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{c.nome}</p>
                                <p className="text-xs text-muted-foreground truncate">{c.empresa}</p>
                              </div>
                              <PlatformIcon plataforma={c.plataforma} />
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {sla && <Badge variant={sla.color} className="text-[10px] px-1.5">{sla.label}</Badge>}
                              {inactiveDays && inactiveDays > 2 && (
                                <Badge variant="outline" className="text-[10px] px-1.5">👤 {inactiveDays}d sem ação</Badge>
                              )}
                            </div>
                            <Progress value={c.porcentagem_geral} className="h-1.5 mb-1" />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>{stats.done}/{stats.total} tarefas</span>
                              {c.responsavel_nome && <span>{c.responsavel_nome}</span>}
                            </div>
                          </Card>
                        );
                      })}
                      {columns[idx].length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-8">Nenhum cliente</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pendencias" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <ClipboardList className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalInternalPending}</p>
                  <p className="text-xs text-muted-foreground">Pendências totais</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                  <Users className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{analystPending}</p>
                  <p className="text-xs text-muted-foreground">Do analista</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{designerPending}</p>
                  <p className="text-xs text-muted-foreground">Do designer</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{clientsWithPendencies}</p>
                  <p className="text-xs text-muted-foreground">Clientes com pendência</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={pendencyFilter} onValueChange={setPendencyFilter}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Filtrar por responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                <SelectItem value="sem_responsavel">⚠️ Aguardando alocação</SelectItem>
                {uniqueResponsaveis.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por fase" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as fases</SelectItem>
                {uniquePhases.map(phase => (
                  <SelectItem key={phase} value={String(phase)}>Fase {phase}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">🔵 Pendente</SelectItem>
                <SelectItem value="concluido">✅ Concluído</SelectItem>
              </SelectContent>
            </Select>
            {(() => {
              const activeFilterCount = [pendencyFilter, phaseFilter, statusFilter].filter(f => f !== 'todos' && f !== 'todas' && f !== 'pendente').length;
              return activeFilterCount > 0 ? (
                <>
                  <Badge variant="secondary" className="text-xs">{activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setPendencyFilter('todos'); setPhaseFilter('todas'); setStatusFilter('pendente'); }} className="text-xs">
                    Limpar filtros
                  </Button>
                </>
              ) : null;
            })()}
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredPendencies.reduce((sum, g) => sum + g.items.length, 0)} pendências em {filteredPendencies.length} clientes
            </span>
          </div>

          {/* Pending items grouped by client */}
          {filteredPendencies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="font-medium">Nenhuma pendência interna</p>
                <p className="text-sm mt-1">{pendencyFilter !== 'todos' ? 'Nenhum resultado para este filtro.' : 'Todas as tarefas internas estão concluídas.'}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredPendencies.map(({ clienteId, cliente, items }) => {
                if (!cliente) return null;
                return (
                  <Card key={clienteId} className="overflow-hidden">
                    <div
                      className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/hub/aplicativos/${clienteId}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlatformIcon plataforma={cliente.plataforma} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{cliente.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{cliente.empresa}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cliente.responsavel_nome ? (
                          <Badge variant="outline" className="text-xs">👤 {cliente.responsavel_nome}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">⚠️ Sem responsável</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Fase {cliente.fase_atual} — {FASE_NAMES[cliente.fase_atual] || '?'}
                        </Badge>
                        <Badge variant="destructive" className="text-xs">
                          {items.length} pendência{items.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      {/* Table header */}
                      <div className="grid grid-cols-[32px_1fr_100px_100px_90px_80px_70px] gap-2 px-4 py-2 bg-muted/20 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <span></span>
                        <span>Tarefa</span>
                        <span>Responsável</span>
                        <span>Data entrada</span>
                        <span>Data recebida</span>
                        <span>Status</span>
                        <span>Fase</span>
                      </div>
                      <div className="divide-y divide-border">
                        {items.map(item => {
                          const ator = atorLabel(item.ator);
                          const createdAt = new Date(item.created_at);
                          const dataEntrada = cliente.data_criacao ? new Date(cliente.data_criacao) : null;
                          const daysSinceCreated = differenceInDays(new Date(), createdAt);
                          const isOverdue = !item.feito && daysSinceCreated > 2;
                          const isCompleting = completingIds.has(item.id);
                          const isDone = item.feito || isCompleting;
                          const isPriority = item.texto?.startsWith('⚠️ PRIORIDADE');
                          const isMooni = item.tipo === 'mooni' || item.texto === 'Criar Mooni';

                          return (
                            <div key={item.id} className={`grid grid-cols-[32px_1fr_100px_100px_90px_80px_70px] gap-2 px-4 py-3 items-center transition-opacity ${isCompleting ? 'opacity-50' : ''} ${isMooni && !isDone ? 'bg-blue-500/10 border-l-2 border-blue-500' : isPriority && !isDone ? 'bg-destructive/10 border-l-2 border-destructive' : ''}`}>
                              {isMooni && !isDone ? (
                                <FileText className="h-4 w-4 text-blue-400" />
                              ) : (
                                <Checkbox
                                  checked={isDone}
                                  disabled={isDone || (isMooni && !isDone)}
                                  className="border-muted-foreground/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                                  onCheckedChange={(checked) => {
                                    if (checked && !item.feito) completeTask.mutate(item.id);
                                  }}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>{item.texto}</p>
                                  {isMooni && !isDone && (
                                    <Badge className="text-[10px] shrink-0 bg-blue-500/20 text-blue-400 border border-blue-500/30">MOONI</Badge>
                                  )}
                                  {isPriority && !isDone && (
                                    <Badge variant="destructive" className="text-[10px] shrink-0">PRIORIDADE</Badge>
                                  )}
                                </div>
                                {item.descricao && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">{item.descricao}</p>
                                )}
                                {item.feito && item.feito_em && (
                                  <p className="text-[10px] text-green-500/70 mt-0.5">Concluído em {format(new Date(item.feito_em), "dd/MM/yy 'às' HH:mm")}</p>
                                )}
                                {isMooni && !isDone && (
                                  <Button
                                    size="sm"
                                    className="mt-2 bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMooniItemId(item.id);
                                      setMooniClientName(cliente.nome);
                                      setMooniClientEmpresa(cliente.empresa);
                                      setMooniText('');
                                      setMooniDialogOpen(true);
                                    }}
                                  >
                                    <FileText className="h-3 w-3 mr-1" /> Criar Mooni
                                  </Button>
                                )}
                              </div>
                              <Badge variant="outline" className={`text-[10px] w-fit ${ator.color}`}>
                                {ator.text}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {dataEntrada ? format(dataEntrada, 'dd/MM/yy') : '—'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(createdAt, 'dd/MM/yy')}
                              </span>
                              <div>
                                {item.feito ? (
                                  <Badge className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20">✅ Concluído</Badge>
                                ) : isCompleting ? (
                                  <Badge className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20">✅ Concluído</Badge>
                                ) : isOverdue ? (
                                  <Badge variant="destructive" className="text-[10px]">Atrasado</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500">Em andamento</Badge>
                                )}
                              </div>
                              <Badge variant="outline" className="text-[10px] w-fit">
                                Fase {item.fase_numero}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Mooni Dialog */}
      <Dialog open={mooniDialogOpen} onOpenChange={setMooniDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Mooni — {mooniClientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Informações do Mooni</Label>
              <Textarea
                className="mt-2 min-h-[200px]"
                placeholder="Insira aqui todas as informações do Mooni necessárias para o designer: paleta de cores, estilo visual, referências, especificações técnicas, links relevantes..."
                value={mooniText}
                onChange={(e) => setMooniText(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!mooniText.trim() || mooniSaving}
              onClick={handleMooniSave}
            >
              {mooniSaving ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Salvar e concluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
