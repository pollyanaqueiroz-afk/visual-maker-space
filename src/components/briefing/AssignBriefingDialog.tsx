import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2 } from 'lucide-react';

interface AssignBriefingDialogProps {
  imageId: string;
  currentEmail?: string | null;
  currentDeadline?: string | null;
  imageLabel: string;
  onAssigned: () => void;
}

export default function AssignBriefingDialog({
  imageId,
  currentEmail,
  currentDeadline,
  imageLabel,
  onAssigned,
}: AssignBriefingDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail || '');
  const [deadline, setDeadline] = useState(() => {
    if (currentDeadline) {
      return currentDeadline.slice(0, 10);
    }
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email) {
      toast.error('Informe o email do responsável');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-briefing-email', {
        body: {
          image_id: imageId,
          assigned_email: email,
          deadline: new Date(deadline + 'T23:59:59').toISOString(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Briefing enviado com sucesso!');
      setOpen(false);
      onAssigned();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Atribuir e enviar briefing">
          <Send className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Enviar Briefing</DialogTitle>
          <p className="text-sm text-muted-foreground">{imageLabel}</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="assign-email">Email do responsável</Label>
            <Input
              id="assign-email"
              type="email"
              placeholder="designer@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-deadline">Prazo de entrega</Label>
            <Input
              id="assign-deadline"
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar por email
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
