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
  { title: 'Gestão de Briefings', description: 'Gerencie briefings de design', url: '/hub/briefings', icon: FileImage, color: 'text-violet-400', gradient: 'from-violet-500/20 to-violet-500/5' },
  { title: 'Gestão de Aplicativos', description: 'Acompanhe implantações', url: '/hub/aplicativos', icon: Smartphone, color: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-500/5' },
  { title: 'Agendamento', description: 'Gerencie reuniões', url: '/hub/agendamento', icon: CalendarDays, color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-cyan-500/5' },
  { title: 'Dashboards', description: 'Acompanhe métricas', url: '/hub/dashboards', icon: BarChart3, color: 'text-emerald-400', gradient: 'from-emerald-500/20 to-emerald-500/5' },
  { title: 'Carteira Geral', description: 'Visão dos clientes', url: '/hub/carteira', icon: Briefcase, color: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-500/5' },
  { title: 'Dashboard Liderança', description: 'Visão do time', url: '/hub/lideranca', icon: Crown, color: 'text-rose-400', gradient: 'from-rose-500/20 to-rose-500/5' },
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
  const [summaryStats, setSummaryStats] = useState({ pendingArts: 0, overdueArts: 0, todayMeetings: 0 });

  useEffect(() => {
    if (!user) return;
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingPending(true);
      const items: PendingItem[] = [];
      const today = new Date().toISOString().split('T')[0];

      const [meetingsRes, pendingArtsRes, overdueArtsRes, todayMeetingsRes] = await Promise.all([
        supabase
          .from('meetings')
          .select('id, title, meeting_date, client_name, loyalty_index, minutes_url, recording_url')
          .eq('status', 'completed')
          .eq('created_by', user.id)
          .order('meeting_date', { ascending: false }),
        supabase.from('briefing_images').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
        supabase.from('briefing_images').select('created_at', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']).lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('meeting_date', today).in('status', ['scheduled', 'confirmed']),
      ]);

      setSummaryStats({
        pendingArts: pendingArtsRes.count ?? 0,
        overdueArts: overdueArtsRes.count ?? 0,
        todayMeetings: todayMeetingsRes.count ?? 0,
      });

      const meetings = meetingsRes.data;
      if (meetings) {
        for (const m of meetings) {
          if (!m.loyalty_index) items.push({ id: m.id + '-loyalty', type: 'loyalty', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
          if (!m.minutes_url) items.push({ id: m.id + '-minutes', type: 'minutes', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
          if (!m.recording_url) items.push({ id: m.id + '-recording', type: 'recording', title: m.title, subtitle: m.client_name || 'Sem cliente', date: m.meeting_date, meetingId: m.id });
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
      const { error } = await supabase.from('profiles').update({ display_name: nameInput.trim() }).eq('user_id', user.id);
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
    if (hour < 12) return { text: 'Bom dia', emoji: '☀️' };
    if (hour < 18) return { text: 'Boa tarde', emoji: '🌤️' };
    return { text: 'Boa noite', emoji: '🌙' };
  };

  const getPendingLabel = (type: string) => {
    switch (type) {
      case 'loyalty': return 'Índice de Fidelidade';
      case 'minutes': return 'Ata da Reunião';
      case 'recording': return 'Gravação';
      default: return 'Pendência';
    }
  };

  const firstName = displayName?.split(' ')[0] || 'colega';
  const greeting = getGreeting();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Dialog open={showNameDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Bem-vindo(a) ao Hub de Operações!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              Como você gostaria de ser chamado(a)?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Seu nome</Label>
              <Input id="display-name" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Ex: Ana, Carlos, Mari..." onKeyDown={e => e.key === 'Enter' && nameInput.trim() && handleSaveName()} autoFocus maxLength={50} />
            </div>
            <Button className="w-full" onClick={handleSaveName} disabled={!nameInput.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              Começar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-4xl mx-auto">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none rounded-3xl" />

        <div className="relative space-y-8 p-6 md:p-10">
          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {greeting.emoji} {greeting.text}, <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">{firstName}</span>!
            </h1>
            <p className="text-muted-foreground mt-1">Aqui está o resumo do seu dia</p>
          </motion.div>

          {/* Summary glassmorphism cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <FileImage className="h-4 w-4 text-primary opacity-70" />
                <p className="text-sm text-muted-foreground">Artes pendentes</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.pendingArts}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-destructive opacity-70" />
                <p className="text-sm text-muted-foreground">Atrasadas</p>
              </div>
              <p className="text-2xl font-bold text-destructive">{summaryStats.overdueArts}</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-info/10 to-info/5 border border-info/10 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="h-4 w-4 text-info opacity-70" />
                <p className="text-sm text-muted-foreground">Reuniões hoje</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{summaryStats.todayMeetings}</p>
            </div>
          </motion.div>

          <Tabs defaultValue="modulos" className="w-full">
            <TabsList className="mb-4 bg-muted/30 border border-border/20">
              <TabsTrigger value="modulos" className="flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Módulos
              </TabsTrigger>
              <TabsTrigger value="pendencias" className="flex items-center gap-1.5 relative">
                <AlertTriangle className="h-4 w-4" /> Pendências
                {pendingItems.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                    {pendingItems.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Módulos Tab — Quick links with tech cards */}
            <TabsContent value="modulos">
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Módulos</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {quickLinks.map((link, i) => (
                    <motion.div
                      key={link.url}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -2 }}
                      onClick={() => navigate(link.url)}
                      className="group p-4 rounded-xl bg-card border border-border/30 cursor-pointer hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${link.gradient} mb-3`}>
                        <link.icon className={`h-5 w-5 ${link.color}`} />
                      </div>
                      <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{link.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Pendências Tab */}
            <TabsContent value="pendencias">
              {loadingPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingItems.length === 0 ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
                  <Card className="border-dashed border-border/30 bg-card">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <CheckCircle className="h-10 w-10 text-emerald-400 mb-3" />
                      <p className="font-medium text-foreground">Tudo em dia! 🎉</p>
                      <p className="text-sm text-muted-foreground mt-1">Você não tem pendências no momento.</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="space-y-2">
                  {(() => {
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
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.35, ease: 'easeOut' }}
                      >
                        <div
                          className="p-4 rounded-xl bg-destructive/5 border border-destructive/15 hover:border-destructive/30 transition-colors cursor-pointer group"
                          onClick={() => { setSelectedPending(group.items[0]); setPendingDialogOpen(true); }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors shrink-0">
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
                                  <Badge key={item.id} variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/20 text-destructive">
                                    {getPendingLabel(item.type)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <Badge className="bg-destructive text-destructive-foreground text-[10px] shrink-0">
                              {group.items.length}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      </motion.div>
                    ));
                  })()}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
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
