# 📋 Changelog — Solicitações Jade (últimas 48h)

**Período:** 10–12 de março de 2026  
**Solicitante:** Jade Sepulveda  
**Projeto:** Hub Curseduca (Visual Maker Space)

---

## 🔧 Ajustes Significativos da Lógica do Hub

### 1. Unificação completa dos status de briefing
- **Problema:** Os status estavam desconexos entre os módulos (Kanban, Artes, Refações, Ajuste de Briefings, Portal do Cliente e Portal do Designer). Uma arte podia aparecer como "Aguardando Validação" em um local e "Em Revisão" em outro.
- **Solução:** Unificação do fluxo de status em todas as visualizações, com a seguinte cadeia:
  - `Solicitação de Ajuste` → pedido criado no CS, sem designer alocado
  - `Pendente` → designer alocado, mas ainda não interagiu
  - `Em Produção` → designer abriu/interagiu com o pedido
  - `Aguardando Validação do Cliente` → artes entregues, aguardando feedback
  - `Aprovada` → cliente aprovou
  - `Em Refação` → cliente rejeitou com pontuações (novo status)
  - `Cancelada` → solicitação cancelada com justificativa
- **Arquivos afetados:** `src/types/briefing.ts`, `src/pages/Dashboard.tsx`, `src/components/briefing/BriefingKanban.tsx`, `src/pages/AjusteBriefingsPage.tsx`, `src/pages/ClientReviewPage.tsx`, `src/pages/DesignerPanel.tsx`
- **Banco de dados:** Adição do valor `revision` ao enum `request_status`

### 2. Novo status "Em Refação" no banco de dados
- **Migração SQL:** Adicionado `revision` ao tipo enum `request_status` via `ALTER TYPE`
- **Impacto:** Todas as tabelas que usam o enum (`briefing_images`, `briefing_requests`) passam a suportar o novo status nativamente

### 3. Sincronização Kanban ↔ Artes ↔ Portal do Cliente ↔ Portal do Designer
- **Kanban:** Adicionada coluna "Em Refação" com cor laranja; ajustes de briefing agora transitam por todas as colunas de status (não ficam mais confinados a uma coluna única de ajuste)
- **Artes (Dashboard):** KPIs e filtros atualizados para incluir `revision` nas contagens de "Em Produção" e nos filtros visuais
- **Portal do Cliente:** Rejeição agora grava `status: 'revision'` (em vez de reverter para `in_progress`), incrementando `revision_count`
- **Portal do Designer:** Status "Em Refação" exibido com badge laranja; designer pode reenviar artes em refação

### 4. Ajustes no fluxo de rejeição pelo cliente
- **Antes:** Ao rejeitar, a arte voltava para `in_progress`
- **Depois:** A arte vai para `revision`, mantendo rastreabilidade do ciclo de refação e incrementando o contador de revisões

---

## 🆕 Criações

### 5. Edge Function `notify-adjustment-managers`
- **Objetivo:** Notificar automaticamente Jade (`jade.sepulveda@curseduca.com`) e Jéssica Lux (`jessica.oliveira@curseduca.com`) quando um novo pedido de ajuste de briefing é criado
- **Comportamento:**
  - Se o criador for uma das duas: a outra recebe um e-mail informando que o pedido já foi designado
  - Se o criador for outra pessoa: ambas recebem e-mail solicitando alocação a um designer
- **Tecnologia:** Envio via Resend API, com fallback silencioso caso a chave não esteja configurada
- **Arquivo:** `supabase/functions/notify-adjustment-managers/index.ts`

### 6. Notificações in-app para gestoras de briefing
- **Integração:** A edge function também tenta criar notificações no banco (tabela `profiles`) para exibição no Hub
- **Lógica:** Diferencia notificações para a criadora vs. a outra gestora

---

## ✨ Refinamentos

### 7. Labels e cores padronizados
- **`STATUS_LABELS`:** Atualizado para refletir os nomes corretos em português (`Em Refação`, `Aguardando Validação do Cliente`, etc.)
- **`STATUS_COLORS`:** Cores consistentes em todos os módulos:
  - Pendente: âmbar
  - Em Produção: azul
  - Aguardando Validação: violeta
  - Aprovada: esmeralda
  - Em Refação: laranja
  - Cancelada: vermelho

### 8. Internacionalização (i18n)
- **Adição de traduções** PT/EN para o novo status `revision` → "Em Refação" / "In Revision"
- **Adição de traduções** para `adjustment_requested` → "Solicitação de Ajuste" / "Adjustment Requested"
- **Arquivo:** `src/contexts/LanguageContext.tsx`

### 9. Timeline do Portal do Cliente
- **Refinamento:** Componente `TimelineSection.tsx` atualizado para exibir corretamente os novos status com cores e labels unificados

### 10. Edge Functions de dados (designer e delivery)
- **`designer-data/index.ts`:** Agora inclui `revision` no filtro de status dos ajustes de briefing, garantindo que artes em refação apareçam no painel do designer
- **`delivery-data/index.ts`:** Atualizado para suportar o novo fluxo de status

---

## 📊 Resumo de Impacto

| Módulo | Alteração |
|--------|-----------|
| Banco de dados | +1 enum value (`revision`) |
| Edge Functions | +1 nova (`notify-adjustment-managers`), 2 atualizadas |
| Páginas frontend | 5 arquivos modificados |
| Tipos/i18n | 2 arquivos atualizados |
| Componentes | 2 atualizados (Kanban, Timeline) |

---

## 🔐 Segurança

- Nenhuma alteração em RLS policies
- E-mails de gestoras hardcoded apenas na edge function (server-side), nunca expostos ao frontend
- Notificações seguem o mesmo padrão de permissões existente

---

*Documento gerado em 12/03/2026 — Hub Curseduca*
