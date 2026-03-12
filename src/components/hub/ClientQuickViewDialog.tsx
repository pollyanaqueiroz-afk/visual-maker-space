import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Star, User, Mail, Phone, CreditCard, Calendar, Shield } from 'lucide-react';

interface ClientData {
  id: string;
  nome: string | null;
  email: string | null;
  email_alternativo: string | null;
  telefone_alternativo: string | null;
  id_curseduca: string | null;
  plano: string | null;
  cs_atual: string | null;
  cs_anterior: string | null;
  status_financeiro: string | null;
  status_curseduca: string | null;
  indice_fidelidade: number | null;
  data_criacao: string | null;
}

const STATUS_CURSEDUCA_OPTIONS = [
  'Ativo', 'Inativo', 'Suspenso', 'Em implantação', 'Cancelado', 'Trial',
];

const FIDELIDADE_OPTIONS = [1, 2, 3, 4, 5];

interface Props {
  clientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClientQuickViewDialog({ clientId, open, onOpenChange }: Props) {
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFidelidade, setEditFidelidade] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  useEffect(() => {
    if (!clientId || !open) return;
    setLoading(true);
    supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setClient(data as ClientData);
          setEditFidelidade(data.indice_fidelidade);
          setEditStatus(data.status_curseduca || '');
        }
        setLoading(false);
      });
  }, [clientId, open]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    const { error } = await supabase
      .from('clients')
      .update({
        indice_fidelidade: editFidelidade,
        status_curseduca: editStatus || null,
      })
      .eq('id', client.id);

    if (error) {
      toast.error('Erro ao salvar alterações');
    } else {
      toast.success('Cliente atualizado com sucesso');
      setClient(prev => prev ? { ...prev, indice_fidelidade: editFidelidade, status_curseduca: editStatus || null } : null);
    }
    setSaving(false);
  };

  const hasChanges = client && (editFidelidade !== client.indice_fidelidade || editStatus !== (client.status_curseduca || ''));

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('pt-BR');
    } catch {
      return '—';
    }
  };

  const statusFinanceiroBadge = (status: string | null) => {
    if (!status) return <span className="text-muted-foreground">—</span>;
    if (status === 'Adimplente') return <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">{status}</Badge>;
    if (status === 'Inadimplente') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {loading ? 'Carregando...' : (client?.nome || 'Cliente')}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : client ? (
          <div className="space-y-5">
            {/* Info section */}
            <div className="grid grid-cols-2 gap-3">
              <InfoRow icon={Shield} label="ID Curseduca" value={client.id_curseduca || '—'} />
              <InfoRow icon={CreditCard} label="Plano" value={client.plano || '—'} />
              <InfoRow icon={Mail} label="E-mail" value={client.email || '—'} />
              <InfoRow icon={Mail} label="E-mail Alt." value={client.email_alternativo || '—'} />
              <InfoRow icon={Phone} label="Telefone Alt." value={client.telefone_alternativo || '—'} />
              <InfoRow icon={Calendar} label="Data Criação" value={formatDate(client.data_criacao)} />
              <InfoRow icon={User} label="CS Atual" value={client.cs_atual || '—'} />
              <InfoRow icon={User} label="CS Anterior" value={client.cs_anterior || '—'} />
            </div>

            {/* Financial status */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Status Financeiro:</span>
              {statusFinanceiroBadge(client.status_financeiro)}
            </div>

            {/* Editable fields */}
            <div className="border-t pt-4 space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Campos Editáveis</h4>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Status Curseduca</label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecionar status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">Nenhum</SelectItem>
                    {STATUS_CURSEDUCA_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Índice de Fidelização</label>
                <div className="flex items-center gap-1">
                  {FIDELIDADE_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setEditFidelidade(editFidelidade === n ? null : n)}
                      className="p-1 transition-colors"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          editFidelidade != null && n <= editFidelidade
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                  {editFidelidade != null && (
                    <span className="ml-2 text-sm text-muted-foreground">{editFidelidade}/5</span>
                  )}
                </div>
              </div>
            </div>

            {/* Save button */}
            {hasChanges && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Salvar Alterações
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Cliente não encontrado</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
