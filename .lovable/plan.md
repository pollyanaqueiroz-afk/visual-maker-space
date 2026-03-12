

## Plano: Bypass temporário de login para desenvolvimento

### O que será feito

Adicionar um botão "Dev Access" visível apenas em ambiente de desenvolvimento (preview/localhost) na tela de Login. Ao clicar, o usuário será redirecionado diretamente para `/hub` sem autenticação real.

### Como funciona

1. **`src/pages/Login.tsx`** — Adicionar um botão condicional que aparece apenas quando `window.location.hostname` inclui `localhost`, `127.0.0.1` ou `lovable.app` (preview).

2. **`src/hooks/useAuth.tsx`** — Adicionar suporte a um flag `sessionStorage.setItem('dev_bypass', 'true')` que o hook reconhece como "usuário logado" temporariamente, retornando um objeto user fake.

3. **`src/components/ProtectedRoute.tsx`** e **`src/pages/HubPage.tsx`** — Já usam `useAuth()`, então funcionarão automaticamente se o hook reconhecer o bypass.

### Reversão

Quando quiser remover, basta apagar as linhas do bypass — um único prompt resolve.

### Riscos

- Zero impacto em produção (condicional por hostname)
- Não altera tabelas, RLS, ou edge functions
- Permissões podem ficar limitadas (sem role real no banco), mas navegação funcionará

