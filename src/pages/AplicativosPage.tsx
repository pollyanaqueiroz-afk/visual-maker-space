import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Bell, AlertTriangle, Apple, Bot, Clock, CheckCircle, Users, TrendingUp, ClipboardList, Filter, FileText, ChevronRight, Info, UserPlus, UserPen, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { format, differenceInHours, differenceInDays, addBusinessDays as fnsAddBusinessDays, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ResponsavelPicker component
function ResponsavelPicker({ currentValue, onSelect }: { currentValue: string; onSelect: (nome: string) => void }) {
  const [input, setInput] = useState(currentValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from('app_checklist_items')
      .select('responsavel')
      .not('responsavel', 'is', null)
      .then(({ data }) => {
        const nomes = [...new Set((data || []).map((d: any) => d.responsavel).filter(Boolean))] as string[];
        setSuggestions(nomes.sort());
      });
  }, []);

  const filtered = suggestions.filter(s =>
    !input || s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label className="text-xs">Responsável</Label>
      <Input placeholder="Nome ou email" value={input} onChange={e => setInput(e.target.value)} className="h-8 text-sm" />
      {filtered.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {filtered.map(nome => (
            <button key={nome} onClick={() => onSelect(nome)} className="w-full text-left px-2 py-1 text-sm rounded hover:bg-muted/50">
              {nome}
            </button>
          ))}
        </div>
      )}
      <Button size="sm" className="w-full" disabled={!input.trim()} onClick={() => onSelect(input.trim())}>
        Atribuir
      </Button>
    </div>
  );
}

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
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
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
  const canManage = canDrag;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('kanban');
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);
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
  const [pubUrlInputs, setPubUrlInputs] = useState<Record<string, string>>({});
  const [pubUrlExpanded, setPubUrlExpanded] = useState<Record<string, boolean>>({});
  const [pubUrlSaving, setPubUrlSaving] = useState<Set<string>>(new Set());
  const [filterResponsavelTask, setFilterResponsavelTask] = useState('all');

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

  // Smart URL matching state
  const [matchedClient, setMatchedClient] = useState<{ source: string; nome: string; email: string; id?: string } | null>(null);
  const [existingAppCliente, setExistingAppCliente] = useState(false);

  useEffect(() => {
    const url = form.url_cliente.trim();
    if (!url || url.length < 3) {
      setMatchedClient(null);
      setExistingAppCliente(false);
      return;
    }
    const timeout = setTimeout(async () => {
      // 1. Check app_clientes
      const { data: appCl } = await supabase
        .from('app_clientes')
        .select('id, nome')
        .eq('empresa', url)
        .maybeSingle();
      if (appCl) {
        setExistingAppCliente(true);
        setMatchedClient({ source: 'app_clientes', nome: appCl.nome, email: '', id: appCl.id });
        return;
      }
      setExistingAppCliente(false);

      // 2. Check clients (carteira)
      const { data: carteiraCl } = await supabase
        .from('clients')
        .select('id, client_name, email_do_cliente, client_url')
        .eq('client_url', url)
        .maybeSingle();
      if (carteiraCl) {
        setMatchedClient({ source: 'clients', nome: carteiraCl.client_name || '', email: carteiraCl.email_do_cliente || '' });
        setForm(p => ({
          ...p,
          nome: p.nome || carteiraCl.client_name || '',
          email: p.email || carteiraCl.email_do_cliente || '',
        }));
        return;
      }

      // 3. Check briefing_requests
      const { data: briefingCl } = await supabase
        .from('briefing_requests')
        .select('requester_name, requester_email, platform_url')
        .eq('platform_url', url)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (briefingCl) {
        setMatchedClient({ source: 'briefing_requests', nome: briefingCl.requester_name, email: briefingCl.requester_email });
        setForm(p => ({
          ...p,
          nome: p.nome || briefingCl.requester_name,
          email: p.email || briefingCl.requester_email,
        }));
        return;
      }

      setMatchedClient(null);
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.url_cliente]);

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
      const { data, error } = await supabase.from('app_fases').select('id, cliente_id, numero, sla_violado, sla_vencimento, porcentagem, status, plataforma');
      if (error) throw error;
      return data as (AppFase & { plataforma?: string })[];
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
        .select('id, cliente_id, fase_numero, texto, descricao, ator, tipo, feito, feito_em, feito_por, created_at, plataforma, responsavel, sla_horas, sla_vencimento')
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
      setMatchedClient(null);
      setExistingAppCliente(false);
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

  const updateResponsavel = async (itemId: string, nome: string, clienteId?: string, faseNumero?: number) => {
    await (supabase.from('app_checklist_items').update({
      responsavel: nome,
      sla_vencimento: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any) as any).eq('id', itemId);

    if (clienteId) {
      await supabase.from('app_conversas').insert({
        cliente_id: clienteId,
        fase_numero: faseNumero || 0,
        autor: user?.email || 'Sistema',
        tipo: 'sistema',
        mensagem: `Tarefa atribuída a ${nome} por ${user?.email}`,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });
    toast.success(`Atribuído a ${nome}`);
  };

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

  // KPI detail lists
  const kpiClientLists = useMemo(() => {
    const abertos = clientes.filter(c => c.fase_atual < 6);
    const atrasadosList = clientes.filter(c => c.status === 'atrasado');
    const etapasAtrasadasList = (() => {
      const fasesAtrasadasData = fases.filter(f => f.sla_violado || f.status === 'atrasada');
      return fasesAtrasadasData.map(f => {
        const c = clientes.find(cl => cl.id === f.cliente_id);
        return c ? { ...c, faseAtrasada: f.numero, plataformaFase: (f as any).plataforma } : null;
      }).filter(Boolean) as (AppCliente & { faseAtrasada: number; plataformaFase?: string })[];
    })();
    const publicados = clientes.filter(c => c.fase_atual >= 6);
    const progressoList = clientes.filter(c => c.fase_atual < 6).sort((a, b) => b.porcentagem_geral - a.porcentagem_geral);
    // Clients needing attention: SLA violated or status atrasado (deduplicated)
    const atencaoIds = new Set<string>();
    const atencaoList: (AppCliente & { motivo: string })[] = [];
    for (const c of clientes) {
      if (c.status === 'atrasado' && !atencaoIds.has(c.id)) {
        atencaoIds.add(c.id);
        atencaoList.push({ ...c, motivo: 'Cliente inativo' });
      }
    }
    for (const f of fases.filter(f => f.sla_violado)) {
      const c = clientes.find(cl => cl.id === f.cliente_id);
      if (c && !atencaoIds.has(c.id)) {
        atencaoIds.add(c.id);
        atencaoList.push({ ...c, motivo: `SLA vencido — Fase ${f.numero}` });
      } else if (c && atencaoIds.has(c.id)) {
        const existing = atencaoList.find(a => a.id === c.id);
        if (existing && existing.motivo === 'Cliente inativo') {
          existing.motivo = `Cliente inativo + SLA vencido`;
        }
      }
    }
    return { abertos, atrasadosList, etapasAtrasadasList, publicados, progressoList, atencaoList };
  }, [clientes, fases]);

  const activeClientes = useMemo(() => clientes.filter(c => c.status !== 'cancelado'), [clientes]);
  const cancelledClientes = useMemo(() => clientes.filter(c => c.status === 'cancelado'), [clientes]);

  const columns = useMemo(() => {
    const cols: Record<number, AppCliente[]> = {};
    for (let i = 0; i <= 6; i++) cols[i] = [];
    const filtered = kanbanFilter === 'atrasados'
      ? activeClientes.filter(c => clientesComFaseAtrasada.has(c.id) || c.status === 'atrasado')
      : activeClientes;
    filtered.forEach(c => {
      const fase = Math.min(c.fase_atual, 6);
      cols[fase].push(c);
    });
    return cols;
  }, [activeClientes, kanbanFilter, clientesComFaseAtrasada]);

  // Internal pendencies grouped by client (exclude cancelled)
  const internalPendencies = useMemo(() => {
    const activeClienteIds = new Set(activeClientes.map(c => c.id));
    const clientMap = new Map<string, typeof allChecklist>();
    allChecklist.filter(item => activeClienteIds.has(item.cliente_id)).forEach(item => {
      const existing = clientMap.get(item.cliente_id) || [];
      existing.push(item);
      clientMap.set(item.cliente_id, existing);
    });

    return Array.from(clientMap.entries()).map(([clienteId, items]) => {
      const cliente = activeClientes.find(c => c.id === clienteId);
      return { clienteId, cliente, items };
    }).filter(g => {
      if (!g.cliente) return false;
      // Filter out items from phases the client has already passed (backfilled items), but keep Mooni tasks and alerts
      g.items = g.items.filter((item: any) => item.fase_numero >= g.cliente!.fase_atual || item.tipo === 'mooni' || item.texto === 'Criar Mooni' || item.tipo === 'alerta_prazo');
      // Sort alerta_prazo items first within each group
      g.items.sort((a: any, b: any) => {
        if (a.tipo === 'alerta_prazo' && b.tipo !== 'alerta_prazo') return -1;
        if (a.tipo !== 'alerta_prazo' && b.tipo === 'alerta_prazo') return 1;
        return 0;
      });
      return g.items.length > 0;
    })
      .sort((a, b) => {
        // Groups with alerts come first
        const aAlert = a.items.some((i: any) => i.tipo === 'alerta_prazo' && !i.feito);
        const bAlert = b.items.some((i: any) => i.tipo === 'alerta_prazo' && !i.feito);
        if (aAlert && !bAlert) return -1;
        if (!aAlert && bAlert) return 1;
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
    // Task-level responsável filter
    if (filterResponsavelTask === 'unassigned') {
      result = result.map(g => ({
        ...g,
        items: g.items.filter((item: any) => !item.responsavel),
      })).filter(g => g.items.length > 0);
    } else if (filterResponsavelTask !== 'all') {
      result = result.map(g => ({
        ...g,
        items: g.items.filter((item: any) => item.responsavel === filterResponsavelTask),
      })).filter(g => g.items.length > 0);
    }
    return result;
  }, [internalPendencies, pendencyFilter, phaseFilter, statusFilter, filterResponsavelTask]);

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

  const uniqueTaskResponsaveis = useMemo(() => {
    const names = new Set<string>();
    internalPendencies.forEach(g => g.items.forEach((item: any) => { if (item.responsavel) names.add(item.responsavel); }));
    return Array.from(names).sort();
  }, [internalPendencies]);

  const unassignedTaskCount = useMemo(() => {
    return internalPendencies.reduce((sum, g) => sum + g.items.filter((i: any) => !i.responsavel && !i.feito).length, 0);
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

  const addBusinessDays = (date: Date, days: number) => {
    let count = 0;
    const result = new Date(date);
    while (count < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return result;
  };

  // Toast alert for overdue deadlines
  useEffect(() => {
    if (!allChecklist.length) return;
    const alertas = allChecklist.filter((i: any) => i.tipo === 'alerta_prazo' && !i.feito);
    if (alertas.length > 0) {
      const clienteIds = [...new Set(alertas.map((a: any) => a.cliente_id))];
      const clienteNomes = clienteIds.map(id => clientes.find(c => c.id === id)?.nome).filter(Boolean);
      toast.error(
        `🚨 ${alertas.length} prazo${alertas.length > 1 ? 's' : ''} excedido${alertas.length > 1 ? 's' : ''} — ${clienteNomes.join(', ')}`,
        { duration: 8000, id: 'prazo-alertas' }
      );
    }
  }, [allChecklist, clientes]);

  const handlePubUrlConfirm = async (item: any, clienteId: string) => {
    const urlInput = pubUrlInputs[item.id]?.trim();
    if (!urlInput) { toast.error('Informe a URL da loja'); return; }
    setPubUrlSaving(prev => new Set(prev).add(item.id));
    try {
      const urlField = item.plataforma === 'google' ? 'url_loja_google' : 'url_loja_apple';
      await supabase.from('app_clientes').update({ [urlField]: urlInput } as any).eq('id', clienteId);
      await supabase.from('app_checklist_items').update({
        feito: true, feito_em: new Date().toISOString(), feito_por: user?.email || 'equipe_interna',
      }).eq('id', item.id);
      await supabase.functions.invoke('notify-app-client', {
        body: { tipo: 'app_publicado', cliente_id: clienteId, plataforma: item.plataforma, url_loja: urlInput },
      });
      await supabase.from('app_notificacoes').insert({
        cliente_id: clienteId, tipo: 'app_publicado', canal: 'email', destinatario: 'cliente',
        titulo: item.plataforma === 'google' ? '🎉 Seu app está na Google Play!' : '🎉 Seu app está na App Store!',
        mensagem: `Seu aplicativo foi publicado! Acesse: ${urlInput}`,
        agendado_para: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-full'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
      queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
      queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
      setPubUrlExpanded(prev => ({ ...prev, [item.id]: false }));
      setPubUrlInputs(prev => ({ ...prev, [item.id]: '' }));
      toast.success('✅ Publicação confirmada e cliente notificado!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao confirmar publicação');
    } finally {
      setPubUrlSaving(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
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

                {/* Smart URL match feedback */}
                {existingAppCliente && matchedClient && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-500">Cliente já cadastrado</p>
                      <p className="text-xs text-amber-400/70">"{matchedClient.nome}" já está na gestão de aplicativos.</p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs text-amber-500 shrink-0" onClick={() => { setDialogOpen(false); navigate(`/hub/aplicativos/${matchedClient.id}`); }}>
                      Ver detalhe
                    </Button>
                  </div>
                )}
                {!existingAppCliente && matchedClient?.source === 'clients' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-500">Cliente encontrado na carteira</p>
                      <p className="text-xs text-green-400/70">Dados auto-preenchidos: {matchedClient.nome} ({matchedClient.email})</p>
                    </div>
                  </div>
                )}
                {!existingAppCliente && matchedClient?.source === 'briefing_requests' && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-500">Cliente encontrado em solicitações de design</p>
                      <p className="text-xs text-blue-400/70">Dados auto-preenchidos: {matchedClient.nome} ({matchedClient.email})</p>
                    </div>
                  </div>
                )}

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
                    disabled={!form.nome || !form.url_cliente || !form.email || createMutation.isPending || existingAppCliente}
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
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive cursor-pointer hover:bg-destructive/10 transition-colors"
          onClick={() => setExpandedKpi(prev => prev === 'atencao' ? null : 'atencao')}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{kpiClientLists.atencaoList.length} clientes precisam de atenção — SLA vencido ou cliente inativo</span>
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expandedKpi === 'atencao' ? 'rotate-90' : ''}`} />
        </div>
      )}
      {expandedKpi === 'atencao' && kpiClientLists.atencaoList.length > 0 && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">🚨 Clientes que precisam de atenção ({kpiClientLists.atencaoList.length})</p>
              <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setExpandedKpi(null)}>Fechar</Button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {kpiClientLists.atencaoList.map((c: any) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/hub/aplicativos/${c.id}`)}
                >
                  <PlatformIcon plataforma={c.plataforma} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.empresa}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">Fase {c.fase_atual}</Badge>
                    <Badge variant="destructive" className="text-[10px]">{c.motivo}</Badge>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
          {canManage && (
            <TabsTrigger value="produtividade" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Produtividade
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 mt-4 overflow-hidden">
          {/* Dashboard Gerencial */}
          {!isLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className={`cursor-pointer transition-all ${expandedKpi === 'abertos' ? 'ring-2 ring-primary' : 'hover:border-primary/40'}`}
                  onClick={() => setExpandedKpi(prev => prev === 'abertos' ? null : 'abertos')}>
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
                <Card className={`cursor-pointer transition-all ${expandedKpi === 'atrasados' ? 'ring-2 ring-destructive' : 'hover:border-destructive/40'}`}
                  onClick={() => setExpandedKpi(prev => prev === 'atrasados' ? null : 'atrasados')}>
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
                <Card className={`cursor-pointer transition-all ${expandedKpi === 'etapas' ? 'ring-2 ring-destructive' : kanbanFilter === 'atrasados' ? 'ring-2 ring-destructive' : 'hover:border-destructive/40'}`}
                  onClick={() => {
                    setExpandedKpi(prev => prev === 'etapas' ? null : 'etapas');
                    setKanbanFilter(prev => prev === 'atrasados' ? 'todos' : 'atrasados');
                  }}>
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
                <Card className={`cursor-pointer transition-all ${expandedKpi === 'publicados' ? 'ring-2 ring-green-500' : 'hover:border-green-500/40'}`}
                  onClick={() => setExpandedKpi(prev => prev === 'publicados' ? null : 'publicados')}>
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
                <Card className={`cursor-pointer transition-all ${expandedKpi === 'progresso' ? 'ring-2 ring-blue-500' : 'hover:border-blue-500/40'}`}
                  onClick={() => setExpandedKpi(prev => prev === 'progresso' ? null : 'progresso')}>
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

              {/* Expanded KPI detail panel */}
              {expandedKpi && (() => {
                const config: Record<string, { title: string; list: any[]; renderExtra?: (c: any) => React.ReactNode }> = {
                  abertos: {
                    title: `📂 Em aberto (${kpiClientLists.abertos.length})`,
                    list: kpiClientLists.abertos,
                  },
                  atrasados: {
                    title: `🚨 Clientes atrasados (${kpiClientLists.atrasadosList.length})`,
                    list: kpiClientLists.atrasadosList,
                  },
                  etapas: {
                    title: `⏰ Etapas atrasadas (${kpiClientLists.etapasAtrasadasList.length})`,
                    list: kpiClientLists.etapasAtrasadasList,
                    renderExtra: (c: any) => (
                      <Badge variant="destructive" className="text-[10px]">
                        Fase {c.faseAtrasada} — {FASE_NAMES[c.faseAtrasada] || ''}
                        {c.plataformaFase && c.plataformaFase !== 'compartilhada' ? ` (${c.plataformaFase === 'google' ? '🤖' : '🍎'})` : ''}
                      </Badge>
                    ),
                  },
                  publicados: {
                    title: `✅ Publicados (${kpiClientLists.publicados.length})`,
                    list: kpiClientLists.publicados,
                  },
                  progresso: {
                    title: `📊 Progresso médio: ${avgProgress}% (${kpiClientLists.progressoList.length} clientes)`,
                    list: kpiClientLists.progressoList,
                    renderExtra: (c: any) => (
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={c.porcentagem_geral} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium text-muted-foreground w-8 text-right">{c.porcentagem_geral}%</span>
                      </div>
                    ),
                  },
                };
                const { title, list, renderExtra } = config[expandedKpi] || { title: '', list: [] };
                return (
                  <Card className="border-border/60">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold">{title}</p>
                        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setExpandedKpi(null)}>Fechar</Button>
                      </div>
                      {list.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente nesta categoria</p>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {list.map((c: any, i: number) => (
                            <div
                              key={`${c.id}-${i}`}
                              className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => navigate(`/hub/aplicativos/${c.id}`)}
                            >
                              <PlatformIcon plataforma={c.plataforma} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{c.nome}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{c.empresa}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[10px]">Fase {c.fase_atual}</Badge>
                                {renderExtra?.(c)}
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

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

          {/* Unassigned alert */}
          {unassignedTaskCount > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 shrink-0">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">{unassignedTaskCount} tarefa{unassignedTaskCount > 1 ? 's' : ''} sem responsável atribuído</p>
                <p className="text-xs text-destructive/60">Atribua um responsável para garantir rastreabilidade e SLA</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setFilterResponsavelTask('unassigned')}>Ver tarefas</Button>
            </div>
          )}

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
            <Select value={filterResponsavelTask} onValueChange={setFilterResponsavelTask}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Responsável tarefa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                <SelectItem value="unassigned">⚠️ Sem responsável</SelectItem>
                {uniqueTaskResponsaveis.map(nome => (
                  <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const activeFilterCount = [pendencyFilter, phaseFilter, statusFilter, filterResponsavelTask].filter(f => f !== 'todos' && f !== 'todas' && f !== 'pendente' && f !== 'all').length;
              return activeFilterCount > 0 ? (
                <>
                  <Badge variant="secondary" className="text-xs">{activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => { setPendencyFilter('todos'); setPhaseFilter('todas'); setStatusFilter('pendente'); setFilterResponsavelTask('all'); }} className="text-xs">
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
                          const isPubUrl = item.tipo === 'publicacao_url';

                          // Special rendering for alerta_prazo
                          if (item.tipo === 'alerta_prazo') {
                            return (
                              <div key={item.id} className={`grid grid-cols-[32px_1fr_100px_100px_90px_80px_70px] gap-2 px-4 py-3 items-center ${isDone ? 'opacity-60' : 'bg-destructive/5 border-l-4 border-destructive'}`}>
                                <AlertTriangle className={`h-4 w-4 ${isDone ? 'text-muted-foreground' : 'text-destructive'}`} />
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold ${isDone ? 'line-through text-muted-foreground' : 'text-destructive'}`}>{item.texto}</p>
                                  <p className={`text-xs mt-0.5 ${isDone ? 'text-muted-foreground' : 'text-destructive/60'}`}>{item.descricao}</p>
                                  {isDone && item.feito_em && (
                                    <p className="text-[10px] text-green-500/70 mt-0.5">Resolvido em {format(new Date(item.feito_em), "dd/MM/yy 'às' HH:mm")}</p>
                                  )}
                                  {!isDone && (
                                    <Checkbox
                                      checked={false}
                                      className="mt-2 border-destructive/30 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                                      onCheckedChange={(checked) => {
                                        if (checked) completeTask.mutate(item.id);
                                      }}
                                    />
                                  )}
                                </div>
                                <Badge variant="outline" className={`text-[10px] w-fit ${ator.color}`}>{ator.text}</Badge>
                                <span className="text-xs text-muted-foreground">{dataEntrada ? format(dataEntrada, 'dd/MM/yy') : '—'}</span>
                                <span className="text-xs text-muted-foreground">{format(createdAt, 'dd/MM/yy')}</span>
                                <div>
                                  {isDone ? (
                                    <Badge className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20">✅ Resolvido</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-[10px]">URGENTE</Badge>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px] w-fit">Fase {item.fase_numero}</Badge>
                              </div>
                            );
                          }

                          // Special rendering for publicacao_url
                          if (isPubUrl) {
                            const fase6 = fases.find(f => f.cliente_id === clienteId && f.numero === 6 && (f as any).plataforma === item.plataforma);
                            const startDate = (fase6 as any)?.data_inicio ? new Date((fase6 as any).data_inicio) : new Date(item.created_at);
                            const deadline = addBusinessDays(startDate, 1);
                            const pubOverdue = !item.feito && new Date() > deadline;
                            const daysOver = pubOverdue ? differenceInDays(new Date(), deadline) : 0;
                            const isExpanded = pubUrlExpanded[item.id];
                            const isSaving = pubUrlSaving.has(item.id);

                            return (
                              <div key={item.id} className="px-4 py-3">
                                <div className={`p-4 rounded-lg border ${pubOverdue ? 'bg-destructive/10 border-destructive/30' : isDone ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {item.plataforma === 'google' ? <span>🤖</span> : <span>🍎</span>}
                                      <span className="text-sm font-medium">{item.texto}</span>
                                      <Badge variant="outline" className="text-[10px] w-fit">Fase 6</Badge>
                                    </div>
                                    {isDone ? (
                                      <Badge className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20">✅ Concluído</Badge>
                                    ) : pubOverdue ? (
                                      <Badge variant="destructive" className="text-[10px]">🚨 Atrasado ({daysOver} dia{daysOver > 1 ? 's' : ''})</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500">Prazo: {format(deadline, 'dd/MM/yyyy')}</Badge>
                                    )}
                                  </div>
                                  {pubOverdue && !isDone && (
                                    <p className="text-xs text-destructive mb-2">⚠️ Deveria ter sido concluído até {format(deadline, 'dd/MM/yyyy')}. Por favor, confirme a publicação o mais rápido possível.</p>
                                  )}
                                  {isDone && item.feito_em && (
                                    <p className="text-[10px] text-green-500/70 mt-1">Concluído em {format(new Date(item.feito_em), "dd/MM/yy 'às' HH:mm")}</p>
                                  )}
                                  {!isDone && !isExpanded && (
                                    <Button size="sm" className="mt-2" onClick={() => setPubUrlExpanded(prev => ({ ...prev, [item.id]: true }))}>
                                      <ExternalLink className="h-3 w-3 mr-1" /> Confirmar Publicação
                                    </Button>
                                  )}
                                  {!isDone && isExpanded && (
                                    <div className="mt-3 space-y-2">
                                      <Label className="text-xs">URL do app na {item.plataforma === 'google' ? 'Google Play Store' : 'App Store'} *</Label>
                                      <Input
                                        placeholder={item.plataforma === 'google' ? 'https://play.google.com/store/apps/details?id=...' : 'https://apps.apple.com/app/...'}
                                        value={pubUrlInputs[item.id] || ''}
                                        onChange={e => setPubUrlInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                      />
                                      <div className="flex gap-2">
                                        <Button size="sm" className="flex-1" disabled={!pubUrlInputs[item.id]?.trim() || isSaving}
                                          onClick={() => handlePubUrlConfirm(item, clienteId)}>
                                          {isSaving ? 'Confirmando...' : '✅ Confirmar e Notificar Cliente'}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setPubUrlExpanded(prev => ({ ...prev, [item.id]: false }))}>Cancelar</Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

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

        {/* Produtividade Tab */}
        {canManage && (
          <TabsContent value="produtividade" className="space-y-6 mt-4">
            {(() => {
              const doneItems = allChecklist.filter((i: any) => i.feito && i.feito_em);
              const onTime = doneItems.filter((i: any) => !i.sla_vencimento || new Date(i.feito_em) <= new Date(i.sla_vencimento)).length;
              const late = doneItems.filter((i: any) => i.sla_vencimento && new Date(i.feito_em) > new Date(i.sla_vencimento)).length;
              const totalDone = doneItems.length;
              const slaRate = totalDone > 0 ? Math.round((onTime / totalDone) * 100) : 100;

              // Per-person stats
              const perPerson: Record<string, { done: number; onTime: number; late: number; slaRate: number; pending: number; avgHours: string }> = {};
              allChecklist.forEach((item: any) => {
                const nome = item.responsavel || 'Sem responsável';
                if (!perPerson[nome]) perPerson[nome] = { done: 0, onTime: 0, late: 0, slaRate: 0, pending: 0, avgHours: '0' };
                if (item.feito) {
                  perPerson[nome].done++;
                  if (!item.sla_vencimento || new Date(item.feito_em) <= new Date(item.sla_vencimento)) perPerson[nome].onTime++;
                  else perPerson[nome].late++;
                } else {
                  perPerson[nome].pending++;
                }
              });
              Object.entries(perPerson).forEach(([nome, stats]) => {
                stats.slaRate = stats.done > 0 ? Math.round((stats.onTime / stats.done) * 100) : 100;
                const personItems = allChecklist.filter((i: any) => (i.responsavel || 'Sem responsável') === nome && i.feito && i.feito_em && i.created_at);
                if (personItems.length > 0) {
                  const totalH = personItems.reduce((sum: number, i: any) => sum + (new Date(i.feito_em).getTime() - new Date(i.created_at).getTime()) / 3600000, 0);
                  stats.avgHours = (totalH / personItems.length).toFixed(1);
                }
              });

              // Monthly chart data (last 6 months)
              const monthlyData = Array.from({ length: 6 }, (_, idx) => {
                const d = subMonths(new Date(), 5 - idx);
                const monthStart = startOfMonth(d);
                const nextMonth = startOfMonth(subMonths(new Date(), 4 - idx));
                const monthItems = doneItems.filter((i: any) => {
                  const fe = new Date(i.feito_em);
                  return fe >= monthStart && (idx < 5 ? fe < nextMonth : true);
                });
                return {
                  month: format(monthStart, 'MMM/yy', { locale: ptBR }),
                  noPrazo: monthItems.filter((i: any) => !i.sla_vencimento || new Date(i.feito_em) <= new Date(i.sla_vencimento)).length,
                  atrasadas: monthItems.filter((i: any) => i.sla_vencimento && new Date(i.feito_em) > new Date(i.sla_vencimento)).length,
                };
              });

              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Total concluídas</p><p className="text-2xl font-bold">{totalDone}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">No prazo</p><p className="text-2xl font-bold text-green-500">{onTime}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">Fora do prazo</p><p className="text-2xl font-bold text-destructive">{late}</p></CardContent></Card>
                    <Card><CardContent className="pt-4 pb-3"><p className="text-xs text-muted-foreground">SLA Compliance</p><p className={`text-2xl font-bold ${slaRate >= 80 ? 'text-green-500' : slaRate >= 60 ? 'text-amber-500' : 'text-destructive'}`}>{slaRate}%</p></CardContent></Card>
                  </div>

                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Desempenho por Responsável</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Responsável</TableHead>
                            <TableHead className="text-center">Concluídas</TableHead>
                            <TableHead className="text-center">No prazo</TableHead>
                            <TableHead className="text-center">Atrasadas</TableHead>
                            <TableHead className="text-center">SLA %</TableHead>
                            <TableHead className="text-center">Pendentes</TableHead>
                            <TableHead className="text-center">Tempo médio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(perPerson).sort(([,a], [,b]) => b.done - a.done).map(([nome, stats]) => (
                            <TableRow key={nome}>
                              <TableCell className="font-medium">{nome}</TableCell>
                              <TableCell className="text-center">{stats.done}</TableCell>
                              <TableCell className="text-center text-green-500">{stats.onTime}</TableCell>
                              <TableCell className="text-center text-destructive">{stats.late}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className={`text-xs ${stats.slaRate >= 80 ? 'border-green-500/30 text-green-500' : stats.slaRate >= 60 ? 'border-amber-500/30 text-amber-500' : 'border-destructive/30 text-destructive'}`}>{stats.slaRate}%</Badge>
                              </TableCell>
                              <TableCell className="text-center">{stats.pending}</TableCell>
                              <TableCell className="text-center text-muted-foreground text-xs">{stats.avgHours}h</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Entregas por Mês</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="noPrazo" name="No prazo" fill="hsl(var(--primary))" stackId="stack" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="atrasadas" name="Atrasadas" fill="hsl(var(--destructive))" stackId="stack" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>
        )}
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
      {/* Drop confirmation dialog */}
      <AlertDialog open={dropConfirmOpen} onOpenChange={setDropConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir etapa?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Ao mover <span className="font-semibold text-foreground">{pendingDrop?.clienteNome}</span> para
                  "<span className="font-semibold text-foreground">{FASE_NAMES[pendingDrop?.targetFase || 0]}</span>",
                  todas as tarefas pendentes da fase "<span className="font-semibold text-foreground">{FASE_NAMES[pendingDrop?.faseAtual || 0]}</span>"
                  serão marcadas como concluídas.
                </p>
                {pendingDrop && (
                  <p className="text-sm text-amber-500">
                    ⚠️ {getPendingCount(pendingDrop.clienteId, pendingDrop.faseAtual)} tarefa(s) serão concluídas automaticamente
                  </p>
                )}
                {pendingDrop?.plataforma === 'ambos' && (
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium text-foreground">Qual plataforma avançar?</p>
                    <div className="flex gap-2">
                      <Button
                        variant={dropPlataforma === 'google' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDropPlataforma('google')}
                      >🤖 Google Play</Button>
                      <Button
                        variant={dropPlataforma === 'apple' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDropPlataforma('apple')}
                      >🍎 Apple</Button>
                      <Button
                        variant={dropPlataforma === 'ambas' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDropPlataforma('ambas')}
                      >Ambas</Button>
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={dropping}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={dropping} onClick={handleConfirmDrop}>
              {dropping ? 'Movendo...' : 'Confirmar e avançar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
