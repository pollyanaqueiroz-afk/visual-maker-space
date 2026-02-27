import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { NavLink } from '@/components/NavLink';
import {
  FileImage, CalendarDays, BarChart3, Briefcase, Crown, Loader2, Sparkles, Rocket,
} from 'lucide-react';
import { motion } from 'framer-motion';

const quickLinks = [
  { title: 'Gestão de Briefings', description: 'Gerencie briefings de design do time', url: '/hub/briefings', icon: FileImage, color: 'text-primary' },
  { title: 'Agendamento', description: 'Agende e gerencie reuniões', url: '/hub/agendamento', icon: CalendarDays, color: 'text-info' },
  { title: 'Dashboards', description: 'Acompanhe suas métricas', url: '/hub/dashboards', icon: BarChart3, color: 'text-success' },
  { title: 'Carteira Geral', description: 'Visão geral dos clientes', url: '/hub/carteira', icon: Briefcase, color: 'text-warning' },
  { title: 'Dashboard Liderança', description: 'Visão consolidada do time', url: '/hub/lideranca', icon: Crown, color: 'text-accent-foreground' },
];

export default function HubWelcome() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

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
      </div>
    </>
  );
}
