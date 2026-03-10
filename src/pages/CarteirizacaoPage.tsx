import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Palmtree, Users, Layers, Tag, ChevronDown, ChevronRight, BookOpen, Map, ArrowRightLeft, Check, Clock } from 'lucide-react';
import { format } from 'date-fns';
import JornadaClienteVisual from '@/components/carteirizacao/JornadaClienteVisual';
import ClientesTab from '@/components/carteirizacao/ClientesTab';

type UserProfile = { user_id: string; email: string | null; display_name: string | null };

type Plano = { id: string; nome: string; created_at: string };
type Etapa = { id: string; nome: string; created_at: string };
type CsConfig = { id: string; etapa_id: string; plano_id: string | null; user_email: string; user_name: string | null; peso: number; ativo: boolean; created_at: string };
type Ferias = { id: string; cs_email: string; substituto_email: string; substituto_nome: string | null; data_inicio: string; data_fim: string; motivo: string | null; created_at: string; movido_ida: boolean; movido_volta: boolean; movido_ida_em: string | null; movido_volta_em: string | null; clientes_movidos: number | null };

export default function CarteirizacaoPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [csConfigs, setCsConfigs] = useState<CsConfig[]>([]);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [csNameQuery, setCsNameQuery] = useState('');
  const [showCsSuggestions, setShowCsSuggestions] = useState(false);
  const csNameRef = useRef<HTMLDivElement>(null);
  const [expandedPlanos, setExpandedPlanos] = useState<Set<string>>(new Set());

  // Dialog states
  const [planoDialog, setPlanoDialog] = useState(false);
  const [planoNome, setPlanoNome] = useState('');
  const [etapaDialog, setEtapaDialog] = useState(false);
  const [etapaNome, setEtapaNome] = useState('');
  const [csDialog, setCsDialog] = useState(false);
  const [csForm, setCsForm] = useState({ plano_id: '', etapa_id: '', user_email: '', user_name: '', peso: 1 });
  const [editingCs, setEditingCs] = useState<string | null>(null);
  const [feriasDialog, setFeriasDialog] = useState(false);
  const [feriasForm, setFeriasForm] = useState({ cs_email: '', substituto_email: '', substituto_nome: '', data_inicio: '', data_fim: '' });

  const fetchAll = async () => {
    setLoading(true);
    const [p, e, c, f] = await Promise.all([
      supabase.from('carteirizacao_planos').select('*').order('nome'),
      supabase.from('carteirizacao_etapas').select('*').order('nome'),
      supabase.from('carteirizacao_cs').select('*').order('created_at'),
      supabase.from('carteirizacao_ferias').select('*').order('data_inicio', { ascending: false }),
    ]);
    setPlanos((p.data as Plano[]) || []);
    setEtapas((e.data as Etapa[]) || []);
    setCsConfigs((c.data as CsConfig[]) || []);
    setFerias((f.data as Ferias[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Fetch user profiles for autocomplete via edge function
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users-api`, {
          headers: {
            'Authorization': 'Basic WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq',
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const json = await res.json();
          setUserProfiles((json.users || []).map((u: any) => ({
            user_id: u.id,
            email: u.email,
            display_name: u.display_name,
          })));
        }
      } catch (e) {
        console.error('Failed to fetch users for autocomplete', e);
      }
    };
    fetchProfiles();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (csNameRef.current && !csNameRef.current.contains(e.target as Node)) {
        setShowCsSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Expand all plans by default once loaded
  useEffect(() => {
    if (planos.length > 0 && expandedPlanos.size === 0) {
      setExpandedPlanos(new Set(planos.map(p => p.id)));
    }
  }, [planos]);

  const filteredUsers = userProfiles.filter(u => {
    const q = csNameQuery.toLowerCase();
    if (!q) return true;
    return (u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  });

  const selectUser = (user: UserProfile) => {
    setCsForm(f => ({ ...f, user_name: user.display_name || '', user_email: user.email || '' }));
    setCsNameQuery(user.display_name || user.email || '');
    setShowCsSuggestions(false);
  };

  const togglePlanoExpanded = (id: string) => {
    setExpandedPlanos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // --- Planos ---
  const addPlano = async () => {
    if (!planoNome.trim()) return;
    const { error } = await supabase.from('carteirizacao_planos').insert({ nome: planoNome.trim() } as any);
    if (error) { toast.error('Erro ao criar plano'); return; }
    toast.success('Plano criado');
    setPlanoNome('');
    setPlanoDialog(false);
    fetchAll();
  };

  const deletePlano = async (id: string) => {
    await supabase.from('carteirizacao_planos').delete().eq('id', id);
    toast.success('Plano removido');
    fetchAll();
  };

  // --- Etapas ---
  const addEtapa = async () => {
    if (!etapaNome.trim()) return;
    const { error } = await supabase.from('carteirizacao_etapas').insert({ nome: etapaNome.trim() } as any);
    if (error) { toast.error('Erro ao criar etapa'); return; }
    toast.success('Etapa criada');
    setEtapaNome('');
    setEtapaDialog(false);
    fetchAll();
  };

  const deleteEtapa = async (id: string) => {
    await supabase.from('carteirizacao_etapas').delete().eq('id', id);
    toast.success('Etapa removida');
    fetchAll();
  };

  // --- CS Config ---
  const openCsDialog = (cs?: CsConfig, presetPlanoId?: string, presetEtapaId?: string) => {
    if (cs) {
      setEditingCs(cs.id);
      setCsForm({ plano_id: cs.plano_id || '', etapa_id: cs.etapa_id, user_email: cs.user_email, user_name: cs.user_name || '', peso: cs.peso });
      setCsNameQuery(cs.user_name || cs.user_email);
    } else {
      setEditingCs(null);
      setCsForm({ plano_id: presetPlanoId || planos[0]?.id || '', etapa_id: presetEtapaId || etapas[0]?.id || '', user_email: '', user_name: '', peso: 1 });
      setCsNameQuery('');
    }
    setCsDialog(true);
  };

  const saveCs = async () => {
    if (!csForm.plano_id || !csForm.etapa_id || !csForm.user_email.trim()) { toast.error('Preencha plano, etapa e e-mail'); return; }
    const payload = { plano_id: csForm.plano_id, etapa_id: csForm.etapa_id, user_email: csForm.user_email.trim(), user_name: csForm.user_name.trim() || null, peso: csForm.peso } as any;
    if (editingCs) {
      const { error } = await supabase.from('carteirizacao_cs').update(payload).eq('id', editingCs);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('CS atualizado');
    } else {
      const { error } = await supabase.from('carteirizacao_cs').insert(payload);
      if (error) { toast.error(error.message.includes('duplicate') ? 'CS já atribuído nessa combinação plano/etapa' : 'Erro ao criar'); return; }
      toast.success('CS adicionado');
    }
    setCsDialog(false);
    fetchAll();
  };

  const deleteCs = async (id: string) => {
    await supabase.from('carteirizacao_cs').delete().eq('id', id);
    toast.success('CS removido');
    fetchAll();
  };

  const toggleCsAtivo = async (cs: CsConfig) => {
    await supabase.from('carteirizacao_cs').update({ ativo: !cs.ativo } as any).eq('id', cs.id);
    fetchAll();
  };

  // --- Férias ---
  const saveFerias = async () => {
    if (!feriasForm.cs_email || !feriasForm.substituto_email || !feriasForm.data_inicio || !feriasForm.data_fim) {
      toast.error('Preencha todos os campos');
      return;
    }
    const { error } = await supabase.from('carteirizacao_ferias').insert({
      cs_email: feriasForm.cs_email,
      substituto_email: feriasForm.substituto_email,
      substituto_nome: feriasForm.substituto_nome || null,
      data_inicio: feriasForm.data_inicio,
      data_fim: feriasForm.data_fim,
    } as any);
    if (error) { toast.error('Erro ao registrar férias'); return; }
    toast.success('Férias registradas');
    setFeriasDialog(false);
    setFeriasForm({ cs_email: '', substituto_email: '', substituto_nome: '', data_inicio: '', data_fim: '' });
    fetchAll();
  };

  const deleteFerias = async (id: string) => {
    await supabase.from('carteirizacao_ferias').delete().eq('id', id);
    toast.success('Registro de férias removido');
    fetchAll();
  };

  const getEtapaNome = (id: string) => etapas.find(e => e.id === id)?.nome || '—';
  const getPlanoNome = (id: string | null) => planos.find(p => p.id === id)?.nome || '—';

  const allCsEmails = [...new Set(csConfigs.map(c => c.user_email))];

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Carteirização</h1>
        <p className="text-muted-foreground">Configure planos, etapas, distribua CSs e gerencie férias.</p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> Planos & Etapas</TabsTrigger>
          <TabsTrigger value="cs" className="gap-1.5"><Users className="h-3.5 w-3.5" /> CSs por Carteira</TabsTrigger>
          <TabsTrigger value="jornada" className="gap-1.5"><Map className="h-3.5 w-3.5" /> Jornada</TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Clientes</TabsTrigger>
          <TabsTrigger value="ferias" className="gap-1.5">Férias</TabsTrigger>
        </TabsList>

        {/* ===== PLANOS & ETAPAS ===== */}
        <TabsContent value="config" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Planos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Planos</CardTitle>
                <Button size="sm" onClick={() => setPlanoDialog(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </CardHeader>
              <CardContent>
                {planos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum plano cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {planos.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/30">
                        <span className="text-sm font-medium">{p.nome}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePlano(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Etapas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Etapas de Carteira</CardTitle>
                <Button size="sm" onClick={() => setEtapaDialog(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </CardHeader>
              <CardContent>
                {etapas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma etapa cadastrada.</p>
                ) : (
                  <div className="space-y-2">
                    {etapas.map(e => (
                      <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{e.nome}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEtapa(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== CSs POR CARTEIRA ===== */}
        <TabsContent value="cs" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Para cada plano, defina os CSs responsáveis em cada etapa. O peso define a proporção de faturamento.</p>
            <Button size="sm" onClick={() => openCsDialog()} disabled={planos.length === 0 || etapas.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar CS
            </Button>
          </div>

          {planos.length === 0 || etapas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre planos e etapas primeiro na aba "Planos & Etapas".</CardContent></Card>
          ) : (
            planos.map(plano => {
              const csForPlano = csConfigs.filter(c => c.plano_id === plano.id);
              const isExpanded = expandedPlanos.has(plano.id);
              return (
                <Card key={plano.id}>
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => togglePlanoExpanded(plano.id)}>
                    <CardTitle className="text-base flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Tag className="h-4 w-4 text-primary" />
                      {plano.nome}
                      <Badge variant="secondary" className="ml-2">{csForPlano.length} CS(s)</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); openCsDialog(undefined, plano.id); }}
                      >
                        <Plus className="h-3 w-3 mr-1" /> CS
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-4">
                      {etapas.map(etapa => {
                        const csForEtapa = csForPlano.filter(c => c.etapa_id === etapa.id);
                        if (csForEtapa.length === 0) {
                          return (
                            <div key={etapa.id} className="border border-border/50 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium text-muted-foreground">{etapa.nome}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => openCsDialog(undefined, plano.id, etapa.id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Adicionar CS
                                </Button>
                              </div>
                            </div>
                          );
                        }
                        const totalPeso = csForEtapa.filter(c => c.ativo).reduce((s, c) => s + c.peso, 0);
                        return (
                          <div key={etapa.id} className="border border-border/50 rounded-lg">
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-t-lg">
                              <div className="flex items-center gap-2">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                <span className="text-sm font-medium">{etapa.nome}</span>
                                <Badge variant="outline" className="text-[10px]">{csForEtapa.length}</Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => openCsDialog(undefined, plano.id, etapa.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> CS
                              </Button>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>CS</TableHead>
                                  <TableHead>E-mail</TableHead>
                                  <TableHead>Peso</TableHead>
                                  <TableHead>% Faturamento</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="w-20">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {csForEtapa.map(cs => (
                                  <TableRow key={cs.id} className={!cs.ativo ? 'opacity-50' : ''}>
                                    <TableCell className="font-medium">{cs.user_name || '—'}</TableCell>
                                    <TableCell>{cs.user_email}</TableCell>
                                    <TableCell>{cs.peso}</TableCell>
                                    <TableCell>
                                      {totalPeso > 0 && cs.ativo ? `${Math.round((cs.peso / totalPeso) * 100)}%` : '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={cs.ativo ? 'default' : 'secondary'}
                                        className="cursor-pointer"
                                        onClick={() => toggleCsAtivo(cs)}
                                      >
                                        {cs.ativo ? 'Ativo' : 'Inativo'}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCsDialog(cs)}>
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCs(cs.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ===== JORNADA VISUAL ===== */}
        <TabsContent value="jornada" className="space-y-4">
          <JornadaClienteVisual planos={planos} etapas={etapas} csConfigs={csConfigs} />
        </TabsContent>

        {/* ===== CLIENTES ===== */}
        <TabsContent value="clientes" className="space-y-4">
          <ClientesTab />
        </TabsContent>

        {/* ===== FÉRIAS ===== */}
        <TabsContent value="ferias" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Quando um CS sai de férias, seus clientes são redirecionados para o substituto definido.</p>
            <Button size="sm" onClick={() => setFeriasDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Registrar Férias
            </Button>
          </div>

          <Card>
            <CardContent className="pt-4">
              {ferias.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro de férias.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CS</TableHead>
                      <TableHead>Substituto</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ferias.map(f => {
                      const now = new Date();
                      const start = new Date(f.data_inicio);
                      const end = new Date(f.data_fim);
                      const status = now < start ? 'Agendado' : now > end ? 'Encerrado' : 'Em férias';
                      return (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.cs_email}</TableCell>
                          <TableCell>{f.substituto_nome || f.substituto_email}</TableCell>
                          <TableCell>{format(start, 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{format(end, 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={status === 'Em férias' ? 'default' : status === 'Agendado' ? 'secondary' : 'outline'}>
                              {status === 'Em férias' && <Palmtree className="h-3 w-3 mr-1" />}
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteFerias(f.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === DIALOGS === */}

      {/* Plano Dialog */}
      <Dialog open={planoDialog} onOpenChange={setPlanoDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome do plano</Label>
            <Input value={planoNome} onChange={e => setPlanoNome(e.target.value)} placeholder="Ex: Enterprise" />
          </div>
          <DialogFooter>
            <Button onClick={addPlano}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etapa Dialog */}
      <Dialog open={etapaDialog} onOpenChange={setEtapaDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova Etapa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome da etapa</Label>
            <Input value={etapaNome} onChange={e => setEtapaNome(e.target.value)} placeholder="Ex: Onboarding" />
          </div>
          <DialogFooter>
            <Button onClick={addEtapa}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CS Dialog */}
      <Dialog open={csDialog} onOpenChange={setCsDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCs ? 'Editar CS' : 'Adicionar CS à Carteira'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plano</Label>
                <Select value={csForm.plano_id} onValueChange={v => setCsForm(f => ({ ...f, plano_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {planos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Etapa</Label>
                <Select value={csForm.etapa_id} onValueChange={v => setCsForm(f => ({ ...f, etapa_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {etapas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 relative" ref={csNameRef}>
                <Label>Nome do CS</Label>
                <Input
                  value={csNameQuery}
                  onChange={e => {
                    setCsNameQuery(e.target.value);
                    setCsForm(f => ({ ...f, user_name: e.target.value }));
                    setShowCsSuggestions(true);
                  }}
                  onFocus={() => setShowCsSuggestions(true)}
                  placeholder="Buscar por nome..."
                  autoComplete="off"
                />
                {showCsSuggestions && filteredUsers.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                    {filteredUsers.slice(0, 10).map(u => (
                      <button
                        key={u.user_id}
                        type="button"
                        className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent text-sm"
                        onClick={() => selectUser(u)}
                      >
                        <span className="font-medium">{u.display_name || u.email}</span>
                        {u.display_name && <span className="text-xs text-muted-foreground">{u.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={csForm.user_email} onChange={e => setCsForm(f => ({ ...f, user_email: e.target.value }))} placeholder="cs@empresa.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Peso (proporção de faturamento)</Label>
              <Input type="number" min={1} value={csForm.peso} onChange={e => setCsForm(f => ({ ...f, peso: parseInt(e.target.value) || 1 }))} />
              <p className="text-xs text-muted-foreground">Um CS com peso 2 recebe o dobro de faturamento que um com peso 1.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveCs}>{editingCs ? 'Atualizar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Férias Dialog */}
      <Dialog open={feriasDialog} onOpenChange={setFeriasDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Férias</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>CS que sairá de férias</Label>
              {allCsEmails.length > 0 ? (
                <Select value={feriasForm.cs_email} onValueChange={v => setFeriasForm(f => ({ ...f, cs_email: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {allCsEmails.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={feriasForm.cs_email} onChange={e => setFeriasForm(f => ({ ...f, cs_email: e.target.value }))} placeholder="cs@empresa.com" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Substituto (nome)</Label>
                <Input value={feriasForm.substituto_nome} onChange={e => setFeriasForm(f => ({ ...f, substituto_nome: e.target.value }))} placeholder="Nome" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail do substituto</Label>
                <Input value={feriasForm.substituto_email} onChange={e => setFeriasForm(f => ({ ...f, substituto_email: e.target.value }))} placeholder="sub@empresa.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data início</Label>
                <Input type="date" value={feriasForm.data_inicio} onChange={e => setFeriasForm(f => ({ ...f, data_inicio: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Data fim</Label>
                <Input type="date" value={feriasForm.data_fim} onChange={e => setFeriasForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveFerias}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
