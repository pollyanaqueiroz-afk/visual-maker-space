import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Loader2, LayoutGrid, Trash2, Edit2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

interface KanbanBoard {
  id: string;
  title: string;
  description: string | null;
  color: string;
  created_at: string;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f59e0b', '#eab308', '#84cc16',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
];

export default function KanbanBoardsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('kanban.manage_columns');
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<KanbanBoard | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('kanban_boards' as any).select('*').order('created_at', { ascending: true }) as any);
    if (error) { console.error(error); toast.error('Erro ao carregar boards'); }
    setBoards((data || []) as KanbanBoard[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  const openNew = () => {
    setEditingBoard(null);
    setTitle('');
    setDescription('');
    setColor('#6366f1');
    setDialogOpen(true);
  };

  const openEdit = (board: KanbanBoard) => {
    setEditingBoard(board);
    setTitle(board.title);
    setDescription(board.description || '');
    setColor(board.color);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!title.trim()) { toast.error('Informe o título'); return; }
    setSaving(true);

    if (editingBoard) {
      const { error } = await (supabase.from('kanban_boards' as any)
        .update({ title: title.trim(), description: description.trim() || null, color })
        .eq('id', editingBoard.id) as any);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Board atualizado');
    } else {
      const { error } = await (supabase.from('kanban_boards' as any)
        .insert({ title: title.trim(), description: description.trim() || null, color }) as any);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Board criado');
    }
    setSaving(false);
    setDialogOpen(false);
    loadBoards();
  };

  const deleteBoard = async (id: string) => {
    const { error } = await (supabase.from('kanban_boards' as any).delete().eq('id', id) as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Board removido'); loadBoards(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kanban de Clientes</h1>
          <p className="text-sm text-muted-foreground">Selecione ou crie um board para gerenciar o pipeline</p>
        </div>
        {canManage && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo Board
          </Button>
        )}
      </div>

      {boards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhum board criado</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro Kanban para começar a gerenciar clientes</p>
            {canManage && (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Criar Board
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(board => (
            <Card
              key={board.id}
              className="cursor-pointer hover:shadow-lg transition-shadow group relative overflow-hidden"
              onClick={() => navigate(`/hub/kanban/${board.id}`)}
            >
              <div className="h-2" style={{ backgroundColor: board.color }} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-foreground truncate">{board.title}</h3>
                    {board.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{board.description}</p>
                    )}
                  </div>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(board); }}>
                          <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); deleteBoard(board.id); }}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBoard ? 'Editar Board' : 'Novo Board'}</DialogTitle>
            <DialogDescription>
              {editingBoard ? 'Atualize as informações do board' : 'Crie um novo Kanban board'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Pipeline de Onboarding" className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o propósito deste board..." rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingBoard ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
