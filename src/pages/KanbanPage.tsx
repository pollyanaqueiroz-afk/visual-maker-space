import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Loader2, Search, User, DollarSign, ExternalLink, MoreHorizontal, Edit2, Trash2, ArrowLeft, UserPlus,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  sort_order: number;
  board_id: string | null;
}

interface ClientCard {
  id: string;
  client_name: string | null;
  client_url: string;
  email_do_cliente: string | null;
  nome_do_cs_atual: string | null;
  plano_contratado: string | null;
  valor_mensal: string | null;
  status_financeiro: string | null;
}

interface CardPosition {
  client_id: string;
  column_id: string | null;
}

interface BoardInfo {
  id: string;
  title: string;
  color: string;
  description: string | null;
}

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f59e0b', '#eab308', '#84cc16',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6',
];

export default function KanbanPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('kanban.edit');
  const canManageColumns = hasPermission('kanban.manage_columns');

  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [allClients, setAllClients] = useState<ClientCard[]>([]);
  const [positions, setPositions] = useState<CardPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedClient, setDraggedClient] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Column management
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<KanbanColumn | null>(null);
  const [colTitle, setColTitle] = useState('');
  const [colColor, setColColor] = useState('#6366f1');
  const [savingCol, setSavingCol] = useState(false);

  // Add client dialog
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [addingClient, setAddingClient] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);

    const [boardRes, colRes, posRes, clientRes] = await Promise.all([
      supabase.from('kanban_boards' as any).select('*').eq('id', boardId).single() as any,
      supabase.from('kanban_columns' as any).select('*').eq('board_id', boardId).order('sort_order', { ascending: true }) as any,
      supabase.from('kanban_card_positions' as any).select('client_id, column_id').eq('board_id', boardId) as any,
      supabase.from('clients' as any).select('id, client_name, client_url, email_do_cliente, nome_do_cs_atual, plano_contratado, valor_mensal, status_financeiro').order('client_name', { ascending: true }) as any,
    ]);

    if (boardRes.error) { toast.error('Board não encontrado'); navigate('/hub/kanban'); return; }
    setBoard(boardRes.data as BoardInfo);
    setColumns((colRes.data || []) as KanbanColumn[]);
    setPositions((posRes.data || []) as CardPosition[]);

    // Handle pagination for clients
    let clients = (clientRes.data || []) as ClientCard[];
    if (clients.length === 1000) {
      let from = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: page } = await (supabase.from('clients' as any)
          .select('id, client_name, client_url, email_do_cliente, nome_do_cs_atual, plano_contratado, valor_mensal, status_financeiro')
          .order('client_name', { ascending: true }).range(from, from + 999) as any);
        if (!page || page.length === 0) { hasMore = false; break; }
        clients = clients.concat(page as ClientCard[]);
        hasMore = page.length === 1000;
        from += 1000;
      }
    }
    setAllClients(clients);
    setLoading(false);
  }, [boardId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Only clients that are in this board
  const boardClientIds = useMemo(() => new Set(positions.map(p => p.client_id)), [positions]);

  const boardClients = useMemo(() => {
    return allClients.filter(c => boardClientIds.has(c.id));
  }, [allClients, boardClientIds]);

  const filteredClients = useMemo(() => {
    if (!search) return boardClients;
    const q = search.toLowerCase();
    return boardClients.filter(c =>
      (c.client_name && c.client_name.toLowerCase().includes(q)) ||
      (c.nome_do_cs_atual && c.nome_do_cs_atual.toLowerCase().includes(q)) ||
      (c.email_do_cliente && c.email_do_cliente.toLowerCase().includes(q)) ||
      (c.plano_contratado && c.plano_contratado.toLowerCase().includes(q))
    );
  }, [boardClients, search]);

  // Group clients by column
  const clientsByColumn = useMemo(() => {
    const posMap = new Map(positions.map(p => [p.client_id, p.column_id]));
    const map: Record<string, ClientCard[]> = {};
    for (const col of columns) map[col.id] = [];
    map['__unassigned'] = [];

    for (const c of filteredClients) {
      const colId = posMap.get(c.id);
      const key = colId && map[colId] ? colId : '__unassigned';
      map[key].push(c);
    }
    return map;
  }, [columns, filteredClients, positions]);

  // Available clients (not yet in this board)
  const availableClients = useMemo(() => {
    const q = clientSearch.toLowerCase();
    return allClients.filter(c =>
      !boardClientIds.has(c.id) &&
      (!q || (c.client_name && c.client_name.toLowerCase().includes(q)) || c.client_url.toLowerCase().includes(q))
    );
  }, [allClients, boardClientIds, clientSearch]);

  // Drag and drop
  const handleDragStart = (clientId: string) => { if (canEdit) setDraggedClient(clientId); };
  const handleDragEnd = () => { setDraggedClient(null); setDragOverColumn(null); };

  const handleDrop = async (columnId: string) => {
    if (!draggedClient || !boardId) return;
    const actualColId = columnId === '__unassigned' ? null : columnId;

    // Optimistic update
    setPositions(prev => prev.map(p =>
      p.client_id === draggedClient ? { ...p, column_id: actualColId } : p
    ));
    setDraggedClient(null);
    setDragOverColumn(null);

    const { error } = await (supabase.from('kanban_card_positions' as any)
      .update({ column_id: actualColId })
      .eq('board_id', boardId)
      .eq('client_id', draggedClient) as any);

    if (error) {
      console.error(error);
      toast.error('Erro ao mover cliente');
      loadData();
    }
  };

  // Add client to board
  const addClientToBoard = async (clientId: string) => {
    if (!boardId) return;
    setAddingClient(clientId);
    const { error } = await (supabase.from('kanban_card_positions' as any)
      .insert({ board_id: boardId, client_id: clientId, column_id: null }) as any);

    if (error) {
      toast.error('Erro ao adicionar cliente');
    } else {
      setPositions(prev => [...prev, { client_id: clientId, column_id: null }]);
      toast.success('Cliente adicionado ao board');
    }
    setAddingClient(null);
  };

  // Remove client from board
  const removeClientFromBoard = async (clientId: string) => {
    if (!boardId) return;
    const { error } = await (supabase.from('kanban_card_positions' as any)
      .delete().eq('board_id', boardId).eq('client_id', clientId) as any);

    if (error) toast.error('Erro ao remover cliente');
    else {
      setPositions(prev => prev.filter(p => p.client_id !== clientId));
      toast.success('Cliente removido do board');
    }
  };

  // Column CRUD
  const openNewColumn = () => {
    setEditingColumn(null); setColTitle(''); setColColor('#6366f1'); setColDialogOpen(true);
  };

  const openEditColumn = (col: KanbanColumn) => {
    setEditingColumn(col); setColTitle(col.title); setColColor(col.color); setColDialogOpen(true);
  };

  const saveColumn = async () => {
    if (!colTitle.trim() || !boardId) { toast.error('Informe o título'); return; }
    setSavingCol(true);

    if (editingColumn) {
      const { error } = await (supabase.from('kanban_columns' as any)
        .update({ title: colTitle.trim(), color: colColor })
        .eq('id', editingColumn.id) as any);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Coluna atualizada');
    } else {
      const maxOrder = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) + 1 : 0;
      const { error } = await (supabase.from('kanban_columns' as any)
        .insert({ title: colTitle.trim(), color: colColor, sort_order: maxOrder, board_id: boardId }) as any);
      if (error) toast.error('Erro: ' + error.message);
      else toast.success('Coluna criada');
    }
    setSavingCol(false);
    setColDialogOpen(false);
    loadData();
  };

  const deleteColumn = async (colId: string) => {
    // Move card positions to unassigned first
    if (boardId) {
      await (supabase.from('kanban_card_positions' as any)
        .update({ column_id: null }).eq('column_id', colId).eq('board_id', boardId) as any);
    }
    const { error } = await (supabase.from('kanban_columns' as any).delete().eq('id', colId) as any);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Coluna removida'); loadData(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderColumn = (colId: string, title: string, color: string, isCustom: boolean) => {
    const cards = clientsByColumn[colId] || [];
    const isDragOver = dragOverColumn === colId;

    return (
      <div
        key={colId}
        className="flex-shrink-0 w-[300px] flex flex-col max-h-full"
        onDragOver={(e) => { e.preventDefault(); setDragOverColumn(colId); }}
        onDragLeave={() => setDragOverColumn(null)}
        onDrop={(e) => { e.preventDefault(); handleDrop(colId); }}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="text-[10px] h-5">{cards.length}</Badge>
          </div>
          {isCustom && canManageColumns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEditColumn(columns.find(c => c.id === colId)!)}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => deleteColumn(colId)}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className={`flex-1 space-y-2 p-2 rounded-lg border-2 border-dashed transition-colors min-h-[120px] overflow-y-auto ${
          isDragOver ? 'border-primary/50 bg-primary/5' : 'border-transparent bg-muted/20'
        }`}>
          {cards.map(client => (
            <Card
              key={client.id}
              draggable={canEdit}
              onDragStart={() => handleDragStart(client.id)}
              onDragEnd={handleDragEnd}
              className={`hover:shadow-md transition-shadow ${
                canEdit ? 'cursor-grab active:cursor-grabbing' : ''
              } ${draggedClient === client.id ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-sm font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/hub/carteira/${client.id}`)}
                  >
                    {client.client_name || client.client_url}
                  </p>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/hub/carteira/${client.id}`)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-2" /> Ver detalhes
                      </DropdownMenuItem>
                      {canEdit && (
                        <DropdownMenuItem className="text-destructive" onClick={() => removeClientFromBoard(client.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover do board
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {client.nome_do_cs_atual && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{client.nome_do_cs_atual}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {client.plano_contratado && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{client.plano_contratado}</Badge>
                  )}
                  {client.valor_mensal && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <DollarSign className="h-2.5 w-2.5" /> R$ {client.valor_mensal}
                    </span>
                  )}
                  {client.status_financeiro && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        client.status_financeiro.toLowerCase().includes('inadimpl') ? 'border-destructive/30 text-destructive' : ''
                      }`}
                    >
                      {client.status_financeiro}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/hub/kanban')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {board && <div className="h-3 w-3 rounded-full" style={{ backgroundColor: board.color }} />}
              <h1 className="text-2xl font-bold text-foreground">{board?.title || 'Kanban'}</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {board?.description || 'Arraste clientes entre colunas para gerenciar o pipeline'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm w-[220px]"
            />
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => { setClientSearch(''); setAddClientOpen(true); }}>
              <UserPlus className="h-4 w-4 mr-1" /> Adicionar Cliente
            </Button>
          )}
          {canManageColumns && (
            <Button variant="outline" size="sm" onClick={openNewColumn}>
              <Plus className="h-4 w-4 mr-1" /> Coluna
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{boardClients.length} clientes neste board</span>
        <span>•</span>
        <span>{clientsByColumn['__unassigned']?.length || 0} sem coluna</span>
        {search && (
          <>
            <span>•</span>
            <span>{filteredClients.length} encontrados</span>
          </>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-h-[400px]">
          {columns.map(col => renderColumn(col.id, col.title, col.color, true))}
          {renderColumn('__unassigned', 'Sem Coluna', '#94a3b8', false)}
          {canManageColumns && (
            <div className="flex-shrink-0 w-[300px] flex items-center justify-center">
              <Button
                variant="ghost"
                className="h-full w-full border-2 border-dashed border-border/50 rounded-lg text-muted-foreground hover:border-primary/30 hover:text-primary min-h-[120px]"
                onClick={openNewColumn}
              >
                <Plus className="h-5 w-5 mr-2" /> Nova Coluna
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Column Dialog */}
      <Dialog open={colDialogOpen} onOpenChange={setColDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingColumn ? 'Editar Coluna' : 'Nova Coluna'}</DialogTitle>
            <DialogDescription>
              {editingColumn ? 'Atualize o título e a cor da coluna' : 'Crie uma nova coluna no Kanban'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={colTitle} onChange={e => setColTitle(e.target.value)} placeholder="Ex: Em Negociação" className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${colColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setColDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveColumn} disabled={savingCol || !colTitle.trim()}>
              {savingCol ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editingColumn ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Cliente ao Board</DialogTitle>
            <DialogDescription>Selecione clientes para incluir neste Kanban</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className={`max-h-[300px] overflow-y-auto space-y-1 ${addingClient ? 'opacity-60 pointer-events-none' : ''}`}>
              {availableClients.slice(0, 50).map(client => (
                <div key={client.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.client_name || client.client_url}</p>
                    {client.nome_do_cs_atual && (
                      <p className="text-xs text-muted-foreground">{client.nome_do_cs_atual}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={addingClient === client.id}
                    onClick={() => addClientToBoard(client.id)}
                  >
                    {addingClient === client.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                    Adicionar
                  </Button>
                </div>
              ))}
              {availableClients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {clientSearch ? 'Nenhum cliente encontrado' : 'Todos os clientes já estão neste board'}
                </p>
              )}
              {availableClients.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Mostrando 50 de {availableClients.length} — use a busca para filtrar
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
