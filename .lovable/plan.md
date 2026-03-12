
# Documentação do Projeto — Hub Curseduca

---

## 1. Bypass temporário de login para desenvolvimento

### O que foi feito

Botão "Dev Access" visível apenas em ambiente de desenvolvimento (preview/localhost) na tela de Login. Ao clicar, o usuário é redirecionado diretamente para `/hub` sem autenticação real.

### Como funciona

1. **`src/pages/Login.tsx`** — Botão condicional que aparece apenas quando `window.location.hostname` inclui `localhost`, `127.0.0.1` ou `lovable.app` (preview).
2. **`src/hooks/useAuth.tsx`** — Suporte a flag `sessionStorage.setItem('dev_bypass', 'true')` que o hook reconhece como "usuário logado" temporariamente.
3. **`src/components/ProtectedRoute.tsx`** e **`src/pages/HubPage.tsx`** — Já usam `useAuth()`, funcionam automaticamente com o bypass.

### Reversão

Basta apagar as linhas do bypass — um único prompt resolve.

### Riscos

- Zero impacto em produção (condicional por hostname)
- Não altera tabelas, RLS ou edge functions
- Permissões podem ficar limitadas (sem role real no banco), mas navegação funcionará

---

## 2. Módulo de Gestão de Migração

### Visão Geral

Módulo completo para gerenciar a transição de clientes de outras plataformas (Hotmart, Academi, Kiwify, etc.) para a Curseduca. Inclui Kanban interno, formulário público para o cliente, portal de acompanhamento e analytics.

### Tabelas Criadas

| Tabela | Descrição |
|---|---|
| `migration_projects` | Projeto de migração por cliente (nome, email, URL, plataforma de origem, status, serviços contratados, portal_token, CS responsável, observações do migrador) |
| `migration_form_submissions` | Submissões do formulário de migração (credenciais API Hotmart, planilha de membros, reenvios) |
| `migration_clubs` | Links dos clubs enviados pelo cliente (vinculados à submissão) |
| `migration_validations` | Checklist de validação do migrador (club_links, members_spreadsheet, progress_spreadsheet, admin_access, api_hotmart) |
| `migration_status_history` | Histórico de movimentação entre status (auditoria completa) |

### Fluxo de Status (Kanban)

```
waiting_form → analysis → extraction → in_progress → completed
                  ↓
              rejected (com tag de revisão → cliente corrige → volta para analysis)
```

**5 colunas no Kanban:**
1. **Análise Inicial** — Inclui projetos `waiting_form` e `analysis`
2. **Briefing Invalidado** — Status `rejected` (itens devolvidos ao cliente)
3. **Extração de Dados** — Status `extraction`
4. **Migração em Andamento** — Status `in_progress`
5. **Finalizado** — Status `completed`

### Funcionalidades do Kanban (CS/Admin)

- **Cadastro de novo cliente**: nome, email, URL Curseduca, plataforma de origem, serviços contratados (Migração, Aplicativo, Design)
- **Detail Sheet por projeto**: dados do cliente, última submissão, clubs enviados, planilha/credenciais, checklist de validação, histórico de status
- **Validação item a item**: cada item pode ser aprovado ou rejeitado com observação
- **Ações de movimentação**: Aprovar (→ extraction), Rejeitar (→ rejected com rejected_tag), Avançar status manualmente
- **Compartilhamento via WhatsApp**: gera link do formulário público e copia mensagem pré-definida para enviar ao cliente
- **Link público copiável**: `/migracao/:portal_token`
- **Observações do CS e do Migrador**: campos editáveis no detail sheet

### Formulário Público do Cliente

**Rota:** `/migracao/:token` (sem autenticação)

**Arquivo:** `src/pages/cliente/ClienteMigracaoPublic.tsx`

Valida o `portal_token` via query no `migration_projects` e renderiza o formulário completo.

**Campos obrigatórios:**
1. Links de cada Club (com nome opcional) — instrução destacada em amarelo: criar membro `migracoes@curseduca.com` com permissão Admin
2. Planilha de membros e progresso — upload de arquivo (armazenado no bucket `migration-uploads`)
3. Credenciais da API Hotmart — Client ID, Client Secret, Basic Token (com tooltips de instrução)

**Validação:** Todos os campos são obrigatórios. O botão de envio só habilita quando todos estão preenchidos.

**Reenvio:** Quando o status é `rejected`, o formulário reaparece com destaque aos itens rejeitados e observações do migrador.

### Portal do Cliente — Acompanhamento

**Arquivo:** `src/pages/cliente/ClienteMigracao.tsx`

**Stepper visual de 6 etapas:**
1. Formulário enviado
2. Em análise
3. Ajustes solicitados (só aparece se houve rejeição)
4. Extração de dados
5. Migração em andamento
6. Concluído

**Funcionalidades:**
- Barra de progresso geral (%)
- Cards de status contextual com cores distintas (amber, blue, purple, emerald)
- Exibição de itens rejeitados com observações do migrador
- Observações do migrador visíveis ao cliente
- Botão "Solicitar Migração" na home do portal (direciona para o formulário)

### Analytics de Migração

**Arquivo:** `src/pages/MigracaoAnalyticsPage.tsx`

