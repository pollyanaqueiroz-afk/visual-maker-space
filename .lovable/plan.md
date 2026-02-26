

## Pagina de Entrega para o Designer

Criar uma pagina publica (sem necessidade de login) onde o designer pode fazer upload da arte finalizada, adicionar comentarios e marcar como concluido. O link dessa pagina sera enviado no email do briefing.

### 1. Criar tabela `briefing_deliveries`

Nova tabela para armazenar as entregas:
- `id` (uuid, PK)
- `briefing_image_id` (uuid, FK para briefing_images)
- `file_url` (text) - URL do arquivo entregue
- `comments` (text, nullable) - comentarios do designer
- `delivered_by_email` (text) - email de quem entregou
- `created_at` (timestamptz)

Politicas RLS: INSERT e SELECT publicos (a pagina e acessada sem login, via token).

### 2. Adicionar coluna `delivery_token` na tabela `briefing_images`

Token unico (UUID) gerado ao atribuir o briefing. Esse token sera usado na URL da pagina de entrega para identificar a arte sem expor o ID real. Tambem serve como autenticacao leve - so quem tem o link pode entregar.

### 3. Criar pagina `/delivery/:token`

Nova pagina publica (`src/pages/DeliveryPage.tsx`) com:
- Resumo do briefing (tipo de arte, produto, prazo)
- Area de upload de arquivo (usando o bucket `briefing-uploads`)
- Campo de comentarios opcional
- Botao "Entregar arte"
- Ao submeter: salva na tabela `briefing_deliveries`, atualiza status da `briefing_image` para `review`

### 4. Atualizar Edge Function `send-briefing-email`

- Gerar o `delivery_token` ao enviar o briefing
- Salvar o token na coluna `delivery_token` da `briefing_images`
- Incluir no email um botao/link "Entregar Arte" apontando para a pagina de entrega

### 5. Mostrar entregas no Dashboard

- Na tabela do dashboard, indicar visualmente quando uma arte foi entregue (icone ou badge)
- No dialog de detalhes, mostrar link para download do arquivo entregue e os comentarios

### Detalhes tecnicos

**Migracao SQL:**
```text
- ALTER TABLE briefing_images ADD COLUMN delivery_token uuid DEFAULT gen_random_uuid();
- CREATE TABLE briefing_deliveries (id, briefing_image_id, file_url, comments, delivered_by_email, created_at)
- RLS policies para acesso publico de INSERT/SELECT na briefing_deliveries
```

**Arquivos a criar/editar:**
- `src/pages/DeliveryPage.tsx` - pagina publica de entrega
- `src/App.tsx` - adicionar rota `/delivery/:token`
- `supabase/functions/send-briefing-email/index.ts` - gerar token e incluir link no email
- `src/pages/Dashboard.tsx` - indicador visual de entrega

