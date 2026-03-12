import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Copy, Check, Globe, Send, RefreshCw, List } from 'lucide-react';
import { toast } from 'sonner';

const API_TOKEN = 'WxYVWSfUJ3kslYCkqlyo5DMdsQHzBA1guEvgAlF86T4CiMqPmPbrVEemby5udFaq';
const BASE_URL = `https://aqmbaycbwljiohdjputq.supabase.co/functions/v1`;

function MaskedToken() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(API_TOKEN);
    setCopied(true);
    toast.success('Token copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-4 py-3 font-mono text-sm">
      <span className="flex-1 break-all select-all">
        {visible ? API_TOKEN : '••••••••••••••••••••••••••••••••••••••••••••••••'}
      </span>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setVisible(!visible)}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-x-auto text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function FieldsTable({ fields }: { fields: { name: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Campo</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tipo</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Obrigatório</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.name} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
              <td className="px-4 py-2 font-mono text-xs">{f.name}</td>
              <td className="px-4 py-2"><Badge variant="outline" className="text-xs">{f.type}</Badge></td>
              <td className="px-4 py-2">{f.required ? <Badge className="bg-red-500/10 text-red-600 border-red-200 text-xs">Sim</Badge> : <span className="text-muted-foreground text-xs">Não</span>}</td>
              <td className="px-4 py-2 text-muted-foreground">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const clientFields = [
  { name: 'id_curseduca', type: 'text', required: true, description: 'Identificador único do cliente no Curseduca' },
  { name: 'nome', type: 'text', required: false, description: 'Nome do cliente' },
  { name: 'email', type: 'text', required: false, description: 'E-mail principal' },
  { name: 'email_alternativo', type: 'text', required: false, description: 'E-mail secundário' },
  { name: 'telefone_alternativo', type: 'text', required: false, description: 'Telefone de contato' },
  { name: 'data_criacao', type: 'timestamp', required: false, description: 'Data de criação do cliente' },
  { name: 'status_financeiro', type: 'text', required: false, description: 'Status financeiro atual' },
  { name: 'status_curseduca', type: 'text', required: false, description: 'Status na plataforma Curseduca' },
  { name: 'plano', type: 'text', required: false, description: 'Plano contratado' },
  { name: 'cs_atual', type: 'text', required: false, description: 'CS responsável atual' },
  { name: 'cs_anterior', type: 'text', required: false, description: 'CS responsável anterior' },
  { name: 'indice_fidelidade', type: 'integer', required: false, description: 'Índice de fidelização (1-5)' },
];

const financeiroFields = [
  { name: 'id_curseduca', type: 'text', required: true, description: 'Identificador único do cliente no Curseduca' },
  { name: 'nome', type: 'text', required: false, description: 'Nome do cliente' },
  { name: 'email', type: 'text', required: false, description: 'E-mail do cliente' },
  { name: 'codigo_assinatura_meio_pagamento', type: 'text', required: false, description: 'Código da assinatura no meio de pagamento' },
  { name: 'codigo_cliente_meio_pagamento', type: 'text', required: false, description: 'Código do cliente no meio de pagamento' },
  { name: 'plano', type: 'text', required: false, description: 'Plano contratado' },
  { name: 'meio_de_pagamento', type: 'text', required: false, description: 'Meio de pagamento (ex: cartão, boleto)' },
  { name: 'meio_pagamento', type: 'text', required: false, description: 'Meio de pagamento (campo alternativo)' },
  { name: 'valor_contratado', type: 'numeric', required: false, description: 'Valor contratado' },
  { name: 'numero_parcelas_pagas', type: 'integer', required: false, description: 'Parcelas pagas' },
  { name: 'numero_parcelas_inadimplentes', type: 'integer', required: false, description: 'Parcelas inadimplentes' },
  { name: 'numero_parcelas_contrato', type: 'integer', required: false, description: 'Total de parcelas do contrato' },
  { name: 'recorrencia_pagamento', type: 'text', required: false, description: 'Recorrência (mensal, anual, etc)' },
  { name: 'is_plano', type: 'boolean', required: false, description: 'Possui plano?' },
  { name: 'tipo_plano', type: 'text', required: false, description: 'Tipo do plano' },
  { name: 'is_upsell', type: 'boolean', required: false, description: 'É upsell?' },
  { name: 'tipo_upsell', type: 'text', required: false, description: 'Tipo de upsell' },
  { name: 'status', type: 'text', required: false, description: 'Status (ativo, inativo, etc)' },
  { name: 'vigencia_assinatura', type: 'text', required: false, description: 'Vigência da assinatura' },
  { name: 'data_criacao', type: 'timestamp', required: false, description: 'Data de criação do registro' },
  { name: 'processed_at', type: 'timestamp', required: false, description: 'Data de processamento' },
];

const ENTITIES_LIST = [
  'clients', 'meetings', 'briefing_requests', 'briefing_images', 'briefing_adjustments',
  'briefing_deliveries', 'briefing_reviews', 'brand_assets', 'app_clientes', 'app_fases',
  'app_checklist_items', 'app_conversas', 'app_formulario', 'app_prerequisitos', 'app_assets',
  'app_notificacoes', 'kanban_boards', 'kanban_columns', 'kanban_card_positions',
  'carteirizacao_planos', 'carteirizacao_etapas', 'carteirizacao_cs', 'carteirizacao_ferias',
  'client_interactions', 'client_field_definitions', 'meeting_csat', 'meeting_reschedules',
  'scorm_packages', 'profiles', 'cliente_financeiro',
];

export default function ApiDocsPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documentação de APIs</h1>
        <p className="text-muted-foreground mt-1">Endpoints disponíveis para integração externa com o Hub de Operações.</p>
      </div>

      {/* Auth Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Autenticação
          </CardTitle>
          <CardDescription>Todas as rotas utilizam autenticação via Basic Auth no header Authorization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Token de autenticação:</p>
          <MaskedToken />
          <div className="text-sm text-muted-foreground mt-2">
            <p>Envie no header de todas as requisições:</p>
            <CodeBlock code={`Authorization: Basic ${API_TOKEN.slice(0, 12)}...`} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="list-data" className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="list-data" className="gap-1.5"><List className="h-3.5 w-3.5" /> list-data-api</TabsTrigger>
          <TabsTrigger value="list-clients" className="gap-1.5"><List className="h-3.5 w-3.5" /> list-clients-api</TabsTrigger>
          <TabsTrigger value="manage-data" className="gap-1.5"><Send className="h-3.5 w-3.5" /> manage-data-api</TabsTrigger>
        </TabsList>

        {/* ─── list-data-api ─── */}
        <TabsContent value="list-data" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">GET</Badge>
                <CardTitle className="text-base font-mono">/functions/v1/list-data-api</CardTitle>
              </div>
              <CardDescription>API genérica para consultar dados de diversas entidades. Suporta paginação, busca textual e filtros dinâmicos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Listar entidades disponíveis</h4>
                <CodeBlock code={`curl '${BASE_URL}/list-data-api' \\
  -H 'Authorization: Basic ${API_TOKEN}'`} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Consultar dados de uma entidade</h4>
                <CodeBlock code={`curl '${BASE_URL}/list-data-api?entity=clients&page=1&per_page=50&search=empresa' \\
  -H 'Authorization: Basic ${API_TOKEN}'`} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Parâmetros de query</h4>
                <FieldsTable fields={[
                  { name: 'entity', type: 'text', description: 'Nome da entidade a consultar (omitir para listar todas)' },
                  { name: 'page', type: 'integer', description: 'Página (default: 1)' },
                  { name: 'per_page', type: 'integer', description: 'Itens por página (default: 50, máx: 1000)' },
                  { name: 'search', type: 'text', description: 'Busca textual nos campos pesquisáveis da entidade' },
                  { name: '[campo]', type: 'any', description: 'Filtro exato por qualquer coluna da tabela (ex: cs_atual=joao@email.com)' },
                ]} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Resposta</h4>
                <CodeBlock code={`{
  "entity": "clients",
  "data": [ { "id": "uuid...", "nome": "...", ... } ],
  "total": 350,
  "page": 1,
  "per_page": 50,
  "total_pages": 7
}`} language="json" />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Entidades disponíveis ({ENTITIES_LIST.length})</h4>
                <div className="flex flex-wrap gap-1.5">
                  {ENTITIES_LIST.map(e => (
                    <Badge key={e} variant="outline" className="font-mono text-xs">{e}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── list-clients-api ─── */}
        <TabsContent value="list-clients" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">GET</Badge>
                <CardTitle className="text-base font-mono">/functions/v1/list-clients-api</CardTitle>
              </div>
              <CardDescription>Endpoint dedicado para listar clientes com filtro por CS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Exemplo</h4>
                <CodeBlock code={`curl '${BASE_URL}/list-clients-api?page=1&per_page=50&search=empresa&cs_atual=joao@email.com' \\
  -H 'Authorization: Basic ${API_TOKEN}'`} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Parâmetros</h4>
                <FieldsTable fields={[
                  { name: 'page', type: 'integer', description: 'Página (default: 1)' },
                  { name: 'per_page', type: 'integer', description: 'Itens por página (default: 50, máx: 1000)' },
                  { name: 'search', type: 'text', description: 'Busca por nome ou id_curseduca' },
                  { name: 'cs_atual', type: 'text', description: 'Filtrar por CS responsável' },
                ]} />
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Resposta</h4>
                <CodeBlock code={`{
  "data": [ { "id": "uuid...", "nome": "...", ... } ],
  "total": 350,
  "page": 1,
  "per_page": 50,
  "total_pages": 7
}`} language="json" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── manage-data-api ─── */}
        <TabsContent value="manage-data" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">manage-data-api</CardTitle>
              <CardDescription>
                Criar e atualizar registros nas entidades <code className="font-mono text-xs bg-muted px-1 rounded">clients</code> e <code className="font-mono text-xs bg-muted px-1 rounded">cliente_financeiro</code>.
                Use o parâmetro <code className="font-mono text-xs bg-muted px-1 rounded">?entity=</code> para escolher a entidade (default: clients).
              </CardDescription>
            </CardHeader>
          </Card>

          {/* POST clients */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-600 border-green-200">POST</Badge>
                <CardTitle className="text-base font-mono">/functions/v1/manage-data-api?entity=clients</CardTitle>
              </div>
              <CardDescription>Criar um novo cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Exemplo</h4>
                <CodeBlock code={`curl -X POST '${BASE_URL}/manage-data-api?entity=clients' \\
  -H 'Authorization: Basic ${API_TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "id_curseduca": "12345",
    "nome": "Empresa Teste",
    "email": "contato@teste.com",
    "plano": "Premium",
    "cs_atual": "joao@curseduca.com"
  }'`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Campos aceitos (clients)</h4>
                <FieldsTable fields={clientFields} />
              </div>
            </CardContent>
          </Card>

          {/* POST cliente_financeiro */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-500/10 text-green-600 border-green-200">POST</Badge>
                <CardTitle className="text-base font-mono">/functions/v1/manage-data-api?entity=cliente_financeiro</CardTitle>
              </div>
              <CardDescription>Criar um novo registro financeiro.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Exemplo</h4>
                <CodeBlock code={`curl -X POST '${BASE_URL}/manage-data-api?entity=cliente_financeiro' \\
  -H 'Authorization: Basic ${API_TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "id_curseduca": "12345",
    "nome": "Empresa Teste",
    "plano": "Premium",
    "meio_de_pagamento": "cartao",
    "valor_contratado": 497,
    "status": "ativo",
    "is_plano": true,
    "tipo_plano": "anual"
  }'`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Campos aceitos (cliente_financeiro)</h4>
                <FieldsTable fields={financeiroFields} />
              </div>
            </CardContent>
          </Card>

          {/* PATCH clients */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">PATCH</Badge>
                <CardTitle className="text-base font-mono">/manage-data-api?entity=clients&id_curseduca=12345</CardTitle>
              </div>
              <CardDescription>Atualizar um cliente pelo id_curseduca.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Exemplo</h4>
                <CodeBlock code={`curl -X PATCH '${BASE_URL}/manage-data-api?entity=clients&id_curseduca=12345' \\
  -H 'Authorization: Basic ${API_TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{ "status_curseduca": "inativo", "indice_fidelidade": 3 }'`} />
              </div>
            </CardContent>
          </Card>

          {/* PATCH cliente_financeiro */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-200">PATCH</Badge>
                <CardTitle className="text-base font-mono text-wrap break-all">/manage-data-api?entity=cliente_financeiro&id_curseduca=12345&codigo_assinatura_meio_pagamento=SUB_001</CardTitle>
              </div>
              <CardDescription>
                Atualizar um registro financeiro pela chave composta: <code className="font-mono text-xs bg-muted px-1 rounded">id_curseduca</code> + <code className="font-mono text-xs bg-muted px-1 rounded">codigo_assinatura_meio_pagamento</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <h4 className="text-sm font-semibold mb-2">Parâmetros de query</h4>
                <FieldsTable fields={[
                  { name: 'entity', type: 'text', required: true, description: 'cliente_financeiro' },
                  { name: 'id_curseduca', type: 'text', required: true, description: 'Identificador do cliente' },
                  { name: 'codigo_assinatura_meio_pagamento', type: 'text', required: false, description: 'Código da assinatura (filtra registro específico)' },
                ]} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Exemplo</h4>
                <CodeBlock code={`curl -X PATCH '${BASE_URL}/manage-data-api?entity=cliente_financeiro&id_curseduca=12345&codigo_assinatura_meio_pagamento=SUB_001' \\
  -H 'Authorization: Basic ${API_TOKEN}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "status": "inadimplente",
    "numero_parcelas_inadimplentes": 2,
    "valor_contratado": 497
  }'`} />
              </div>
            </CardContent>
          </Card>

          {/* Erros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Erros possíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldsTable fields={[
                { name: '400', type: 'error', description: 'id_curseduca ausente, entity inválida ou nenhum campo válido' },
                { name: '401', type: 'error', description: 'Token de autenticação inválido' },
                { name: '404', type: 'error', description: 'Registro não encontrado com a(s) chave(s) informada(s)' },
                { name: '405', type: 'error', description: 'Método HTTP não permitido (use POST ou PATCH)' },
                { name: '500', type: 'error', description: 'Erro interno do servidor' },
              ]} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
