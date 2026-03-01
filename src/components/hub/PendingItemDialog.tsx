import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Star, FileText, Video } from 'lucide-react';

interface PendingItem {
  id: string;
  type: 'loyalty' | 'minutes' | 'recording';
  title: string;
  subtitle: string;
  date: string;
  meetingId: string;
}

interface PendingItemDialogProps {
  item: PendingItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export default function PendingItemDialog({ item, open, onOpenChange, onSaved }: PendingItemDialogProps) {
  const [loyaltyIndex, setLoyaltyIndex] = useState<number | null>(null);
  const [loyaltyReason, setLoyaltyReason] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      let updateData: Record<string, any> = {};

      if (item.type === 'loyalty') {
        if (!loyaltyIndex || loyaltyIndex < 1 || loyaltyIndex > 10) {
          toast.error('Informe um índice entre 1 e 10');
          setSaving(false);
          return;
        }
        updateData = { loyalty_index: loyaltyIndex, loyalty_reason: loyaltyReason || null };
      } else if (item.type === 'minutes') {
        if (!urlInput.trim()) {
          toast.error('Informe o link da ata');
          setSaving(false);
          return;
        }
        updateData = { minutes_url: urlInput.trim() };
      } else if (item.type === 'recording') {
        if (!urlInput.trim()) {
          toast.error('Informe o link da gravação');
          setSaving(false);
          return;
        }
        updateData = { recording_url: urlInput.trim() };
      }

      const { error } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', item.meetingId);

      if (error) throw error;
      toast.success('Salvo com sucesso! ✅');
      resetForm();
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setLoyaltyIndex(null);
    setLoyaltyReason('');
    setUrlInput('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  if (!item) return null;

  const config = {
    loyalty: {
      icon: <Star className="h-5 w-5 text-amber-500" />,
      title: 'Preencher Índice de Fidelidade',
      description: `Reunião: ${item.title} — ${item.subtitle}`,
    },
    minutes: {
      icon: <FileText className="h-5 w-5 text-blue-500" />,
      title: 'Adicionar Ata da Reunião',
      description: `Reunião: ${item.title} — ${item.subtitle}`,
    },
    recording: {
      icon: <Video className="h-5 w-5 text-purple-500" />,
      title: 'Adicionar Gravação',
      description: `Reunião: ${item.title} — ${item.subtitle}`,
    },
  }[item.type];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            {config.icon}
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-sm">{config.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {item.type === 'loyalty' && (
            <>
              <div className="space-y-2">
                <Label>Índice de Fidelidade (1-10)</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLoyaltyIndex(n)}
                      className={`h-9 w-9 rounded-lg text-sm font-semibold transition-all border ${
                        loyaltyIndex === n
                          ? n <= 3 ? 'bg-destructive text-destructive-foreground border-destructive'
                            : n <= 6 ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-emerald-500 text-white border-emerald-500'
                          : 'border-border hover:border-primary/50 text-foreground hover:bg-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Textarea
                  value={loyaltyReason}
                  onChange={e => setLoyaltyReason(e.target.value)}
                  placeholder="Ex: Cliente engajado, usando bem a plataforma..."
                  rows={3}
                />
              </div>
            </>
          )}

          {item.type === 'minutes' && (
            <div className="space-y-2">
              <Label>Link da Ata</Label>
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://docs.google.com/..."
                onKeyDown={e => e.key === 'Enter' && urlInput.trim() && handleSave()}
                autoFocus
              />
            </div>
          )}

          {item.type === 'recording' && (
            <div className="space-y-2">
              <Label>Link da Gravação</Label>
              <Input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://meet.google.com/... ou link do vídeo"
                onKeyDown={e => e.key === 'Enter' && urlInput.trim() && handleSave()}
                autoFocus
              />
            </div>
          )}

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
