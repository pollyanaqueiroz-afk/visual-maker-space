

# Relatório Técnico — Módulo de Agendamento / Calendário

---

## 1. Resumo Executivo

O módulo de Agendamento é um sistema **híbrido** com duas fontes de dados:

1. **Tabela `meetings` no banco de dados** (fonte primária) — onde todas as reuniões são persistidas
2. **Google Calendar via Cloud Function externa** (`hub-reunioes` no GCP) — usada para criar/editar/excluir eventos e importar eventos novos

O calendário na UI lê **apenas do banco local** (`meetings`). O Google Calendar é usado como **canal de sincronização bidirecional** sob demanda (botão "Sincronizar"), seguindo estratégia append-only.

---

## 2. Fluxo Técnico Completo

```text
┌─────────────────────────────────────┐
│  SchedulingPage.tsx (UI principal)  │
│  - Renderiza calendário mensal/sem. │
│  - Formulários de CRUD              │
└──────────┬──────────────────────────┘
           │
           │ fetchMeetings()
           ▼
┌──────────────────────────────┐
│  Supabase SDK (client.ts)    │
│  supabase.from('meetings')   │
│  .select('*')                │
└──────────────────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Tabela: public.meetings     │  ← fonte primária de dados
│  (+ meeting_csat,            │
│    meeting_reschedules,      │
│    meeting_minutes)          │
└──────────────────────────────┘

=== Sincronização com Google Calendar ===

┌──────────────────────────────┐
│  useReunioes() hook          │
│  apiCall('list'|'create'...) │
└──────────┬───────────────────┘
           │ fetch()
           ▼
┌──────────────────────────────────────────┐
│  Edge Function: fetch-hub-summary        │
│  (endpoint=reunioes, action=list|create) │
│  Proxy com Basic Auth                    │
└──────────┬───────────────────────────────┘
           │ fetch()
           ▼
┌──────────────────────────────────────────────────────────┐
│  GCP Cloud Function:                                     │
│  https://us-central1-curseduca-inc-ia.cloudfunctions.net │
│  /hub-reunioes                                           │
│  (interage com Google Calendar API)                      │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `src/pages/SchedulingPage.tsx` (2415 linhas) | Componente principal — calendário, formulários, CRUD, sync, pendências |
| `src/hooks/useReunioes.ts` | Hook de comunicação com Google Calendar (list, create, update, delete) |
| `src/pages/MeetingsDashboard.tsx` | Dashboard analítico de reuniões |
| `src/components/leadership/ProductivityTab.tsx` | Aba de produtividade no painel de liderança |
| `supabase/functions/fetch-hub-summary/index.ts` | Edge Function proxy — roteia `endpoint=reunioes` para GCP |
| `supabase/functions/notify-meeting/index.ts` | Envio de e-mail de convite via Resend |
| `supabase/functions/send-csat-email/index.ts` | Envio de pesquisa CSAT pós-reunião |
| `supabase/functions/meeting-reminders/index.ts` | Lembretes automáticos (30min antes) |

---

## 4. Endpoints

| Endpoint | Método | Ação | Descrição |
|----------|--------|------|-----------|
| `fetch-hub-summary?endpoint=reunioes&action=list` | GET | Listar eventos do Google Calendar | Proxy para `hub-reunioes` no GCP |
| `fetch-hub-summary?endpoint=reunioes&action=create` | POST | Criar evento no Google Calendar | Payload: summary, start, end, attendees |
| `fetch-hub-summary?endpoint=reunioes&action=update` | POST | Atualizar evento | Payload: event_id + campos |
| `fetch-hub-summary?endpoint=reunioes&action=delete` | POST | Excluir evento | Payload: event_id |
| `notify-meeting` | POST | Enviar e-mail de convite | Via Resend |
| `send-csat-email` | POST | Enviar pesquisa CSAT | Via Resend |
| `meeting-reminders` | POST | Enviar lembretes | Cronjob |
| Supabase SDK direto | — | CRUD na tabela `meetings` | select, insert, update, delete |

---

## 5. Estrutura dos Eventos

### Objeto `Meeting` (banco local / UI):
```typescript
{
  id: string;                    // UUID
  title: string;
  description: string | null;
  meeting_date: string;          // 'YYYY-MM-DD'
  meeting_time: string;          // 'HH:MM'
  duration_minutes: number;
  meeting_url: string | null;
  client_name: string | null;
  client_email: string | null;
  client_url: string | null;
  participants: string[];
  status: string;                // 'scheduled' | 'completed' | 'cancelled'
  notes: string | null;
  created_by: string | null;     // user_id
  created_at: string;
  meeting_reason: string | null;
  reschedule_reason: string | null;
  loyalty_index: number | null;
  loyalty_reason: string | null;
  minutes_url: string | null;
  recording_url: string | null;
  funil_status: string | null;
  funil_notas: string | null;
  gcal_event_id: string | null;  // vínculo com Google Calendar
}
```

### Objeto `CalendarEvent` (Google Calendar via hook):
```typescript
{
  event_id: string;
  summary: string;
  description: string;
  start: string;              // ISO datetime
  end: string;
  hangout_link: string;
  location: string;
  html_link: string;
  attendees: { email: string; responseStatus: string }[];
}
```

---

## 6. Tabelas Relacionadas

| Tabela | Papel |
|--------|-------|
| `meetings` | Armazenamento principal de todas as reuniões |
| `meeting_csat` | Pesquisas CSAT vinculadas a reuniões |
| `meeting_reschedules` | Histórico de reagendamentos |
| `meeting_minutes` | Atas (loyalty_stars, observations) |
| `profiles` | Nomes de usuários (display_name) para filtros |

---

## 7. Integração com Google Calendar

- **Implementação**: Cloud Function externa no GCP (`hub-reunioes` em `us-central1-curseduca-inc-ia`)
- **Proxy**: Edge Function `fetch-hub-summary` repassa chamadas com `Basic Auth` (`VISAO360_API_USER` / `VISAO360_API_PASSWORD`)
- **Autenticação**: A Cloud Function GCP usa **Service Account com Domain-Wide Delegation** no Google Workspace
- **Conta**: Uma única conta de serviço — os eventos pertencem a **um único calendário** (provavelmente da conta delegada)
- **Sincronização**: Append-only — novos eventos (por `gcal_event_id`) são inseridos no banco; existentes são ignorados; nada é deletado do banco durante sync

---

## 8. Autenticação

- **Usuário autenticado**: Sessão Supabase Auth (`Bearer token` + `apikey`)
- **Google Calendar**: Service Account com Domain-Wide Delegation — credenciais armazenadas no GCP, não no projeto Lovable
- **Proxy**: Basic Auth com secrets `VISAO360_API_USER` / `VISAO360_API_PASSWORD` configurados na Edge Function

---

## 9. Diagnóstico Técnico

| Pergunta | Resposta |
|----------|----------|
| De onde os eventos vêm? | Tabela `meetings` no banco (fonte primária). Google Calendar é fonte secundária via sync manual. |
| Como o backend processa? | CRUD direto via Supabase SDK. Google Calendar via proxy Edge Function → GCP Cloud Function. |
| Existe integração com Google Calendar? | **Sim** — bidirecional (criar/editar/excluir + importar). |
| Eventos vêm de uma conta específica? | **Sim** — uma única Service Account com Domain-Wide Delegation. |
| Como dados chegam ao componente? | `fetchMeetings()` → `supabase.from('meetings').select('*')` → state `meetings` → renderização. |

---

## 10. Estado Atual Real do Módulo de Agendamento

O módulo é um **calendário local com sincronização opcional ao Google Calendar**. A UI renderiza dados da tabela `meetings` (Supabase). A criação de reuniões grava simultaneamente no banco e no Google Calendar (best-effort). A sincronização importa eventos novos do Google Calendar para o banco. O sistema suporta reuniões de Cliente (com e-mail e URL) e Internas. Inclui recorrência, reagendamento com histórico, conclusão com ata e CSAT, lembretes automáticos e filtros por CS responsável.

**A integração com Google Calendar opera sobre um único calendário** — o da Service Account configurada no GCP.

---

## 11. Impacto para Suportar Todos os Calendários `@curseduca.com`

Para agregar eventos de múltiplos usuários do domínio seria necessário:

1. **GCP Cloud Function (`hub-reunioes`)**: Alterar para aceitar um parâmetro `calendarId` (e-mail do usuário) e usar Domain-Wide Delegation para impersonar cada usuário. A delegação já existe; o código GCP precisaria iterar ou receber a lista de calendários.

2. **Edge Function (`fetch-hub-summary`)**: Repassar o parâmetro de e-mail/calendário na chamada.

3. **Hook `useReunioes`**: Adicionar parâmetro de e-mail do calendário na `apiCall`.

4. **Sync (`handleSyncCalendar`)**: Iterar sobre múltiplos calendários ou receber eventos agregados do backend. Mapeamento `gcal_event_id` continua funcionando (já é único por evento).

5. **Tabela `meetings`**: Adicionar coluna `calendar_owner` (e-mail do dono do calendário) para distinguir origem.

6. **UI**: Adicionar filtro por calendário/pessoa e indicador visual de qual calendário originou o evento.

**Impacto estimado**: Médio. A infraestrutura de Domain-Wide Delegation já existe. A maior mudança é na Cloud Function GCP (fora deste repositório) para suportar impersonação multi-usuário, e ajustes no sync/filtros na UI.

