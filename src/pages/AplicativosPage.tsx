import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Plus, Bell, AlertTriangle, Apple, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FASE_NAMES = [
  'Pré-Requisitos',
  'Primeiros Passos',
  'Validação Loja',
  'Assets',
  'Formulário',
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    nome: '', empresa: '', email: '', whatsapp: '', plataforma: 'ambos', responsavel_nome: '',
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_clientes').insert({
        nome: form.nome,
        empresa: form.empresa,
        email: form.email,
        whatsapp: form.whatsapp || null,
        plataforma: form.plataforma,
        responsavel_nome: form.responsavel_nome || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-clientes'] });
      queryClient.invalidateQueries({ queryKey: ['app-fases-all'] });
      queryClient.invalidateQueries({ queryKey: ['app-checklist-counts'] });
      setDialogOpen(false);
      setForm({ nome: '', empresa: '', email: '', whatsapp: '', plataforma: 'ambos', responsavel_nome: '' });
      toast.success('Cliente criado com sucesso! Fases e checklist gerados automaticamente.');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const atrasados = clientes.filter(c => c.status === 'atrasado').length;
  const slaViolados = fases.filter(f => f.sla_violado).length;

  // Group clients by fase_atual
  const columns = useMemo(() => {
    const cols: Record<number, AppCliente[]> = {};
    for (let i = 0; i <= 8; i++) cols[i] = [];
    clientes.forEach(c => {
      const fase = Math.min(c.fase_atual, 8);
      cols[fase].push(c);
    });
    return cols;
  }, [clientes]);

  // Checklist stats per client/fase
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
                    <Label>URL do Cliente *</Label>
                    <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="exemplo.curseduca.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empresa *</Label>
                    <Input value={form.empresa} onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))} />
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
                <Button
                  className="w-full"
                  disabled={!form.nome || !form.empresa || !form.email || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar cliente'}
                </Button>
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

      {/* Kanban */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4" style={{ minWidth: 9 * 280 }}>
            {FASE_NAMES.map((name, idx) => (
              <div key={idx} className="w-[280px] shrink-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name}</span>
                  <Badge variant="secondary" className="text-[10px]">{columns[idx].length}</Badge>
                </div>
                <div className="space-y-2 min-h-[200px] rounded-lg bg-muted/30 p-2">
                  {columns[idx].map(c => {
                    const stats = getChecklistStats(c.id, c.fase_atual);
                    const sla = getSlaInfo(c.id, c.fase_atual);
                    const inactiveDays = getInactivityDays(c);
                    return (
                      <Card
                        key={c.id}
                        className={`p-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${statusBorderColor(c.status)}`}
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
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}
