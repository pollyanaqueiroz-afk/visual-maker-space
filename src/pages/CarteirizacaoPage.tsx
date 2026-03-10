import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Edit2, Palmtree, Users, Layers, Tag, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

type Plano = { id: string; nome: string; created_at: string };
type Etapa = { id: string; nome: string; created_at: string };
type CsConfig = { id: string; etapa_id: string; user_email: string; user_name: string | null; peso: number; planos: string[]; ativo: boolean; created_at: string };
type Ferias = { id: string; cs_email: string; substituto_email: string; substituto_nome: string | null; data_inicio: string; data_fim: string; motivo: string | null; created_at: string };

export default function CarteirizacaoPage() {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [csConfigs, setCsConfigs] = useState<CsConfig[]>([]);
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [planoDialog, setPlanoDialog] = useState(false);
  const [planoNome, setPlanoNome] = useState('');
  const [etapaDialog, setEtapaDialog] = useState(false);
  const [etapaNome, setEtapaNome] = useState('');
  const [csDialog, setCsDialog] = useState(false);
  const [csForm, setCsForm] = useState({ etapa_id: '', user_email: '', user_name: '', peso: 1, planos: [] as string[] });
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
  const openCsDialog = (cs?: CsConfig) => {
    if (cs) {
      setEditingCs(cs.id);
      setCsForm({ etapa_id: cs.etapa_id, user_email: cs.user_email, user_name: cs.user_name || '', peso: cs.peso, planos: cs.planos || [] });
    } else {
      setEditingCs(null);
      setCsForm({ etapa_id: etapas[0]?.id || '', user_email: '', user_name: '', peso: 1, planos: [] });
    }
    setCsDialog(true);
  };

  const saveCs = async () => {
    if (!csForm.etapa_id || !csForm.user_email.trim()) { toast.error('Preencha etapa e e-mail'); return; }
    const payload = { etapa_id: csForm.etapa_id, user_email: csForm.user_email.trim(), user_name: csForm.user_name.trim() || null, peso: csForm.peso, planos: csForm.planos } as any;
    if (editingCs) {
      const { error } = await supabase.from('carteirizacao_cs').update(payload).eq('id', editingCs);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('CS atualizado');
    } else {
      const { error } = await supabase.from('carteirizacao_cs').insert(payload);
      if (error) { toast.error(error.message.includes('duplicate') ? 'CS já atribuído nessa etapa' : 'Erro ao criar'); return; }
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

  const togglePlanoInCs = (plano: string) => {
    setCsForm(prev => ({
      ...prev,
      planos: prev.planos.includes(plano) ? prev.planos.filter(p => p !== plano) : [...prev.planos, plano],
    }));
  };

  const getEtapaNome = (id: string) => etapas.find(e => e.id === id)?.nome || '—';

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
          <TabsTrigger value="ferias" className="gap-1.5"><Palmtree className="h-3.5 w-3.5" /> Férias</TabsTrigger>
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
            <p className="text-sm text-muted-foreground">Distribua os CSs por etapa de carteira. O peso define a proporção de faturamento que cada CS recebe.</p>
            <Button size="sm" onClick={() => openCsDialog()} disabled={etapas.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar CS
            </Button>
          </div>

          {etapas.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Cadastre etapas primeiro na aba "Planos & Etapas".</CardContent></Card>
          ) : (
            etapas.map(etapa => {
              const csForEtapa = csConfigs.filter(c => c.etapa_id === etapa.id);
              const totalPeso = csForEtapa.filter(c => c.ativo).reduce((s, c) => s + c.peso, 0);
              return (
                <Card key={etapa.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      {etapa.nome}
                      <Badge variant="secondary" className="ml-2">{csForEtapa.length} CS(s)</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {csForEtapa.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">Nenhum CS atribuído.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>CS</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Peso</TableHead>
                            <TableHead>% Faturamento</TableHead>
                            <TableHead>Planos</TableHead>
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
                                <div className="flex flex-wrap gap-1">
                                  {cs.planos.length > 0 ? cs.planos.map(p => (
                                    <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                                  )) : <span className="text-xs text-muted-foreground">Todos</span>}
                                </div>
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
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
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
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={csForm.etapa_id} onValueChange={v => setCsForm(f => ({ ...f, etapa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {etapas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do CS</Label>
                <Input value={csForm.user_name} onChange={e => setCsForm(f => ({ ...f, user_name: e.target.value }))} placeholder="Nome" />
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
            <div className="space-y-1.5">
              <Label>Planos atendidos</Label>
              {planos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum plano cadastrado. O CS atenderá todos os clientes.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {planos.map(p => (
                    <Badge
                      key={p.id}
                      variant={csForm.planos.includes(p.nome) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => togglePlanoInCs(p.nome)}
                    >
                      {p.nome}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Se nenhum plano for selecionado, o CS atende todos.</p>
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
