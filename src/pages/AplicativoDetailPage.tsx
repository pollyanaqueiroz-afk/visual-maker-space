import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { ArrowLeft, Copy, ExternalLink, Clock, CheckCircle2, Circle, Lock, AlertTriangle, Upload, MessageSquare, Image as ImageIcon, ShieldCheck, RotateCcw, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { differenceInHours, differenceInDays, format } from 'date-fns';

const FASE_NAMES = ['Pré-Requisitos','Primeiros Passos','Validação pela Loja','Criação e Submissão','Aprovação das Lojas','Teste do App','Publicado 🎉'];

export default function AplicativoDetailPage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const { hasPermission, hasRole } = usePermissions();
  const { user } = useAuth();
  const isGerenteImpl = hasRole('gerente_implantacao');
  const canManage = hasRole('admin') || hasRole('gerente_implantacao') || hasRole('analista_implantacao');
  const canEdit = hasPermission('aplicativos.edit') || isGerenteImpl || canManage;
  const queryClient = useQueryClient();
  const [selectedFase, setSelectedFase] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationItemId, setValidationItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState({ nome: '', email: '', empresa: '', plataforma: '', responsavel_nome: '', prazo_estimado: '' });
  const [manualFase, setManualFase] = useState<string>('');

  const { data: cliente } = useQuery({
    queryKey: ['app-cliente', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_clientes').select('*').eq('id', clienteId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: fases = [] } = useQuery({
    queryKey: ['app-fases', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_fases').select('*').eq('cliente_id', clienteId!).order('numero');
      if (error) throw error;
      return data;
    },
  });

  const { data: checklist = [] } = useQuery({
    queryKey: ['app-checklist', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_checklist_items').select('*').eq('cliente_id', clienteId!).order('ordem');
      if (error) throw error;
      return data;
    },
  });

  const { data: conversas = [] } = useQuery({
    queryKey: ['app-conversas', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_conversas').select('*').eq('cliente_id', clienteId!).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: formulario } = useQuery({
    queryKey: ['app-formulario', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_formulario').select('*').eq('cliente_id', clienteId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: appAssets = [] } = useQuery({
    queryKey: ['app-assets', clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_assets').select('*').eq('cliente_id', clienteId!);
      if (error) throw error;
      return data || [];
    },
  });

  const [formData, setFormData] = useState({ nome_app: '', descricao_curta: '', descricao_longa: '', url_privacidade: '', url_termos: '' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (formulario) {
      setFormData({
        nome_app: formulario.nome_app || '',
        descricao_curta: formulario.descricao_curta || '',
        descricao_longa: formulario.descricao_longa || '',
        url_privacidade: formulario.url_privacidade || '',
        url_termos: formulario.url_termos || '',
      });
    }
  }, [formulario]);

  // Init client form when cliente loads
  useEffect(() => {
    if (cliente) {
      setClientForm({
        nome: cliente.nome || '', email: cliente.email || '', empresa: cliente.empresa || '',
        plataforma: cliente.plataforma || '', responsavel_nome: cliente.responsavel_nome || '',
        prazo_estimado: cliente.prazo_estimado || '',
      });
      setManualFase(String(cliente.fase_atual ?? 0));
    }
  }, [cliente]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['app-checklist', clienteId] });
    queryClient.invalidateQueries({ queryKey: ['app-fases', clienteId] });
    queryClient.invalidateQueries({ queryKey: ['app-cliente', clienteId] });
  };

  const toggleItem = useMutation({
    mutationFn: async ({ id, feito, texto }: { id: string; feito: boolean; texto?: string }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        feito,
        feito_em: feito ? new Date().toISOString() : null,
        feito_por: feito ? (user?.email || 'admin') : null,
      }).eq('id', id);
      if (error) throw error;

      // Audit trail for unconclude
      if (!feito && canManage && texto) {
        await supabase.from('app_conversas').insert({
          cliente_id: clienteId!,
          fase_numero: selectedFase,
          autor: user?.email || 'admin',
          tipo: 'sistema',
          mensagem: `Tarefa "${texto}" desconcluída manualmente por ${user?.email}`,
        });
      }
    },
    onSuccess: invalidateAll,
  });

  const saveItemText = useMutation({
    mutationFn: async ({ id, texto, descricao }: { id: string; texto: string; descricao: string }) => {
      const { error } = await supabase.from('app_checklist_items').update({ texto, descricao, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditingItemId(null); toast.success('Item atualizado!'); },
  });

  const saveClientData = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_clientes').update({
        nome: clientForm.nome, email: clientForm.email, empresa: clientForm.empresa,
        plataforma: clientForm.plataforma, responsavel_nome: clientForm.responsavel_nome,
        prazo_estimado: clientForm.prazo_estimado || null,
      }).eq('id', clienteId!);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditingClient(false); toast.success('Dados do cliente salvos!'); },
  });

  const changeManualFase = useMutation({
    mutationFn: async (targetFase: number) => {
      // Update fase_atual
      await supabase.from('app_clientes').update({ fase_atual: targetFase }).eq('id', clienteId!);
      // Set all fases < target as concluida, target as em_andamento, > target as bloqueada
      const allFases = fases;
      for (const f of allFases) {
        const newStatus = f.numero < targetFase ? 'concluida' : f.numero === targetFase ? 'em_andamento' : 'bloqueada';
        if (f.status !== newStatus) {
          await supabase.from('app_fases').update({
            status: newStatus,
            data_conclusao: newStatus === 'concluida' && !f.data_conclusao ? new Date().toISOString() : f.data_conclusao,
            data_inicio: newStatus === 'em_andamento' && !f.data_inicio ? new Date().toISOString() : f.data_inicio,
          }).eq('id', f.id);
        }
      }
      // Audit
      await supabase.from('app_conversas').insert({
        cliente_id: clienteId!, fase_numero: targetFase, autor: user?.email || 'admin', tipo: 'sistema',
        mensagem: `Fase alterada manualmente para ${targetFase} (${FASE_NAMES[targetFase]}) por ${user?.email}`,
      });
    },
    onSuccess: () => { invalidateAll(); toast.success('Fase alterada!'); },
  });

  const revertFase = useMutation({
    mutationFn: async (targetFase: number) => {
      // Set fase_atual back
      const { error: clienteErr } = await supabase.from('app_clientes').update({
        fase_atual: targetFase,
      }).eq('id', clienteId!);
      if (clienteErr) throw clienteErr;

      // Reopen the target phase
      const { error: faseErr } = await supabase.from('app_fases').update({
        status: 'em_andamento',
        data_conclusao: null,
      }).eq('cliente_id', clienteId!).eq('numero', targetFase);
      if (faseErr) throw faseErr;

      // Block all phases after target
      const { error: blockErr } = await supabase.from('app_fases').update({
        status: 'bloqueada',
        data_inicio: null,
        data_conclusao: null,
        sla_vencimento: null,
        sla_violado: false,
      }).eq('cliente_id', clienteId!).gt('numero', targetFase);
      if (blockErr) throw blockErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-fases', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['app-cliente', clienteId] });
      toast.success('Fase revertida com sucesso!');
    },
    onError: (e: any) => toast.error('Erro ao reverter: ' + e.message),
  });

  const reopenFase = useMutation({
    mutationFn: async (faseNumero: number) => {
      // Reopen the phase
      const { error: faseErr } = await supabase.from('app_fases').update({
        status: 'em_andamento',
        data_conclusao: null,
      }).eq('cliente_id', clienteId!).eq('numero', faseNumero);
      if (faseErr) throw faseErr;

      // If fase < fase_atual, revert fase_atual
      if (cliente && faseNumero < (cliente.fase_atual || 0)) {
        const { error: clienteErr } = await supabase.from('app_clientes').update({
          fase_atual: faseNumero,
        }).eq('id', clienteId!);
        if (clienteErr) throw clienteErr;

        // Block phases after this one
        const { error: blockErr } = await supabase.from('app_fases').update({
          status: 'bloqueada',
          data_inicio: null,
          data_conclusao: null,
          sla_vencimento: null,
          sla_violado: false,
        }).eq('cliente_id', clienteId!).gt('numero', faseNumero);
        if (blockErr) throw blockErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-fases', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['app-cliente', clienteId] });
      toast.success('Fase reaberta!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('app_conversas').insert({
        cliente_id: clienteId!,
        fase_numero: selectedFase,
        autor: 'Analista',
        tipo: 'analista',
        mensagem: newMessage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['app-conversas', clienteId] });
    },
  });

  const saveFormAdmin = useMutation({
    mutationFn: async () => {
      const complete = !!(formData.nome_app && formData.descricao_curta && formData.url_privacidade);
      const { error } = await supabase.from('app_formulario').update({
        ...formData,
        preenchido_completo: complete,
        enviado_em: complete ? new Date().toISOString() : null,
      }).eq('cliente_id', clienteId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-formulario', clienteId] });
      toast.success('Formulário salvo!');
    },
  });

  const handleAssetUpload = async (file: File, tipo: string) => {
    setUploading(true);
    try {
      const path = `${clienteId}/${tipo}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('briefing-uploads').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('briefing-uploads').getPublicUrl(path);

      const { error: insertError } = await supabase.from('app_assets').insert({
        cliente_id: clienteId!,
        tipo,
        nome_arquivo: file.name,
        url: urlData.publicUrl,
        status: 'aguardando',
        enviado_por: 'admin',
      });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['app-assets', clienteId] });
      toast.success('Asset enviado!');
    } catch (err: any) {
      toast.error('Erro ao enviar: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  if (!cliente) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Carregando...</div>;

  const copyPortalLink = () => {
    const link = `${window.location.origin}/app/${cliente.portal_token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link do portal copiado!');
  };

  const inactiveDays = cliente.ultima_acao_cliente ? differenceInDays(new Date(), new Date(cliente.ultima_acao_cliente)) : null;

  const faseChecklist = selectedFase !== null ? checklist.filter(i => i.fase_numero === selectedFase) : [];
  const faseConversas = selectedFase !== null ? conversas.filter(c => c.fase_numero === selectedFase) : [];

  const getFaseIcon = (fase: any) => {
    if (fase.status === 'concluida') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (fase.status === 'em_andamento') return <Circle className="h-5 w-5 text-primary fill-primary/20" />;
    if (fase.status === 'atrasada') return <AlertTriangle className="h-5 w-5 text-destructive" />;
    return <Lock className="h-5 w-5 text-muted-foreground/40" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/hub/aplicativos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{cliente.nome}</h1>
            <span className="text-muted-foreground">—</span>
            <span className="text-muted-foreground">{cliente.empresa}</span>
            <Badge variant={cliente.status === 'atrasado' ? 'destructive' : cliente.status === 'concluido' ? 'default' : 'secondary'}>
              {cliente.status === 'no_prazo' ? 'No prazo' : cliente.status === 'atrasado' ? 'Atrasado' : cliente.status === 'bloqueado' ? 'Bloqueado' : 'Concluído'}
            </Badge>
            <Badge variant="outline">
              {cliente.plataforma === 'apple' ? '🍎 Apple' : cliente.plataforma === 'google' ? '🤖 Google' : '🍎+🤖 Ambos'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <Progress value={cliente.porcentagem_geral} className="flex-1 h-2 max-w-md" />
            <span className="text-sm font-medium">{cliente.porcentagem_geral}%</span>
          </div>
          {inactiveDays !== null && inactiveDays > 0 && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" /> Última ação do cliente: {inactiveDays}d atrás
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={copyPortalLink}>
            <Copy className="h-4 w-4 mr-1" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/app/${cliente.portal_token}`, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-1" /> Testar portal
          </Button>
        </div>
      </div>

      {/* Admin: Edit client data */}
      {canManage && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Gestão Interna
            </h3>
            <Button variant="outline" size="sm" onClick={() => setEditingClient(!editingClient)}>
              {editingClient ? 'Cancelar' : 'Editar dados'}
            </Button>
          </div>
          {editingClient && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <div><label className="text-xs text-muted-foreground">Nome</label><Input value={clientForm.nome} onChange={e => setClientForm(p => ({ ...p, nome: e.target.value }))} className="h-8 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Email</label><Input value={clientForm.email} onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Empresa</label><Input value={clientForm.empresa} onChange={e => setClientForm(p => ({ ...p, empresa: e.target.value }))} className="h-8 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Plataforma</label>
                <Select value={clientForm.plataforma} onValueChange={v => setClientForm(p => ({ ...p, plataforma: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">🤖 Google</SelectItem>
                    <SelectItem value="apple">🍎 Apple</SelectItem>
                    <SelectItem value="ambos">🍎+🤖 Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground">Responsável</label><Input value={clientForm.responsavel_nome} onChange={e => setClientForm(p => ({ ...p, responsavel_nome: e.target.value }))} className="h-8 text-sm" /></div>
              <div><label className="text-xs text-muted-foreground">Prazo estimado</label><Input type="date" value={clientForm.prazo_estimado} onChange={e => setClientForm(p => ({ ...p, prazo_estimado: e.target.value }))} className="h-8 text-sm" /></div>
              <div className="col-span-full"><Button size="sm" onClick={() => saveClientData.mutate()} disabled={saveClientData.isPending}>Salvar dados</Button></div>
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Mover para fase:</label>
            <Select value={manualFase} onValueChange={v => setManualFase(v)}>
              <SelectTrigger className="w-48 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASE_NAMES.map((name, i) => (
                  <SelectItem key={i} value={String(i)}>F{i} — {name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={changeManualFase.isPending || manualFase === String(cliente.fase_atual)}
              onClick={() => { if (confirm(`Mover para fase ${manualFase}?`)) changeManualFase.mutate(Number(manualFase)); }}>
              Aplicar
            </Button>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        {fases.map((fase) => {
          const items = checklist.filter(i => i.fase_numero === fase.numero);
          const done = items.filter(i => i.feito && i.obrigatorio).length;
          const total = items.filter(i => i.obrigatorio).length;
          const slaInfo = fase.sla_violado ? '🚨 SLA vencido' : fase.sla_vencimento ? `⏰ ${Math.max(0, differenceInHours(new Date(fase.sla_vencimento), new Date()))}h` : null;

          return (
            <Card
              key={fase.id}
              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${fase.numero === cliente.fase_atual ? 'ring-2 ring-primary/50' : ''}`}
              onClick={() => { setSelectedFase(fase.numero); setSheetOpen(true); }}
            >
              <div className="flex items-center gap-3">
                {getFaseIcon(fase)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">F{fase.numero}</span>
                    <span className="text-sm font-medium">{fase.nome}</span>
                    {slaInfo && <Badge variant={fase.sla_violado ? 'destructive' : 'secondary'} className="text-[10px]">{slaInfo}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={fase.porcentagem} className="flex-1 h-1.5 max-w-xs" />
                    <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sheet lateral */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>
                {selectedFase !== null ? `F${selectedFase} — ${FASE_NAMES[selectedFase] || ''}` : 'Detalhes'}
              </SheetTitle>
              {canEdit && selectedFase !== null && (() => {
                const fase = fases.find(f => f.numero === selectedFase);
                if (!fase) return null;
                const isConcluded = fase.status === 'concluida';
                const isAfterCurrent = selectedFase > (cliente?.fase_atual || 0);
                if (isConcluded || isAfterCurrent) {
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={revertFase.isPending || reopenFase.isPending}
                      onClick={() => {
                        if (confirm(`Tem certeza que deseja reabrir a fase "${FASE_NAMES[selectedFase]}"? Fases posteriores serão bloqueadas.`)) {
                          if (isConcluded) {
                            reopenFase.mutate(selectedFase);
                          } else {
                            revertFase.mutate(selectedFase);
                          }
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {isConcluded ? 'Reabrir fase' : 'Voltar para esta fase'}
                    </Button>
                  );
                }
                return null;
              })()}
            </div>
          </SheetHeader>
          <Tabs defaultValue="checklist" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
              <TabsTrigger value="conversas" className="flex-1">Conversas</TabsTrigger>
              {selectedFase === 3 && <TabsTrigger value="formulario" className="flex-1">Formulário</TabsTrigger>}
              {selectedFase === 0 && <TabsTrigger value="assets" className="flex-1">Assets</TabsTrigger>}
            </TabsList>
            <TabsContent value="checklist">
              <ScrollArea className="h-[calc(100vh-220px)]">
                <div className="space-y-3 pr-2">
                  {['analista', 'designer', 'cliente', 'loja'].map(ator => {
                    const items = faseChecklist.filter(i => i.ator === ator);
                    if (items.length === 0) return null;
                    return (
                      <div key={ator}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          {ator === 'analista' ? '👨‍💻 Analista' : ator === 'designer' ? '🎨 Designer' : ator === 'cliente' ? '👤 Cliente' : '🏪 Loja'}
                        </p>
                        {items.map(item => {
                          const isValidationItem = item.texto === 'Documentação verificada pelo analista' && selectedFase === 1;

                          // Get admin dates for the validation item
                          const googleAdminItem = isValidationItem ? checklist.find(i => i.fase_numero === 1 && i.texto === 'Adicionei apps@membros.app.br como admin (Google)') : null;
                          const appleAdminItem = isValidationItem ? checklist.find(i => i.fase_numero === 1 && i.texto === 'Adicionei apps@membros.app.br como admin (Apple)') : null;
                          const googleAccountItem = isValidationItem ? checklist.find(i => i.fase_numero === 1 && i.texto === 'Criei a conta no Google Play Console') : null;
                          const appleAccountItem = isValidationItem ? checklist.find(i => i.fase_numero === 1 && i.texto === 'Criei a conta no Apple Developer Program') : null;

                          const showGoogle = cliente.plataforma === 'google' || cliente.plataforma === 'ambos';
                          const showApple = cliente.plataforma === 'apple' || cliente.plataforma === 'ambos';
                          const adminsPending = isValidationItem && (
                            (showGoogle && !googleAdminItem?.feito) || (showApple && !appleAdminItem?.feito)
                          );

                          return (
                            <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                              {item.tipo === 'upload' ? (
                                <Upload className="h-4 w-4 mt-0.5 text-muted-foreground" />
                              ) : isValidationItem ? (
                                <Checkbox
                                  checked={item.feito}
                                  disabled={adminsPending}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setValidationItemId(item.id);
                                      setValidationDialogOpen(true);
                                    } else {
                                      toggleItem.mutate({ id: item.id, feito: false });
                                    }
                                  }}
                                />
                              ) : (
                                <Checkbox
                                  checked={item.feito}
                                  disabled={item.ator === 'cliente' && !canEdit && !isGerenteImpl}
                                  onCheckedChange={(checked) => toggleItem.mutate({ id: item.id, feito: !!checked })}
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${item.feito ? 'line-through text-muted-foreground' : ''}`}>{item.texto}</p>
                                {item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}
                                {item.feito_em && (
                                  <p className={`text-[10px] mt-0.5 ${(selectedFase === 2 || selectedFase === 4) ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                                    {(selectedFase === 2 || selectedFase === 4) ? `✅ Aprovado em ${format(new Date(item.feito_em), 'dd/MM/yyyy HH:mm')}` : `✓ ${format(new Date(item.feito_em), 'dd/MM/yyyy HH:mm')}`}
                                  </p>
                                )}

                                {/* Show admin dates and status for validation item */}
                                {isValidationItem && !item.feito && (
                                  <div className="mt-2 space-y-1.5">
                                    {showGoogle && (
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-muted-foreground">🤖 Google:</span>
                                        {googleAccountItem?.feito ? (
                                          <span className="text-green-600">Conta criada em {googleAccountItem.feito_em ? format(new Date(googleAccountItem.feito_em), 'dd/MM/yy HH:mm') : '—'}</span>
                                        ) : <span className="text-amber-500">Conta pendente</span>}
                                        {googleAdminItem?.feito ? (
                                          <span className="text-green-600 ml-1">· Admin adicionado {googleAdminItem.feito_em ? format(new Date(googleAdminItem.feito_em), 'dd/MM/yy HH:mm') : ''}</span>
                                        ) : <span className="text-amber-500 ml-1">· Admin pendente</span>}
                                      </div>
                                    )}
                                    {showApple && (
                                      <div className="flex items-center gap-2 text-xs">
                                        <span className="text-muted-foreground">🍎 Apple:</span>
                                        {appleAccountItem?.feito ? (
                                          <span className="text-green-600">Conta criada em {appleAccountItem.feito_em ? format(new Date(appleAccountItem.feito_em), 'dd/MM/yy HH:mm') : '—'}</span>
                                        ) : <span className="text-amber-500">Conta pendente</span>}
                                        {appleAdminItem?.feito ? (
                                          <span className="text-green-600 ml-1">· Admin adicionado {appleAdminItem.feito_em ? format(new Date(appleAdminItem.feito_em), 'dd/MM/yy HH:mm') : ''}</span>
                                        ) : <span className="text-amber-500 ml-1">· Admin pendente</span>}
                                      </div>
                                    )}
                                    {adminsPending && (
                                      <p className="text-[10px] text-amber-500 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Aguardando cliente adicionar admin para validar
                                      </p>
                                    )}
                                    {!adminsPending && !item.feito && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="mt-1 text-xs h-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setValidationItemId(item.id);
                                          setValidationDialogOpen(true);
                                        }}
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Validar convites
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="conversas">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-3 pr-2">
                  {faseConversas.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa nesta fase</p>}
                  {faseConversas.map(c => (
                    <div key={c.id} className={`p-3 rounded-lg text-sm ${c.tipo === 'sistema' ? 'bg-muted/50 text-muted-foreground' : c.tipo === 'cliente' ? 'bg-primary/10' : 'bg-card border'}`}>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-xs">{c.autor}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), 'dd/MM HH:mm')}</span>
                      </div>
                      <p>{c.mensagem}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Escrever mensagem..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newMessage.trim() && sendMessage.mutate()}
                />
                <Button size="sm" disabled={!newMessage.trim()} onClick={() => sendMessage.mutate()}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Formulário tab (phase 4) */}
            {selectedFase === 3 && (
              <TabsContent value="formulario">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <div className="space-y-4 pr-2 py-2">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Nome do aplicativo *</label>
                      <Input value={formData.nome_app} onChange={e => setFormData(p => ({ ...p, nome_app: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Descrição curta * ({formData.descricao_curta.length}/80)</label>
                      <Input value={formData.descricao_curta} maxLength={80} onChange={e => setFormData(p => ({ ...p, descricao_curta: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Descrição completa ({formData.descricao_longa.length}/4000)</label>
                      <Textarea className="min-h-[120px]" value={formData.descricao_longa} maxLength={4000} onChange={e => setFormData(p => ({ ...p, descricao_longa: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">URL Política de Privacidade *</label>
                      <Input value={formData.url_privacidade} onChange={e => setFormData(p => ({ ...p, url_privacidade: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">URL Termos de Uso</label>
                      <Input value={formData.url_termos} onChange={e => setFormData(p => ({ ...p, url_termos: e.target.value }))} />
                    </div>
                    <Button className="w-full" onClick={() => saveFormAdmin.mutate()} disabled={saveFormAdmin.isPending || !formData.nome_app || !formData.descricao_curta || !formData.url_privacidade}>
                      {saveFormAdmin.isPending ? 'Salvando...' : 'Salvar formulário'}
                    </Button>
                    {formulario?.preenchido_completo && (
                      <p className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Formulário completo — enviado em {formulario.enviado_em ? format(new Date(formulario.enviado_em), 'dd/MM/yyyy HH:mm') : ''}</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {/* Assets tab (phase 3) */}
            {selectedFase === 0 && (
              <TabsContent value="assets">
                <ScrollArea className="h-[calc(100vh-220px)]">
                  <div className="space-y-4 pr-2 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Assets do projeto</p>
                      <div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleAssetUpload(file, 'asset');
                          e.target.value = '';
                        }} />
                        <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-1" /> {uploading ? 'Enviando...' : 'Upload'}
                        </Button>
                      </div>
                    </div>
                    {appAssets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Nenhum asset enviado ainda</p>
                    ) : (
                      appAssets.map((asset: any) => (
                        <div key={asset.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50">
                          {asset.url ? (
                            <img src={asset.url} alt={asset.nome_arquivo} className="w-14 h-14 object-cover rounded-lg border border-border" />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{asset.nome_arquivo || asset.tipo}</p>
                            <p className="text-xs text-muted-foreground">{asset.tipo}</p>
                          </div>
                          <Badge variant={asset.status === 'aprovado' ? 'default' : asset.status === 'ajuste_solicitado' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {asset.status === 'aprovado' ? '✅ Aprovado' : asset.status === 'ajuste_solicitado' ? 'Ajuste' : '⏳ Aguardando'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Validation Confirmation Dialog */}
      <Dialog open={validationDialogOpen} onOpenChange={setValidationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Validação de Convite Admin
            </DialogTitle>
            <DialogDescription>
              Confirme se recebeu os convites de administrador enviados pelo cliente <strong>{cliente.nome}</strong> ({cliente.empresa}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(() => {
              const showGoogle = cliente.plataforma === 'google' || cliente.plataforma === 'ambos';
              const showApple = cliente.plataforma === 'apple' || cliente.plataforma === 'ambos';
              const googleAccountItem = checklist.find(i => i.fase_numero === 1 && i.texto === 'Criei a conta no Google Play Console');
              const appleAccountItem = checklist.find(i => i.fase_numero === 1 && i.texto === 'Criei a conta no Apple Developer Program');
              const googleAdminItem = checklist.find(i => i.fase_numero === 1 && i.texto === 'Adicionei apps@membros.app.br como admin (Google)');
              const appleAdminItem = checklist.find(i => i.fase_numero === 1 && i.texto === 'Adicionei apps@membros.app.br como admin (Apple)');

              return (
                <>
                  {showGoogle && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2">🤖 Google Play Console</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {googleAccountItem?.feito_em && (
                          <p>📅 Conta criada em: <strong className="text-foreground">{format(new Date(googleAccountItem.feito_em), 'dd/MM/yyyy HH:mm')}</strong></p>
                        )}
                        {googleAdminItem?.feito_em && (
                          <p>📅 Admin adicionado em: <strong className="text-foreground">{format(new Date(googleAdminItem.feito_em), 'dd/MM/yyyy HH:mm')}</strong></p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-2">Você confirma que recebeu o convite para ser admin do aplicativo Google?</p>
                    </div>
                  )}
                  {showApple && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-2">🍎 Apple Developer</p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        {appleAccountItem?.feito_em && (
                          <p>📅 Conta criada em: <strong className="text-foreground">{format(new Date(appleAccountItem.feito_em), 'dd/MM/yyyy HH:mm')}</strong></p>
                        )}
                        {appleAdminItem?.feito_em && (
                          <p>📅 Admin adicionado em: <strong className="text-foreground">{format(new Date(appleAdminItem.feito_em), 'dd/MM/yyyy HH:mm')}</strong></p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-2">Você confirma que recebeu o convite para ser admin do aplicativo Apple?</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={() => {
              if (validationItemId) {
                toggleItem.mutate({ id: validationItemId, feito: true });
                setValidationDialogOpen(false);
                setValidationItemId(null);
                toast.success('Documentação validada com sucesso!');
              }
            }}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
