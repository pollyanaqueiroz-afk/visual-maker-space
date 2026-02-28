import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  MessageSquare, Phone, Video, StickyNote, Plus, Loader2, Trash2, Clock,
  ChevronDown, ChevronUp,
} from 'lucide-react';

interface Interaction {
  id: string;
  client_id: string;
  interaction_type: string;
  title: string;
  content: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
  note: { label: 'Anotação', icon: StickyNote, color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  call: { label: 'Ligação', icon: Phone, color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  meeting: { label: 'Reunião', icon: Video, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
  message: { label: 'Mensagem', icon: MessageSquare, color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
};

interface Props {
  clientId: string;
}

export default function ClientInteractionHistory({ clientId }: Props) {
  const { user } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Form state
  const [formType, setFormType] = useState('note');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  const loadInteractions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from('client_interactions' as any)
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }) as any);

    if (error) {
      console.error(error);
    } else {
      setInteractions((data || []) as Interaction[]);
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => { loadInteractions(); }, [loadInteractions]);

  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast.error('Informe um título');
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from('client_interactions' as any).insert({
      client_id: clientId,
      interaction_type: formType,
      title: formTitle.trim(),
      content: formContent.trim() || null,
      created_by: user?.id || null,
      created_by_name: user?.email || null,
    }) as any);

    if (error) {
      console.error(error);
      toast.error('Erro ao salvar interação');
    } else {
      toast.success('Interação registrada!');
      setFormTitle('');
      setFormContent('');
      setFormType('note');
      setShowForm(false);
      await loadInteractions();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from('client_interactions' as any).delete().eq('id', id) as any);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      setInteractions(prev => prev.filter(i => i.id !== id));
      toast.success('Interação removida');
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle
            className="text-sm font-semibold flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            <MessageSquare className="h-4 w-4 text-primary" />
            Histórico de Interações
            <Badge variant="secondary" className="text-[10px] ml-1">{interactions.length}</Badge>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </CardTitle>
          {expanded && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" />
              Registrar
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* New interaction form */}
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="space-y-1 flex-1">
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger className="h-9 text-sm w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <cfg.icon className="h-3.5 w-3.5" />
                            {cfg.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                placeholder="Título da interação..."
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                className="h-9 text-sm"
              />
              <Textarea
                placeholder="Detalhes, observações, decisões tomadas..."
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                className="text-sm min-h-[80px]"
              />
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={saving || !formTitle.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma interação registrada ainda.
            </p>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              {interactions.map((item) => {
                const cfg = TYPE_CONFIG[item.interaction_type] || TYPE_CONFIG.note;
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="relative flex gap-3 py-3 group">
                    {/* Timeline dot */}
                    <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {cfg.label}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(item.created_at)}
                            </span>
                            {item.created_by_name && (
                              <span className="text-[11px] text-muted-foreground">
                                por {item.created_by_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {item.content && (
                        <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
