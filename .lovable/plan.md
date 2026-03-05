

# Plano: Importador e Gerenciador de SCORM

## Visao Geral

Criar um modulo completo para upload de pacotes SCORM (ZIP), extracaoo e armazenamento dos arquivos, e exibicaoo do conteudo SCORM em uma pagina dedicada via URL.

## Arquitetura

```text
[Upload ZIP] --> [Edge Function: process-scorm]
                      |
                      ├─ Extrai ZIP em memoria (JSZip)
                      ├─ Identifica imsmanifest.xml
                      ├─ Faz upload de cada arquivo para Storage bucket "scorm-packages"
                      ├─ Salva registro na tabela "scorm_packages"
                      └─ Retorna URL do pacote

[Pagina /hub/scorm]        --> Lista todos os SCORMs com acoes (abrir, excluir)
[Pagina /scorm/:id/player] --> Carrega o SCORM via iframe apontando para o index.html no Storage
```

## Componentes

### 1. Banco de dados
- Tabela `scorm_packages`: id, title, description, entry_point (caminho relativo do HTML principal), storage_path, file_count, file_size_bytes, created_by, created_at, updated_at
- RLS: usuarios autenticados podem CRUD
- Permissoes: `scorm.view`, `scorm.create`, `scorm.delete` no modulo de permissoes

### 2. Storage
- Bucket `scorm-packages` (publico para leitura, para que o iframe consiga carregar os assets)
- Estrutura: `scorm-packages/{scorm_id}/imsmanifest.xml`, `scorm-packages/{scorm_id}/...`

### 3. Edge Function `process-scorm`
- Recebe o ZIP via multipart/form-data
- Usa JSZip para extrair
- Parseia imsmanifest.xml para encontrar o entry point (recurso principal)
- Faz upload de todos os arquivos para o bucket sob `{scorm_id}/`
- Insere registro na tabela scorm_packages
- Retorna o ID e URL do player

### 4. Frontend

**Pagina de gestao (`/hub/scorm` - ScormManagerPage)**
- Tabela listando SCORMs importados (titulo, data, tamanho, qtd arquivos)
- Botao "Importar SCORM" abre dialog de upload (drag & drop do ZIP + titulo)
- Acoes por linha: Abrir (link para player), Excluir
- Segue padrao visual da CarteiraGeralPage

**Pagina do Player (`/scorm/:id` - ScormPlayerPage)**
- Pagina full-screen com iframe apontando para o entry_point no Storage
- Header minimo com titulo e botao voltar
- API SCORM basica (scorm 1.2 / 2004) injetada via postMessage para compatibilidade

### 5. Navegacao
- Novo item "SCORM" no sidebar sob grupo "Implantacao"
- Rota `/hub/scorm` protegida por `scorm.view`
- Rota publica `/scorm/:id` para o player

### 6. Permissoes
- Adicionar modulo `scorm` ao `PERMISSION_MODULES` em usePermissions.tsx
- Permissoes: `scorm.view`, `scorm.create`, `scorm.delete`

## Ordem de implementacao
1. Criar tabela + bucket via migration
2. Criar Edge Function process-scorm
3. Criar pagina de gestao ScormManagerPage
4. Criar pagina do player ScormPlayerPage
5. Adicionar rotas e navegacao no sidebar
6. Adicionar permissoes ao sistema

