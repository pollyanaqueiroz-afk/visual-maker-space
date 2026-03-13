import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const JIRA_DOMAIN = Deno.env.get('JIRA_DOMAIN');
    const JIRA_EMAIL = Deno.env.get('JIRA_EMAIL');
    const JIRA_API_TOKEN = Deno.env.get('JIRA_API_TOKEN');
    const JIRA_PROJECT_KEY = Deno.env.get('JIRA_PROJECT_KEY') || 'SUP';

    if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
      // Return mock data when Jira is not configured
      return handleMockRequest(req);
    }

    const authHeader = `Basic ${btoa(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`)}`;
    const baseUrl = `https://${JIRA_DOMAIN}.atlassian.net/rest/api/3`;

    const { action, ...params } = await req.json();

    switch (action) {
      case 'search': {
        const jql = params.client_name
          ? `project="${JIRA_PROJECT_KEY}" AND text~"${params.client_name}" ORDER BY created DESC`
          : `project="${JIRA_PROJECT_KEY}" ORDER BY created DESC`;

        const res = await fetch(
          `${baseUrl}/search?jql=${encodeURIComponent(jql)}&maxResults=${params.limit || 20}&fields=summary,status,created,updated,issuetype,priority,description,comment,components,customfield_10001`,
          { headers: { Authorization: authHeader, Accept: 'application/json' } },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(`Jira API error [${res.status}]: ${JSON.stringify(data)}`);

        const issues = (data.issues || []).map((issue: any) => ({
          id: issue.id,
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status?.name,
          statusCategory: issue.fields.status?.statusCategory?.key,
          priority: issue.fields.priority?.name,
          type: issue.fields.issuetype?.name,
          created: issue.fields.created,
          updated: issue.fields.updated,
          description: extractText(issue.fields.description),
          components: (issue.fields.components || []).map((c: any) => c.name),
          comments: (issue.fields.comment?.comments || []).map((c: any) => ({
            id: c.id,
            author: c.author?.displayName,
            body: extractText(c.body),
            created: c.created,
          })),
        }));

        return new Response(JSON.stringify({ issues, total: data.total }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        const body = {
          fields: {
            project: { key: JIRA_PROJECT_KEY },
            summary: params.summary,
            description: {
              type: 'doc', version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description || '' }] }],
            },
            issuetype: { name: params.issue_type || 'Bug' },
            ...(params.priority ? { priority: { name: params.priority } } : {}),
          },
        };

        const res = await fetch(`${baseUrl}/issue`, {
          method: 'POST',
          headers: { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Jira create error [${res.status}]: ${JSON.stringify(data)}`);

        return new Response(JSON.stringify({ key: data.key, id: data.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'comment': {
        const body = {
          body: {
            type: 'doc', version: 1,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: params.comment }] }],
          },
        };

        const res = await fetch(`${baseUrl}/issue/${params.issue_key}/comment`, {
          method: 'POST',
          headers: { Authorization: authHeader, Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Jira comment error [${res.status}]: ${JSON.stringify(data)}`);

        return new Response(JSON.stringify({ id: data.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('jira-proxy error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractText(doc: any): string {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  if (doc.type === 'text') return doc.text || '';
  if (doc.content) return doc.content.map(extractText).join('');
  return '';
}

// Mock handler for when Jira credentials aren't configured
async function handleMockRequest(req: Request) {
  const { action, ...params } = await req.json();

  if (action === 'search') {
    const mockIssues = generateMockTickets(params.client_name);
    return new Response(JSON.stringify({ issues: mockIssues, total: mockIssues.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'create') {
    return new Response(JSON.stringify({ key: `SUP-${Math.floor(Math.random() * 9000) + 1000}`, id: crypto.randomUUID() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (action === 'comment') {
    return new Response(JSON.stringify({ id: crypto.randomUUID() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generateMockTickets(clientName?: string) {
  const statuses = ['To Do', 'In Progress', 'In Sprint', 'Done', 'Waiting for Customer'];
  const categories = ['new', 'indeterminate', 'indeterminate', 'done', 'indeterminate'];
  const types = ['Bug', 'Improvement', 'Task', 'Bug', 'Improvement'];
  const priorities = ['Critical', 'High', 'Medium', 'Low', 'Medium'];
  const components = ['Certificados', 'Player de Vídeo', 'Gamificação', 'Checkout', 'API', 'Dashboard'];
  const summaries = [
    'Erro ao gerar certificado com caracteres especiais',
    'Player de vídeo trava em dispositivos iOS 17',
    'Implementar filtro avançado na listagem de alunos',
    'API de relatórios retornando dados incorretos',
    'Erro 500 ao acessar dashboard de engajamento',
    'Adicionar suporte a SCORM 2004 4th Edition',
    'Timeout na exportação de relatórios com +5k alunos',
    'Melhorar performance do carregamento de trilhas',
    'Bug no cálculo de progresso de trilhas compostas',
    'Solicitar dark mode no painel administrativo',
    'Integração com Google Analytics 4 não registra eventos',
    'Erro no envio de notificação push para Android',
  ];

  const count = 8 + Math.floor(Math.random() * 5);
  return Array.from({ length: count }, (_, i) => {
    const statusIdx = Math.floor(Math.random() * statuses.length);
    const daysAgo = Math.floor(Math.random() * 90);
    const created = new Date(Date.now() - daysAgo * 86400000).toISOString();
    const updated = new Date(Date.now() - Math.floor(Math.random() * daysAgo) * 86400000).toISOString();

    return {
      id: crypto.randomUUID(),
      key: `SUP-${1000 + i}`,
      summary: summaries[i % summaries.length],
      status: statuses[statusIdx],
      statusCategory: categories[statusIdx],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      type: types[Math.floor(Math.random() * types.length)],
      created,
      updated,
      description: `Descrição detalhada do ticket${clientName ? ` para ${clientName}` : ''}. O problema foi reportado pela equipe de suporte após múltiplos relatos de clientes.`,
      components: [components[Math.floor(Math.random() * components.length)]],
      comments: Array.from({ length: Math.floor(Math.random() * 3) }, (_, j) => ({
        id: crypto.randomUUID(),
        author: ['Ana Silva', 'Carlos Dev', 'Maria CS'][j % 3],
        body: ['Investigando o problema...', 'Fix implementado, aguardando deploy.', 'Cliente confirmou que o problema persiste.'][j % 3],
        created: new Date(Date.now() - (daysAgo - j - 1) * 86400000).toISOString(),
      })),
    };
  });
}
