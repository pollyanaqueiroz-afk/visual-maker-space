import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ClientInteractionHistory from '@/components/carteira/ClientInteractionHistory';
import ClientCsatSection from '@/components/carteira/ClientCsatSection';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ArrowLeft, Save, Loader2, Edit2, Check, X, Plus, User, Globe, DollarSign,
  Phone, Mail, Calendar, BarChart3, Building2, Shield, Settings, Trash2, MessageSquare,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ClientRecord {
  [key: string]: any;
}

// Field groups for CRM layout
const FIELD_GROUPS = [
  {
    title: 'Identificação',
    icon: User,
    fields: [
      { key: 'id_curseduca', label: 'ID Curseduca' },
      { key: 'client_url', label: 'URL do Cliente' },
      { key: 'client_name', label: 'Nome do Cliente' },
      { key: 'nome_antigo', label: 'Nome Antigo' },
      { key: 'nome_da_plataforma', label: 'Nome da Plataforma' },
    ],
  },
  {
    title: 'Contato',
    icon: Mail,
    fields: [
      { key: 'email_do_cliente', label: 'E-mail do Cliente' },
      { key: 'email_do_cliente_2', label: 'E-mail do Cliente 2' },
      { key: 'telefone_do_cliente', label: 'Telefone do Cliente' },
      { key: 'portal_do_cliente', label: 'Portal do Cliente' },
    ],
  },
  {
    title: 'Financeiro',
    icon: DollarSign,
    fields: [
      { key: 'status_financeiro', label: 'Status Financeiro' },
      { key: 'forma_de_pagamento', label: 'Forma de Pagamento' },
      { key: 'valor_mensal', label: 'Valor Mensal' },
      { key: 'valor_total_devido', label: 'Valor Total Devido' },
      { key: 'data_da_primeira_parcela_vencida', label: 'Data da Primeira Parcela Vencida' },
      { key: 'desconto_concedido', label: 'Desconto Concedido' },
    ],
  },
  {
    title: 'Plano & Contrato',
    icon: Building2,
    fields: [
      { key: 'plano_contratado', label: 'Plano Contratado' },
      { key: 'plano_detalhado', label: 'Plano Detalhado' },
      { key: 'data_do_fechamento_do_contrato', label: 'Data do Fechamento do Contrato' },
      { key: 'metrica_de_sucesso_acordada_na_venda', label: 'Métrica de Sucesso' },
    ],
  },
  {
    title: 'Equipe CS',
    icon: Shield,
    fields: [
      { key: 'tipo_de_cs', label: 'Tipo de CS' },
      { key: 'nome_do_cs_atual', label: 'Nome do CS Atual' },
      { key: 'email_do_cs_atual', label: 'E-mail do CS Atual' },
      { key: 'e_mail_do_cs_atual', label: 'E-mail do CS Atual (alt)' },
      { key: 'email_do_cs_antigo', label: 'E-mail do CS Antigo' },
      { key: 'e_mail_do_cs_antigo', label: 'E-mail do CS Antigo (alt)' },
    ],
  },
  {
    title: 'Closer / Vendas',
    icon: BarChart3,
    fields: [
      { key: 'nome_do_closer', label: 'Nome do Closer' },
      { key: 'email_do_closer', label: 'E-mail do Closer' },
      { key: 'e_mail_do_closer', label: 'E-mail do Closer (alt)' },
    ],
  },
  {
    title: 'Uso da Plataforma',
    icon: Globe,
    fields: [
      { key: 'banda_contratada', label: 'Banda Contratada' },
      { key: 'banda_utilizada', label: 'Banda Utilizada' },
      { key: 'armazenamento_contratado', label: 'Armazenamento Contratado' },
      { key: 'armazenamento_utilizado', label: 'Armazenamento Utilizado' },
      { key: 'token_de_ia_contratado', label: 'Token de IA Contratado' },
      { key: 'token_de_ia_utilizado', label: 'Token de IA Utilizado' },
      { key: 'certificado_mec_contratado', label: 'Certificado MEC Contratado' },
      { key: 'certificado_mec_utilizado', label: 'Certificado MEC Utilizado' },
      { key: 'data_do_ultimo_login', label: 'Data do Último Login' },
      { key: 'dias_desde_o_ultimo_login', label: 'Dias Desde o Último Login' },
      { key: 'tempo_medio_de_uso_em_min', label: 'Tempo Médio de Uso (min)' },
      { key: 'membros_do_mes_atual', label: 'Membros do Mês Atual' },
      { key: 'variacao_de_quantidade_de_membros_por_mes', label: 'Variação de Membros/Mês' },
    ],
  },
  {
    title: 'Marcos de Compra',
    icon: Calendar,
    fields: [
      { key: 'data_da_primeira_compra', label: 'Data da Primeira Compra' },
      { key: 'data_da_10_compra', label: 'Data da 10ª Compra' },
      { key: 'data_da_50_compra', label: 'Data da 50ª Compra' },
      { key: 'data_da_100_compra', label: 'Data da 100ª Compra' },
      { key: 'data_da_200_compra', label: 'Data da 200ª Compra' },
    ],
  },
  {
    title: 'Marcos de Conteúdo',
    icon: Calendar,
    fields: [
      { key: 'data_do_primeiro_conteudo_finalizado', label: '1º Conteúdo Finalizado' },
      { key: 'data_do_10_conteudo_finalizado', label: '10º Conteúdo Finalizado' },
      { key: 'data_do_50_conteudo_finalizado', label: '50º Conteúdo Finalizado' },
      { key: 'data_do_100_conteudo_finalizado', label: '100º Conteúdo Finalizado' },
      { key: 'data_do_200_conteudo_finalizado', label: '200º Conteúdo Finalizado' },
    ],
  },
  {
    title: 'Outros',
    icon: Settings,
    fields: [
      { key: 'etapa_antiga_sensedata', label: 'Etapa Antiga Sensedata' },
      { key: 'origem_do_dado', label: 'Origem do Dado' },
      { key: 'data_do_dado', label: 'Data do Dado' },
      { key: 'data_do_processamento_do_dado', label: 'Data do Processamento' },
    ],
  },
];

