

## Retomar implementacao do botao de atribuicao

A implementacao foi interrompida no meio. Os seguintes itens ja estao prontos:
- Colunas `assigned_email` e `deadline` no banco de dados
- Edge function `send-briefing-email` com envio via Resend
- Componente `AssignBriefingDialog` criado
- Import do componente no Dashboard

### O que falta

**Adicionar o botao AssignBriefingDialog na tabela do Dashboard** (arquivo `src/pages/Dashboard.tsx`):
- Na coluna de acoes de cada linha da tabela (ao lado do seletor de status e do botao de detalhes), adicionar o componente `AssignBriefingDialog` passando:
  - `imageId`: o id da imagem
  - `currentEmail`: email atualmente atribuido (se houver)
  - `currentDeadline`: prazo atual (se houver)
  - `imageLabel`: label descritivo da arte (tipo + nome do produto)
  - `onAssigned`: callback para recarregar os dados (`fetchData`)

### Detalhes tecnicos

- Editar apenas `src/pages/Dashboard.tsx`, linhas ~274-288, adicionando `<AssignBriefingDialog ... />` no `div` de acoes
- A interface `ImageWithRequest` precisa incluir os campos `assigned_email` e `deadline` (opcionais) para que os valores atuais sejam passados ao dialog
- O `fetchData` ja faz `select('*', ...)` entao os novos campos serao retornados automaticamente

