

## Plano: Adicionar permissão "Editar responsável" em Gestão de Briefings

### O que muda

1. **`src/hooks/usePermissions.tsx`** — Adicionar nova permissão `briefings.change_assignee` com label "Editar responsável" no módulo de briefings, logo após `briefings.assign`.

2. **`src/pages/Dashboard.tsx`** — Separar a lógica de controle:
   - `canAssign` (permissão `briefings.assign`) continua controlando a **atribuição inicial** e o **envio em lote**.
   - Novo `canChangeAssignee` (permissão `briefings.change_assignee`) controla o **botão de trocar designer** (Popover de edição inline que aparece no hover quando já existe um `assigned_email`).
   - Ambas as permissões também são liberadas para `gerente_implantacao`.

### Resultado

Na página de Permissões por Perfil, aparecerá uma nova linha "Editar responsável" dentro de "Gestão de Briefings", permitindo controlar separadamente quem pode trocar o designer de um briefing já atribuído.

