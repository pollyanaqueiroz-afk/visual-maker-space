import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import {
  FileImage, CalendarDays, BarChart3, Briefcase, Crown, Loader2, Sparkles, Rocket,
  AlertTriangle, Star, CheckCircle, ChevronRight, Smartphone,
} from 'lucide-react';
import { motion } from 'framer-motion';
import PendingItemDialog from '@/components/hub/PendingItemDialog';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const quickLinks = [
  { title: 'Gestão de Briefings', description: 'Gerencie briefings de design do time', url: '/hub/briefings', icon: FileImage, color: 'text-primary' },
  { title: 'Gestão de Aplicativos', description: 'Acompanhe implantações de apps', url: '/hub/aplicativos', icon: Smartphone, color: 'text-primary' },
  { title: 'Agendamento', description: 'Agende e gerencie reuniões', url: '/hub/agendamento', icon: CalendarDays, color: 'text-info' },
  { title: 'Dashboards', description: 'Acompanhe suas métricas', url: '/hub/dashboards', icon: BarChart3, color: 'text-success' },
  { title: 'Carteira Geral', description: 'Visão geral dos clientes', url: '/hub/carteira', icon: Briefcase, color: 'text-warning' },
  { title: 'Dashboard Liderança', description: 'Visão consolidada do time', url: '/hub/lideranca', icon: Crown, color: 'text-accent-foreground' },
];

interface PendingItem {
  id: string;
  type: 'loyalty' | 'minutes' | 'recording';
  title: string;
  subtitle: string;
  date: string;
  meetingId: string;
}

interface GroupedPending {
  meetingId: string;
  title: string;
  subtitle: string;
  date: string;
  items: PendingItem[];
}

export default function HubWelcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [selectedPending, setSelectedPending] = useState<PendingItem | null>(null);
  const [pendingDialogOpen, setPendingDialogOpen] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(0);

  useEffect(() => {
    if (!user) return;

    // --- DEV BYPASS START ---
    if ((user as any).id === '00000000-0000-0000-0000-000000000000') {
      setDisplayName('Dev');
      setLoading(false);
      return;
    }
    // --- DEV BYPASS END ---

    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();

      if (data?.display_name) {
        setDisplayName(data.display_name);
      } else {
        setShowNameDialog(true);
      }
      setLoading(false);
    })();
  }, [user, pendingRefresh]);

  // Fetch pending items
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingPending(true);
      const items: PendingItem[] = [];

      // Meetings completed but missing loyalty index, minutes or recording
      const { data: meetings } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, client_name, loyalty_index, minutes_url, recording_url')
        .eq('status', 'completed')
        .eq('created_by', user.id)
        .order('meeting_date', { ascending: false });

      if (meetings) {
        for (const m of meetings) {
          if (!m.loyalty_index) {
            items.push({ id: m.id + '-loyalty', type: 'loyalty', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
          }
          if (!m.minutes_url) {
            items.push({ id: m.id + '-minutes', type: 'minutes', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
          }
          if (!m.recording_url) {
            items.push({ id: m.id + '-recording', type: 'recording', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
          }
        }
      }

      setPendingItems(items);
      setLoadingPending(false);
    })();
  }, [user]);

  const handleSaveName = async () => {
    if (!nameInput.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: nameInput.trim() })
        .eq('user_id', user.id);
      if (error) throw error;
      setDisplayName(nameInput.trim());
      setShowNameDialog(false);
      toast.success('Bem-vindo(a), ' + nameInput.trim() + '! 🎉');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getPendingIcon = (type: string) => {
    switch (type) {
      case 'loyalty': return <Star className="h-4 w-4 text-destructive" />;
      case 'minutes': return <FileImage className="h-4 w-4 text-warning" />;
      case 'recording': return <FileImage className="h-4 w-4 text-info" />;
      default: return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getPendingLabel = (type: string) => {
    switch (type) {
      case 'loyalty': return 'Índice de Fidelidade';
      case 'minutes': return 'Ata da Reunião';
      case 'recording': return 'Gravação';
      default: return 'Pendência';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Bem-vindo(a) ao Hub de Operações!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Como você gostaria de ser chamado(a)? Esse nome será usado para personalizar sua experiência.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Seu nome</Label>
              <Input
                id="display-name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Ex: Ana, Carlos, Mari..."
                onKeyDown={e => e.key === 'Enter' && nameInput.trim() && handleSaveName()}
                autoFocus
                maxLength={50}
              />
            </div>
            <Button className="w-full" onClick={handleSaveName} disabled={!nameInput.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Começar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Welcome Page */}
      <div className="p-6 md:p-10 space-y-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            {getGreeting()}, <span className="text-primary">{displayName || 'colega'}</span>! 👋
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            Este é o seu Hub de Operações. Escolha um módulo para começar.
          </p>
        </motion.div>

        <Tabs defaultValue="pendencias" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pendencias" className="flex items-center gap-1.5 relative">
              <AlertTriangle className="h-4 w-4" /> Pendências
              {pendingItems.length > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                  {pendingItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="modulos" className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Módulos
            </TabsTrigger>
          </TabsList>

          {/* Módulos Tab */}
          <TabsContent value="modulos">
            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              {quickLinks.map((link, i) => (
                <motion.div
                  key={link.url}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * (i + 1), duration: 0.4 }}
                >
                  <NavLink to={link.url} className="block group" activeClassName="">
                    <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/30 group-hover:bg-muted/30">
                      <CardContent className="p-5 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <link.icon className={`h-5 w-5 ${link.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-foreground">{link.title}</h3>
                            <p className="text-xs text-muted-foreground">{link.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </NavLink>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>

          {/* Pendências Tab */}
          <TabsContent value="pendencias">
            {loadingPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-10 w-10 text-success mb-3" />
                  <p className="font-medium text-foreground">Tudo em dia! 🎉</p>
                  <p className="text-sm text-muted-foreground mt-1">Você não tem pendências no momento.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {(() => {
                  // Group by meetingId
                  const grouped: GroupedPending[] = [];
                  const map = new Map<string, GroupedPending>();
                  for (const item of pendingItems) {
                    let g = map.get(item.meetingId);
                    if (!g) {
                      g = { meetingId: item.meetingId, title: item.title, subtitle: item.subtitle, date: item.date, items: [] };
                      map.set(item.meetingId, g);
                      grouped.push(g);
                    }
                    g.items.push(item);
                  }
                  return grouped.map((group, i) => (
                    <motion.div
                      key={group.meetingId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <Card
                        className="cursor-pointer transition-all hover:shadow-sm border-destructive/40 hover:border-destructive/60 bg-destructive/5"
                        onClick={() => { setSelectedPending(group.items[0]); setPendingDialogOpen(true); }}
                      >
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{group.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {group.subtitle} • {(() => {
                                try { return format(parseISO(group.date), "dd/MM/yyyy", { locale: ptBR }); }
                                catch { return group.date; }
                              })()}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {group.items.map(item => (
                                <Badge key={item.id} variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive">
                                  {getPendingLabel(item.type)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Badge variant="destructive" className="h-6 min-w-6 px-1.5 text-xs font-bold shrink-0">
                            {group.items.length}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ));
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <PendingItemDialog
        item={selectedPending}
        open={pendingDialogOpen}
        onOpenChange={setPendingDialogOpen}
        onSaved={() => setPendingRefresh(p => p + 1)}
      />
    </>
  );
}
