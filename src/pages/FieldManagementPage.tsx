import { useState } from 'react';
import { useFieldDefinitions, type FieldDefinition } from '@/hooks/useFieldDefinitions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Plus, GripVertical, Eye, EyeOff, Pencil, Database, ArrowUp, ArrowDown,
} from 'lucide-react';

const FIELD_TYPES = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'moeda', label: 'Moeda (R$)' },
  { value: 'data', label: 'Data' },
  { value: 'email', label: 'E-mail' },
  { value: 'url', label: 'URL' },
  { value: 'enum', label: 'Lista (Enum)' },
  { value: 'booleano', label: 'Booleano' },
];

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/^(\d)/, 'c_$1')
    .slice(0, 63);
}

interface CreateFieldForm {
  label: string;
  db_key: string;
  field_type: string;
  enum_options: string;
  is_required: boolean;
}

export default function FieldManagementPage() {
  const { fields, isLoading, createField, updateField, reorderFields } = useFieldDefinitions();
  const [createOpen, setCreateOpen] = useState(false);
  const [editField, setEditField] = useState<FieldDefinition | null>(null);
  const [form, setForm] = useState<CreateFieldForm>({
    label: '', db_key: '', field_type: 'texto', enum_options: '', is_required: false,
  });

  const handleLabelChange = (label: string) => {
    setForm(prev => ({
      ...prev,
      label,
      db_key: prev.db_key === toSnakeCase(prev.label) ? toSnakeCase(label) : prev.db_key,
    }));
  };

  const handleCreate = async () => {
    if (!form.label.trim() || !form.db_key.trim()) {
      toast.error('Nome e chave técnica são obrigatórios');
      return;
    }
    if (fields.some(f => f.db_key === form.db_key)) {
      toast.error('Já existe um campo com essa chave técnica');
      return;
    }
    try {
      await createField.mutateAsync({
        label: form.label.trim(),
        db_key: form.db_key.trim(),
        field_type: form.field_type,
        enum_options: form.field_type === 'enum' 
          ? form.enum_options.split(',').map(o => o.trim()).filter(Boolean)
          : [],
        is_required: form.is_required,
        is_hidden: false,
        sort_order: fields.length,
      });
      toast.success('Campo criado com sucesso');
      setCreateOpen(false);
      setForm({ label: '', db_key: '', field_type: 'texto', enum_options: '', is_required: false });
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleToggleVisibility = async (field: FieldDefinition) => {
    try {
      await updateField.mutateAsync({ id: field.id, is_hidden: !field.is_hidden });
      toast.success(field.is_hidden ? 'Campo visível' : 'Campo oculto');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newFields.length) return;
    [newFields[index], newFields[targetIdx]] = [newFields[targetIdx], newFields[index]];
    try {
      await reorderFields.mutateAsync(newFields.map(f => f.id));
    } catch (err: any) {
      toast.error('Erro ao reordenar');
    }
  };

  const handleSaveEdit = async () => {
    if (!editField) return;
    try {
      await updateField.mutateAsync({
        id: editField.id,
        label: editField.label,
        enum_options: editField.enum_options,
        is_required: editField.is_required,
      });
      toast.success('Campo atualizado');
      setEditField(null);
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-6 w-6" />
            Campos da Carteira
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os campos dinâmicos exibidos na Carteira Geral — {fields.length} campos cadastrados
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Campo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Ordem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Chave Técnica</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Obrigatório</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, idx) => (
                <TableRow key={field.id} className={field.is_hidden ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => handleMove(idx, 'up')}>
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5" disabled={idx === fields.length - 1} onClick={() => handleMove(idx, 'down')}>
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{field.db_key}</code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                    </Badge>
                    {field.field_type === 'enum' && field.enum_options.length > 0 && (
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ({field.enum_options.length} opções)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {field.is_required && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={field.is_hidden ? 'secondary' : 'default'} className="text-[10px]">
                      {field.is_hidden ? 'Oculto' : 'Visível'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditField({ ...field })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleVisibility(field)}>
                        {field.is_hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Campo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do campo</Label>
              <Input value={form.label} onChange={e => handleLabelChange(e.target.value)} placeholder="Ex: Receita Anual" />
            </div>
            <div className="space-y-1.5">
              <Label>Chave técnica (snake_case)</Label>
              <Input value={form.db_key} onChange={e => setForm(p => ({ ...p, db_key: toSnakeCase(e.target.value) }))} placeholder="receita_anual" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de dado</Label>
              <Select value={form.field_type} onValueChange={v => setForm(p => ({ ...p, field_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.field_type === 'enum' && (
              <div className="space-y-1.5">
                <Label>Opções (separadas por vírgula)</Label>
                <Input value={form.enum_options} onChange={e => setForm(p => ({ ...p, enum_options: e.target.value }))} placeholder="Opção 1, Opção 2, Opção 3" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.is_required} onCheckedChange={v => setForm(p => ({ ...p, is_required: v }))} />
              <Label>Campo obrigatório</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createField.isPending}>
              {createField.isPending ? 'Criando...' : 'Criar Campo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editField} onOpenChange={(v) => !v && setEditField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Campo</DialogTitle>
          </DialogHeader>
          {editField && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do campo</Label>
                <Input value={editField.label} onChange={e => setEditField(p => p ? { ...p, label: e.target.value } : null)} />
              </div>
              <div className="space-y-1.5">
                <Label>Chave técnica</Label>
                <Input value={editField.db_key} disabled className="font-mono text-sm opacity-60" />
                <p className="text-[10px] text-muted-foreground">A chave técnica não pode ser alterada após criação</p>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Badge variant="outline">{FIELD_TYPES.find(t => t.value === editField.field_type)?.label}</Badge>
              </div>
              {editField.field_type === 'enum' && (
                <div className="space-y-1.5">
                  <Label>Opções do Enum</Label>
                  <Input
                    value={editField.enum_options.join(', ')}
                    onChange={e => setEditField(p => p ? { ...p, enum_options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) } : null)}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={editField.is_required} onCheckedChange={v => setEditField(p => p ? { ...p, is_required: v } : null)} />
                <Label>Campo obrigatório</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditField(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateField.isPending}>
              {updateField.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
