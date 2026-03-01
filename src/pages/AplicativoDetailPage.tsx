import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Copy, ExternalLink, Apple, Bot, Clock, CheckCircle2, Circle, Lock, AlertTriangle, Upload, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { differenceInHours, differenceInDays, format } from 'date-fns';

const FASE_NAMES = ['Pré-Requisitos','Primeiros Passos','Validação pela Loja','Assets e Mockup','Formulário do App','Criação e Submissão','Aprovação das Lojas','Teste do App','Publicado 🎉'];

export default function AplicativoDetailPage() {
  const { clienteId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFase, setSelectedFase] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');

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

  const toggleItem = useMutation({
    mutationFn: async ({ id, feito }: { id: string; feito: boolean }) => {
      const { error } = await supabase.from('app_checklist_items').update({
        feito,
        feito_em: feito ? new Date().toISOString() : null,
        feito_por: 'admin',
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-checklist', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['app-fases', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['app-cliente', clienteId] });
    },
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
            <SheetTitle>
              {selectedFase !== null ? `F${selectedFase} — ${FASE_NAMES[selectedFase] || ''}` : 'Detalhes'}
            </SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="checklist" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="checklist" className="flex-1">Checklist</TabsTrigger>
              <TabsTrigger value="conversas" className="flex-1">Conversas</TabsTrigger>
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
                        {items.map(item => (
                          <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                            {item.tipo === 'upload' ? (
                              <Upload className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            ) : (
                              <Checkbox
                                checked={item.feito}
                                disabled={item.ator === 'cliente'}
                                onCheckedChange={(checked) => toggleItem.mutate({ id: item.id, feito: !!checked })}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${item.feito ? 'line-through text-muted-foreground' : ''}`}>{item.texto}</p>
                              {item.descricao && <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>}
                              {item.feito_em && <p className="text-[10px] text-muted-foreground mt-0.5">✓ {format(new Date(item.feito_em), 'dd/MM/yyyy HH:mm')}</p>}
                            </div>
                          </div>
                        ))}
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
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
