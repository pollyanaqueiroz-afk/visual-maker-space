

## Painel do Designer — "Minhas Artes"

Criar uma pagina publica onde o designer digita seu email e ve todas as artes atribuidas a ele, com status, prazo e link para entregar cada uma.

### Como funciona

1. O designer acessa `/designer` (ou clica num link no email)
2. Digita seu email
3. O sistema busca todas as `briefing_images` onde `assigned_email` = email informado
4. Mostra uma lista com: tipo de arte, cliente, prazo, status e botao para ir direto na pagina de entrega (`/delivery/:token`)

### Implementacao

**Novo arquivo `src/pages/DesignerPanel.tsx`:**
- Tela simples com campo de email e botao "Ver minhas artes"
- Ao buscar, consulta `briefing_images` filtrando por `assigned_email` (com join em `briefing_requests` para pegar nome do cliente)
- Exibe tabela/cards com: tipo de arte, produto, cliente, prazo, status e link "Entregar" apontando para `/delivery/{delivery_token}`
- Sem necessidade de login — a filtragem por email ja garante que o designer so ve suas artes

**Rota no `src/App.tsx`:**
- Adicionar `<Route path="/designer" element={<DesignerPanel />} />`

**Link no email de briefing:**
- Adicionar no email (edge function `send-briefing-email`) um link secundario "Ver todas as minhas artes" apontando para `/designer`

### Detalhes tecnicos

- A query usa `assigned_email` que ja e publica (RLS da `briefing_images` permite SELECT com `true`)
- Nenhuma migracao necessaria — os dados ja existem
- O componente reutiliza os mesmos `IMAGE_TYPE_LABELS` e patterns visuais do `DeliveryPage`

