import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

type Plano = { id: string; nome: string };
type Etapa = { id: string; nome: string };
type CsConfig = { id: string; etapa_id: string; plano_id: string | null; user_email: string; user_name: string | null; peso: number; ativo: boolean };
type UserProfile = { user_id: string; email: string | null; display_name: string | null };

interface Props {
  planos: Plano[];
  etapas: Etapa[];
  csConfigs: CsConfig[];
  onRefresh?: () => void;
}

export default function JornadaClienteVisual({ planos, etapas, csConfigs, onRefresh }: Props) {
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [editingCell, setEditingCell] = useState<{ planoId: string; etapaId: string; csId?: string } | null>(null);
  const [editQuery, setEditQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users-api`, {
          headers: {
            'Authorization': 'Basic WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq',
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const json = await res.json();
          setUserProfiles((json.users || []).map((u: any) => ({
            user_id: u.id, email: u.email, display_name: u.display_name,
          })));
        }
      } catch (e) { console.error('Failed to fetch users', e); }
    };
    fetchProfiles();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredUsers = (() => {
    const q = editQuery.toLowerCase();
    if (!q) return userProfiles.slice(0, 10);
    return userProfiles.filter(u =>
      u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    ).slice(0, 10);
  })();

  const startEdit = (planoId: string, etapaId: string, cs?: CsConfig) => {
    setEditingCell({ planoId, etapaId, csId: cs?.id });
    setEditQuery(cs?.user_name || cs?.user_email || '');
    setShowSuggestions(false);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditQuery('');
    setShowSuggestions(false);
  };

  const selectUser = async (user: UserProfile) => {
    if (!editingCell) return;
    setSaving(true);

    const displayName = user.display_name || user.email || '';
    const email = user.email || '';

    if (editingCell.csId) {
      // Update existing
      const { error } = await supabase
        .from('carteirizacao_cs')
        .update({ user_email: email, user_name: displayName } as any)
        .eq('id', editingCell.csId);
      if (error) { toast.error('Erro ao atualizar'); } else { toast.success('CS atualizado'); }
    } else {
      // Insert new
      const { error } = await supabase
        .from('carteirizacao_cs')
        .insert({ plano_id: editingCell.planoId, etapa_id: editingCell.etapaId, user_email: email, user_name: displayName, peso: 1 } as any);
      if (error) { toast.error(error.message.includes('duplicate') ? 'CS já existe nessa célula' : 'Erro ao adicionar'); } else { toast.success('CS adicionado'); }
    }

    setSaving(false);
    cancelEdit();
    onRefresh?.();
  };

  const deleteCs = async (csId: string) => {
    await supabase.from('carteirizacao_cs').delete().eq('id', csId);
    toast.success('CS removido');
    onRefresh?.();
  };

  if (planos.length === 0 || etapas.length === 0) return null;

  const isEditing = (planoId: string, etapaId: string, csId?: string) =>
    editingCell?.planoId === planoId && editingCell?.etapaId === etapaId && editingCell?.csId === csId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Jornada do Cliente Curseduca</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-semibold text-muted-foreground border-b border-border min-w-[140px]">Plano</th>
                {etapas.map(etapa => (
                  <th key={etapa.id} className="p-2 text-center font-semibold border-b border-border min-w-[160px]">
                    <span className="inline-block px-3 py-1 rounded-md bg-primary/10 text-primary text-xs font-semibold">{etapa.nome}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planos.map((plano, pi) => {
                const csForPlano = csConfigs.filter(c => c.plano_id === plano.id && c.ativo);
                return (
                  <tr key={plano.id} className={pi % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="p-2 border-b border-border/50">
                      <span className="inline-block px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">{plano.nome}</span>
                    </td>
                    {etapas.map(etapa => {
                      const csForCell = csForPlano.filter(c => c.etapa_id === etapa.id);
                      const addingNew = isEditing(plano.id, etapa.id, undefined) && !editingCell?.csId;
                      return (
                        <td key={etapa.id} className="p-2 border-b border-border/50 align-top">
                          <div className="flex flex-wrap gap-1 group/cell items-center">
                            {csForCell.map(cs => (
                              isEditing(plano.id, etapa.id, cs.id) ? (
                                <div key={cs.id} className="relative" ref={suggestionsRef}>
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editQuery}
                                      onChange={e => { setEditQuery(e.target.value); setShowSuggestions(true); }}
                                      onFocus={() => setShowSuggestions(true)}
                                      placeholder="Buscar CS..."
                                      className="h-7 text-xs w-36"
                                      autoFocus
                                      disabled={saving}
                                    />
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit} disabled={saving}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {showSuggestions && filteredUsers.length > 0 && (
                                    <div className="absolute z-50 top-full left-0 mt-1 w-60 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                                      {filteredUsers.map(u => (
                                        <button key={u.user_id} type="button" className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent text-sm"
                                          onClick={() => selectUser(u)}>
                                          <span className="font-medium text-xs">{u.display_name || u.email}</span>
                                          {u.display_name && <span className="text-[10px] text-muted-foreground">{u.email}</span>}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span key={cs.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium group/cs cursor-pointer"
                                  onClick={() => startEdit(plano.id, etapa.id, cs)}>
                                  {cs.user_name || cs.user_email.split('@')[0]}
                                  <Pencil className="h-2.5 w-2.5 opacity-0 group-hover/cs:opacity-60 transition-opacity" />
                                </span>
                              )
                            ))}
                            {addingNew ? (
                              <div className="relative" ref={suggestionsRef}>
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editQuery}
                                    onChange={e => { setEditQuery(e.target.value); setShowSuggestions(true); }}
                                    onFocus={() => setShowSuggestions(true)}
                                    placeholder="Buscar CS..."
                                    className="h-7 text-xs w-36"
                                    autoFocus
                                    disabled={saving}
                                  />
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit} disabled={saving}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {showSuggestions && filteredUsers.length > 0 && (
                                  <div className="absolute z-50 top-full left-0 mt-1 w-60 max-h-48 overflow-auto rounded-md border bg-popover shadow-md">
                                    {filteredUsers.map(u => (
                                      <button key={u.user_id} type="button" className="flex flex-col w-full px-3 py-2 text-left hover:bg-accent text-sm"
                                        onClick={() => selectUser(u)}>
                                        <span className="font-medium text-xs">{u.display_name || u.email}</span>
                                        {u.display_name && <span className="text-[10px] text-muted-foreground">{u.email}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                className="inline-flex items-center justify-center h-6 w-6 rounded opacity-0 group-hover/cell:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                                onClick={() => startEdit(plano.id, etapa.id)}
                                title="Adicionar CS"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
