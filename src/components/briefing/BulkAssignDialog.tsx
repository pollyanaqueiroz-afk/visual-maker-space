import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2 } from 'lucide-react';

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageIds: string[];
  onAssigned: () => void;
}

const DEFAULT_PRICE_PER_ART = 35;

export default function BulkAssignDialog({ open, onOpenChange, imageIds, onAssigned }: BulkAssignDialogProps) {
  const count = imageIds.length;
  const [email, setEmail] = useState('');
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [totalPrice, setTotalPrice] = useState(count * DEFAULT_PRICE_PER_ART);
  const [designerType, setDesignerType] = useState<'externo' | 'interno'>('externo');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setTotalPrice(count * DEFAULT_PRICE_PER_ART);
  }, [count]);

  const pricePerArt = designerType === 'interno' ? 0 : (count > 0 ? totalPrice / count : 0);

  const handleSend = async () => {
    if (!email) {
      toast.error('Informe o email do responsável');
      return;
    }
    if (designerType === 'externo' && (!totalPrice || totalPrice <= 0)) {
      toast.error('Informe o preço total para designer externo');
      return;
    }

    setSending(true);
    try {
      let hasEmailWarning = false;
      // Send each image one by one through the edge function
      for (const imageId of imageIds) {
        // First update price
        await supabase.from('briefing_images').update({
          price_per_art: pricePerArt,
        } as any).eq('id', imageId);

        const { data, error } = await supabase.functions.invoke('send-briefing-email', {
          body: {
            image_id: imageId,
            assigned_email: email,
            deadline: new Date(deadline + 'T23:59:59').toISOString(),
            app_url: window.location.origin,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        if (data?.email_warning) hasEmailWarning = true;
      }

      if (hasEmailWarning) {
        toast.success(`${count} briefing(s) atribuído(s)! ⚠️ E-mails não enviados (domínio Resend não verificado).`);
      } else {
        toast.success(`${count} briefing(s) enviado(s) com sucesso!`);
      }
      onOpenChange(false);
      onAssigned();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao enviar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Enviar Briefings em Lote</DialogTitle>
          <p className="text-sm text-muted-foreground">{count} arte(s) selecionada(s)</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Tipo de designer</Label>
            <RadioGroup value={designerType} onValueChange={(v) => setDesignerType(v as 'interno' | 'externo')} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="interno" id="bulk-tipo-interno" />
                <Label htmlFor="bulk-tipo-interno" className="cursor-pointer font-normal">Interno</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="externo" id="bulk-tipo-externo" />
                <Label htmlFor="bulk-tipo-externo" className="cursor-pointer font-normal">Externo</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Email do responsável</Label>
            <Input
              type="email"
              placeholder="designer@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Prazo de entrega</Label>
            <Input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
            />
          </div>
          {designerType === 'externo' && (
            <>
              <div className="space-y-2">
                <Label>Preço total (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalPrice}
                  onChange={e => setTotalPrice(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Padrão: {count} arte(s) × R$ {DEFAULT_PRICE_PER_ART.toFixed(2)} = R$ {(count * DEFAULT_PRICE_PER_ART).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <span className="text-muted-foreground">Preço por arte: </span>
                <span className="font-semibold">R$ {pricePerArt.toFixed(2)}</span>
              </div>
            </>
          )}
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando {count} briefing(s)...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar {count} briefing(s)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
