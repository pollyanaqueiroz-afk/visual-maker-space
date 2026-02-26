

## Adicionar coluna "Responsavel" na tabela do Dashboard

Adicionar uma nova coluna na tabela entre "Solicitante" e "Status" que exibe o email do responsavel atribuido a cada arte, junto com o prazo de entrega (se houver).

### Alteracoes em `src/pages/Dashboard.tsx`

1. Adicionar um novo `TableHead` com texto "Responsavel" apos a coluna "Solicitante"
2. Adicionar um novo `TableCell` correspondente que exibe:
   - O `assigned_email` da imagem (ou um texto "Nao atribuido" em cinza caso esteja vazio)
   - Abaixo, o prazo formatado (se houver `deadline`)
3. Atualizar o `colSpan` da linha "Nenhuma arte encontrada" de 6 para 7