const KNOWN_KEYS = new Set(
  FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key))
    .concat(['id', 'created_at', 'updated_at'])
);

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('carteira.edit');

  const [client, setClient] = useState<ClientRecord | null>(null);
  const [editData, setEditData] = useState<ClientRecord>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [addingField, setAddingField] = useState(false);

  // All columns from DB (to detect custom fields)
  const [allColumns, setAllColumns] = useState<{ column_name: string; data_type: string }[]>([]);

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await (supabase.from('clients' as any).select('*').eq('id', clientId).single() as any);
    if (error) {
      console.error(error);
      toast.error('Erro ao carregar cliente');
      navigate('/hub/carteira');
      return;
    }
    setClient(data);
    setEditData(data);
    setLoading(false);
  }, [clientId, navigate]);

  const loadColumns = useCallback(async () => {
    const { data } = await supabase.rpc('get_client_columns');
    if (data) setAllColumns(data);
  }, []);

  useEffect(() => { loadClient(); loadColumns(); }, [loadClient, loadColumns]);

  // Custom fields = columns not in KNOWN_KEYS
  const customFields = useMemo(() =>
    allColumns
      .filter(c => !KNOWN_KEYS.has(c.column_name))
      .map(c => ({ key: c.column_name, label: c.column_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), type: c.data_type })),
    [allColumns]
  );

  const handleSave = async () => {
    if (!clientId) return;
    setSaving(true);
    const updates: Record<string, any> = {};
    for (const key of Object.keys(editData)) {
      if (key === 'id' || key === 'created_at' || key === 'updated_at') continue;
      if (editData[key] !== client?.[key]) {
        updates[key] = editData[key];
      }
    }
    if (Object.keys(updates).length === 0) {
      toast.info('Nenhuma alteração detectada');
      setEditing(false);
      setSaving(false);
      return;
    }
    const { error } = await (supabase.from('clients' as any).update(updates).eq('id', clientId) as any);
    if (error) {
      console.error(error);
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Cliente atualizado!');
      setClient({ ...client, ...updates });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAddField = async () => {
    const slug = newFieldName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!slug || slug.length < 2) {
      toast.error('Nome do campo inválido');
      return;
    }
    setAddingField(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-client-columns', {
        body: { action: 'create', columns: [{ name: slug, type: newFieldType }] },
      });
      if (error) throw error;
      const result = data?.results?.[0];
      if (result?.success) {
        toast.success(`Campo "${slug}" adicionado!`);
        setNewFieldName('');
        setAddFieldOpen(false);
        await loadColumns();
        // Also reload client to get new column
        await loadClient();
      } else {
        toast.error(result?.error || 'Erro ao criar campo');
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setAddingField(false);
  };

  const handleCancel = () => {
    setEditData(client || {});
    setEditing(false);
  };

  const updateField = (key: string, value: string) => {
    setEditData(prev => ({ ...prev, [key]: value || null }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) return null;

  const renderField = (key: string, label: string) => {
    const value = editing ? (editData[key] ?? '') : (client[key] ?? '');
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
        {editing ? (
          <Input
            value={value}
            onChange={e => updateField(key, e.target.value)}
            className="h-9 text-sm"
            placeholder="—"
          />
        ) : (
          <p className="text-sm text-foreground min-h-[36px] flex items-center px-3 py-2 rounded-md bg-muted/30 border border-transparent">
            {value || <span className="text-muted-foreground">—</span>}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            if (editing && !confirm('Você tem alterações não salvas. Deseja sair mesmo assim?')) return;
            navigate('/hub/carteira');
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {client.client_name || client.client_url || 'Cliente'}
            </h1>
            <p className="text-sm text-muted-foreground">
              ID: {client.id_curseduca || client.id?.slice(0, 8)}
              {client.plano_contratado && (
                <Badge variant="secondary" className="ml-2 text-[10px]">{client.plano_contratado}</Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </>
          ) : canEdit ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setAddFieldOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Campo
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Editar
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">
              {client.valor_mensal ? `R$ ${client.valor_mensal}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Valor Mensal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Building2 className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-sm font-semibold text-foreground truncate">{client.plano_contratado || '—'}</p>
            <p className="text-[10px] text-muted-foreground">Plano</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Shield className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-sm font-semibold text-foreground truncate">{client.nome_do_cs_atual || '—'}</p>
            <p className="text-[10px] text-muted-foreground">CS Responsável</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Calendar className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-sm font-semibold text-foreground truncate">{client.dias_desde_o_ultimo_login || '—'}</p>
            <p className="text-[10px] text-muted-foreground">Dias Sem Login</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Dados / CSAT */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList>
          <TabsTrigger value="dados" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Dados
          </TabsTrigger>
          <TabsTrigger value="csat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> CSAT
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="space-y-6 mt-4">
          {/* Field Groups */}
          {FIELD_GROUPS.map(group => {
            const hasData = group.fields.some(f => client[f.key] != null && client[f.key] !== '');
            return (
              <Card key={group.title}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <group.icon className="h-4 w-4 text-primary" />
                    {group.title}
                    {!hasData && !editing && (
                      <Badge variant="outline" className="text-[10px] ml-auto">Sem dados</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.fields.map(f => renderField(f.key, f.label))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Campos Personalizados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customFields.map(f => renderField(f.key, f.label))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Interaction History */}
          {clientId && <ClientInteractionHistory clientId={clientId} />}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pb-4">
            <span>Criado em: {client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : '—'}</span>
            <span>Atualizado em: {client.updated_at ? new Date(client.updated_at).toLocaleDateString('pt-BR') : '—'}</span>
          </div>
        </TabsContent>

        <TabsContent value="csat" className="mt-4">
          <ClientCsatSection
            clientUrl={client.client_url}
            clientEmail={client.email_do_cliente}
            clientEmail2={client.email_do_cliente_2}
          />
        </TabsContent>
      </Tabs>

      {/* Add Field Dialog */}
      <Dialog open={addFieldOpen} onOpenChange={setAddFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Campo Personalizado</DialogTitle>
            <DialogDescription>Crie um novo campo para todos os clientes</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Campo</Label>
              <Input
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                placeholder="Ex: segmento_mercado"
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Use letras minúsculas, números e underscores. Ex: nota_nps
              </p>
            </div>
            <div className="space-y-2">
              <Label>Tipo do Campo</Label>
              <Select value={newFieldType} onValueChange={setNewFieldType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="integer">Número Inteiro</SelectItem>
                  <SelectItem value="numeric">Número Decimal</SelectItem>
                  <SelectItem value="boolean">Sim/Não</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddFieldOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddField} disabled={addingField || !newFieldName.trim()}>
              {addingField ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Criar Campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