**KPIs:**
- Em Aberto (waiting_form + analysis + extraction + in_progress)
- Invalidadas (rejected)
- Em Andamento (in_progress + extraction)
- Concluídas (completed)

**Gráficos:**
- Distribuição por Status (bar chart horizontal)
- Distribuição por Plataforma de Origem (bar chart com percentual)

**Tempo Médio por Fase:** Calculado a partir do `migration_status_history`, mostra dias/horas médios de permanência em cada fase.

**Filtros:** Plataforma de origem, intervalo de datas (de/até).

### Permissões e Acesso

- **CS/Admin**: Acesso completo ao Kanban, validações, movimentações e analytics (permissão `carteira.view`)
- **Migrador**: Permissões exclusivas para validação, movimentação e devolutivas
- **Cliente**: Acesso via portal autenticado (acompanhamento) ou link público (formulário)
- **RLS**: Tabelas protegidas — `anon` pode inserir submissões e clubs (formulário público); `authenticated` pode ler/atualizar projetos e validações

### Rotas

| Rota | Componente | Acesso |
|---|---|---|
| `/hub/migracao` | `MigracaoKanbanPage` | CS/Admin |
| `/hub/migracao/analytics` | `MigracaoAnalyticsPage` | CS/Admin |
| `/hub/migracao/ajustes` | `MigracaoAjustesPage` | CS/Admin (em construção) |
| `/migracao/:token` | `ClienteMigracaoPublic` | Público (sem auth) |
| `/cliente/migracao` | `ClienteMigracao` | Portal do Cliente |

### Storage

- **Bucket:** `migration-uploads` (público)
- **Path:** `migration/{projectId}/{timestamp}.{ext}`

---

## 3. Sistema Unificado de Status de Briefings

### O que foi feito

Unificação do sistema de status em todos os módulos de briefing (Kanban, Artes, Refações, CS, Portal do Cliente, Painel do Designer) para garantir consistência e sincronização em tempo real.

### Enum `request_status` (banco de dados)

```sql
pending | in_progress | review | completed | revision | cancelled
```

### Mapeamento de Status

| Status | Label PT-BR | Cor | Descrição |
|---|---|---|---|
| `pending` | Pendente | Azul | Designer alocado mas ainda não abriu |
| `in_progress` | Em Produção | Roxo | Designer trabalhando |
| `review` | Aguardando Validação do Cliente | Âmbar | Entregue, aguardando aprovação |
| `completed` | Aprovada | Verde | Cliente aprovou |
| `revision` | Em Refação | Laranja | Cliente rejeitou — volta para designer |
| `cancelled` | Cancelada | Vermelho | Cancelada |

### Fluxo Completo

```
Solicitação de Ajuste (briefing_adjustments, sem designer)
  ↓ (alocação de designer)
Pendente (pending)
  ↓ (designer abre no painel)
Em Produção (in_progress)
  ↓ (designer entrega)
Aguardando Validação do Cliente (review)
  ↓ Aprovado → Aprovada (completed)
  ↓ Rejeitado → Em Refação (revision) → volta para Em Produção
```

### Notificações de Ajustes

**Edge Function:** `supabase/functions/notify-adjustment-managers/index.ts`

Quando um novo pedido de ajuste é criado:
- **Se o criador é um dos gestores**: e-mail informativo aos demais ("já designado")
- **Se o criador NÃO é gestor**: e-mail de alerta ("alocar designer")

**Destinatários configurados:**
- `jessica.oliveira@curseduca.com`
- `jade.sepulveda@curseduca.com`

**Serviço de e-mail:** Resend (API key configurada como secret)

### Arquivos Modificados

- `src/types/briefing.ts` — `STATUS_LABELS` e `RequestStatus` atualizados
- `src/components/briefing/BriefingKanban.tsx` — Coluna "Em Refação" adicionada
- `src/pages/Dashboard.tsx` — KPIs incluem `revision`
- `src/pages/DesignerPanel.tsx` — Status `revision` exibido
- `src/pages/ClientReviewPage.tsx` — Rejeição muda para `revision` (antes voltava a `in_progress`)
- `src/pages/AjusteBriefingsPage.tsx` — Status unificados
- `src/components/cliente/TimelineSection.tsx` — Labels e cores atualizados no portal
- `src/contexts/LanguageContext.tsx` — Traduções PT/EN adicionadas
- `supabase/functions/delivery-data/index.ts` — Inclui `revision` nas queries
- `supabase/functions/designer-data/index.ts` — Inclui `revision` nos filtros

---

## 4. Processos de Implantação

### Visão Geral

Módulo consolidado no grupo CS que agrupa dados de Briefings, Aplicativos e SCORM por URL do Cliente (ID Curseduca). Oferece visão filtrada por CS responsável e detalhamento em abas.

### Regras de Visibilidade

- Acesso restrito a usuários com permissão `carteira.view` (CS/Admin)
- Bloqueado para perfil `cliente`
- Campo "CS Atual" exibe nome do responsável
- Ferramentas: "Modo Preview" e cópia do link público do portal

### Arquivo Principal

`src/pages/ProcessosImplantacaoPage.tsx`
