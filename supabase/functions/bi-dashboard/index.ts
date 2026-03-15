import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── helpers ──
function avg(arr: number[]) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0); }

async function fetchAll(table: string) {
  const rows: any[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

function filterByCS(rows: any[], csEmail?: string, field = "cs_atual") {
  if (!csEmail) return rows;
  return rows.filter((r) => r[field] === csEmail);
}

function bucketDias(dias: number | null): string {
  if (dias == null) return "Sem dado";
  if (dias <= 7) return "0-7 dias";
  if (dias <= 30) return "8-30 dias";
  if (dias <= 60) return "31-60 dias";
  return "61-90 dias";
}

function periodKey(dateStr: string | null, granularity: "dia" | "semana" | "mes"): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (granularity === "dia") return `${yyyy}-${mm}-${dd}`;
  if (granularity === "mes") return `${yyyy}-${mm}`;
  // semana: ISO week start (Monday)
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

// ── main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get("metric");
    const csEmail = url.searchParams.get("cs_email_atual") || undefined;

    if (!metric) return json({ error: "metric required" }, 400);

    // Load tables on demand
    let engajamento: any[] | null = null;
    let financeiro: any[] | null = null;
    let churn: any[] | null = null;
    let inativos: any[] | null = null;
    let clients: any[] | null = null;

    const getEngajamento = async () => {
      if (!engajamento) engajamento = await fetchAll("cliente_engajamento_produto");
      return engajamento;
    };
    const getFinanceiro = async () => {
      if (!financeiro) financeiro = await fetchAll("cliente_financeiro");
      return financeiro;
    };
    const getChurn = async () => {
      if (!churn) churn = await fetchAll("cliente_churn");
      return churn;
    };
    const getInativos = async () => {
      if (!inativos) inativos = await fetchAll("clientes_inativos");
      return inativos;
    };
    const getClients = async () => {
      if (!clients) clients = await fetchAll("clients");
      return clients;
    };

    // Helper: get set of id_curseduca where clients.status_financeiro = 'Ativa'
    let _activeIds: Set<string> | null = null;
    const getActiveClientIds = async (): Promise<Set<string>> => {
      if (!_activeIds) {
        const cls = await getClients();
        _activeIds = new Set(cls.filter((c: any) => c.status_financeiro === 'Ativa').map((c: any) => c.id_curseduca).filter(Boolean));
      }
      return _activeIds;
    };
    const filterActive = async (rows: any[], field = "id_curseduca") => {
      const ids = await getActiveClientIds();
      return rows.filter((r: any) => ids.has(r[field]));
    };

    // ═══════════════════════════════════════════
    // METRIC: cs
    // ═══════════════════════════════════════════
    if (metric === "cs") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const csMap: Record<string, any> = {};

      for (const r of eng) {
        const cs = r.cs_atual || "Sem CS";
        if (!csMap[cs]) csMap[cs] = { cs_nome: cs, cs_email: cs, total: 0, ativos: 0, cancelados: 0, inadimplentes: 0, receita: 0, dias_login: [] };
        csMap[cs].total++;
        const st = (r.status_curseduca || "").toLowerCase();
        if (st === "ativo" || st === "active") csMap[cs].ativos++;
        if (st === "cancelado" || st === "block") csMap[cs].cancelados++;
        if ((r.status_financeiro || "").toLowerCase().includes("inadimplente")) csMap[cs].inadimplentes++;
        if (r.dias_desde_ultimo_login != null) csMap[cs].dias_login.push(r.dias_desde_ultimo_login);
      }

      // Add receita from financeiro
      for (const f of fin) {
        const matchEng = eng.find(e => e.id_curseduca === f.id_curseduca);
        if (matchEng) {
          const cs = matchEng.cs_atual || "Sem CS";
          if (csMap[cs] && f.is_plano && f.valor_contratado) {
            csMap[cs].receita += Number(f.valor_contratado) || 0;
          }
        }
      }

      const result = Object.values(csMap).map((c: any) => ({
        cs_nome: c.cs_nome,
        cs_email: c.cs_email,
        total: c.total,
        ativos: c.ativos,
        cancelados: c.cancelados,
        inadimplentes: c.inadimplentes,
        receita: c.receita,
        media_dias_sem_login: c.dias_login.length ? avg(c.dias_login) : null,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: overview
    // ═══════════════════════════════════════════
    if (metric === "overview") {
      const eng = await filterActive(filterByCS(await getEngajamento(), csEmail));
      const fin = await filterActive(await getFinanceiro());
      const inat = await getInativos();

      const ativos = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        return s === "ativo" || s === "active";
      });
      const emImpl = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        return s.includes("implant");
      });
      const emRisco = eng.filter(r => r.alerta_inatividade === true);

      // receita from financeiro where is_plano
      const engIds = new Set(eng.map(e => e.id_curseduca));
      const relevantFin = fin.filter(f => engIds.has(f.id_curseduca));
      const receitaPlano = sum(relevantFin.filter(f => f.is_plano).map(f => Number(f.valor_contratado) || 0));
      const receitaUpsell = sum(relevantFin.filter(f => f.is_upsell).map(f => Number(f.valor_contratado) || 0));
      const receitaTotal = receitaPlano + receitaUpsell;

      const inadimplentes = eng.filter(r => (r.status_financeiro || "").toLowerCase().includes("inadimplente"));
      const adimplentes = eng.filter(r => {
        const sf = (r.status_financeiro || "").toLowerCase();
        return sf.includes("adimplente") && !sf.includes("inadimplente");
      });

      // Receita inadimplente
      const inadIds = new Set(inadimplentes.map(e => e.id_curseduca));
      const receitaInadimplente = sum(relevantFin.filter(f => inadIds.has(f.id_curseduca) && f.is_plano).map(f => Number(f.valor_contratado) || 0));
      const receitaAdimplente = receitaTotal - receitaInadimplente;

      const diasLogin = ativos.map(r => r.dias_desde_ultimo_login).filter((d: any) => d != null);
      const alunos = ativos.map(r => r.membros_mes_atual).filter((d: any) => d != null);

      return json({
        total_clientes: eng.length,
        ativos: ativos.length,
        em_implantacao: emImpl.length,
        em_risco: emRisco.length,
        adimplentes: adimplentes.length,
        inadimplentes: inadimplentes.length,
        receita_total: receitaTotal,
        receita_adimplente: receitaAdimplente,
        receita_inadimplente: receitaInadimplente,
        mrr_upsell: receitaUpsell,
        ticket_medio: eng.length > 0 ? receitaTotal / eng.length : 0,
        media_dias_sem_login: diasLogin.length ? avg(diasLogin) : 0,
        media_alunos: alunos.length ? avg(alunos) : 0,
      });
    }

    // ═══════════════════════════════════════════
    // METRIC: cancelados
    // ═══════════════════════════════════════════
    if (metric === "cancelados") {
      const inat = await getInativos();
      return json({ total_cancelados: inat.length });
    }

    // ═══════════════════════════════════════════
    // METRIC: status
    // ═══════════════════════════════════════════
    if (metric === "status") {
      const eng = await filterActive(filterByCS(await getEngajamento(), csEmail));
      const fin = await filterActive(await getFinanceiro());
      const statusMap: Record<string, { total: number; ids: Set<string> }> = {};

      for (const r of eng) {
        let s = r.status_curseduca || "Sem status";
        if (s.toLowerCase() === "active") s = "Ativo";
        if (s.toLowerCase() === "block") s = "Cancelado";
        if (!statusMap[s]) statusMap[s] = { total: 0, ids: new Set() };
        statusMap[s].total++;
        statusMap[s].ids.add(r.id_curseduca);
      }

      const result = Object.entries(statusMap).map(([status, v]) => {
        const receita = sum(fin.filter(f => v.ids.has(f.id_curseduca) && f.is_plano).map(f => Number(f.valor_contratado) || 0));
        return { status, total: v.total, receita };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: receita_por_status
    // ═══════════════════════════════════════════
    if (metric === "receita_por_status") {
      const eng = await filterActive(filterByCS(await getEngajamento(), csEmail));
      const fin = await filterActive(await getFinanceiro());
      const statusMap: Record<string, { total: number; ids: Set<string> }> = {};

      for (const r of eng) {
        let s = r.status_curseduca || "Sem status";
        if (s.toLowerCase() === "active") s = "Ativo";
        if (s.toLowerCase() === "block") s = "Cancelado";
        if (!statusMap[s]) statusMap[s] = { total: 0, ids: new Set() };
        statusMap[s].total++;
        statusMap[s].ids.add(r.id_curseduca);
      }

      const result = Object.entries(statusMap).map(([status, v]) => {
        const receita = sum(fin.filter(f => v.ids.has(f.id_curseduca) && f.is_plano).map(f => Number(f.valor_contratado) || 0));
        return { status, total: v.total, receita, ticket_medio: v.total > 0 ? receita / v.total : null };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: clientes_lista
    // ═══════════════════════════════════════════
    if (metric === "clientes_lista") {
      const eng = await filterActive(filterByCS(await getEngajamento(), csEmail));
      const fin = await filterActive(await getFinanceiro());
      const finMap: Record<string, number> = {};
      for (const f of fin) {
        if (f.is_plano) {
          finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0);
        }
      }

      const result = eng.map(r => ({
        nome: r.nome,
        id_curseduca: r.id_curseduca,
        plano: r.plano,
        receita: finMap[r.id_curseduca] || 0,
        contrato_status: r.status_curseduca || "Sem status",
        cs_nome: r.cs_atual,
        status_financeiro: r.status_financeiro,
        risco_churn: r.alerta_inatividade ? "alto" : null,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: mrr_mensal / mrr_semanal
    // ═══════════════════════════════════════════
    if (metric === "mrr_mensal" || metric === "mrr_semanal") {
      const fin = await filterActive(await getFinanceiro());
      const eng = await filterActive(filterByCS(await getEngajamento(), csEmail));
      const engIds = new Set(eng.map(e => e.id_curseduca));
      const relevant = fin.filter(f => engIds.has(f.id_curseduca));

      const granularity = metric === "mrr_mensal" ? "mes" : "semana";

      // Group by data_criacao period
      const periodMap: Record<string, { mrr_planos: number; mrr_upsell: number }> = {};
      for (const f of relevant) {
        const pk = periodKey(f.data_criacao, granularity as any);
        if (!pk) continue;
        if (!periodMap[pk]) periodMap[pk] = { mrr_planos: 0, mrr_upsell: 0 };
        const val = Number(f.valor_contratado) || 0;
        if (f.is_upsell) periodMap[pk].mrr_upsell += val;
        else periodMap[pk].mrr_planos += val;
      }

      const result = Object.entries(periodMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodo, v]) => ({
          periodo,
          mrr: v.mrr_planos + v.mrr_upsell,
          mrr_planos: v.mrr_planos,
          mrr_upsell: v.mrr_upsell,
        }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: financeiro
    // ═══════════════════════════════════════════
    if (metric === "financeiro") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const engIds = new Set(eng.map(e => e.id_curseduca));
      const engMap = new Map(eng.map(e => [e.id_curseduca, e]));

      // Group by status_financeiro × inadimplencia
      const grouped: Record<string, { total: number; receita: number }> = {};
      for (const f of fin) {
        if (!engIds.has(f.id_curseduca)) continue;
        const e = engMap.get(f.id_curseduca);
        const sf = f.status || "Sem info";
        const inadStr = (e?.status_financeiro || "").toLowerCase().includes("inadimplente") ? "Inadimplente" : (e?.status_financeiro || "").toLowerCase().includes("adimplente") ? "Adimplente" : "Sem info";
        const key = `${sf}|${inadStr}`;
        if (!grouped[key]) grouped[key] = { total: 0, receita: 0 };
        grouped[key].total++;
        grouped[key].receita += Number(f.valor_contratado) || 0;
      }

      const result = Object.entries(grouped).map(([key, v]) => {
        const [status_financeiro, inadimplencia] = key.split("|");
        return { status_financeiro, inadimplencia, total: v.total, receita: v.receita };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: planos
    // ═══════════════════════════════════════════
    if (metric === "planos") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const engIds = new Set(eng.map(e => e.id_curseduca));
      const engMap = new Map(eng.map(e => [e.id_curseduca, e]));

      const planoMap: Record<string, { total: number; ativos: number; cancelados: number; receita: number; alunos: number[] }> = {};
      for (const f of fin) {
        if (!engIds.has(f.id_curseduca) || !f.is_plano) continue;
        const p = f.plano || f.nome_plano_master || "Sem plano";
        if (!planoMap[p]) planoMap[p] = { total: 0, ativos: 0, cancelados: 0, receita: 0, alunos: [] };
        planoMap[p].total++;
        planoMap[p].receita += Number(f.valor_contratado) || 0;
        const e = engMap.get(f.id_curseduca);
        if (e) {
          const s = (e.status_curseduca || "").toLowerCase();
          if (s === "ativo" || s === "active") planoMap[p].ativos++;
          if (s === "cancelado" || s === "block") planoMap[p].cancelados++;
          if (e.membros_mes_atual != null) planoMap[p].alunos.push(e.membros_mes_atual);
        }
      }

      const result = Object.entries(planoMap)
        .map(([plano, v]) => ({
          plano,
          total: v.total,
          ativos: v.ativos,
          cancelados: v.cancelados,
          receita: v.receita,
          media_alunos: v.alunos.length ? avg(v.alunos) : 0,
        }))
        .sort((a, b) => b.receita - a.receita);
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: etapas_cs
    // ═══════════════════════════════════════════
    if (metric === "etapas_cs") {
      const { data: etapas } = await supabase.from("carteirizacao_etapas").select("*");
      const { data: csRows } = await supabase.from("carteirizacao_cs").select("*");
      const eng = filterByCS(await getEngajamento(), csEmail);
      const cls = await getClients();
      const fin = await getFinanceiro();

      // Map client to etapa via cs_atual -> carteirizacao_cs -> etapa
      const csEtapaMap: Record<string, string> = {};
      for (const c of (csRows || [])) {
        const etapa = (etapas || []).find((e: any) => e.id === c.etapa_id);
        if (etapa) csEtapaMap[c.user_email] = etapa.nome;
      }

      const etapaStats: Record<string, { total: number; inadimplentes: number; receita: number; dias: number[] }> = {};
      for (const r of eng) {
        const etapa = csEtapaMap[r.cs_atual] || "Sem etapa";
        if (!etapaStats[etapa]) etapaStats[etapa] = { total: 0, inadimplentes: 0, receita: 0, dias: [] };
        etapaStats[etapa].total++;
        if ((r.status_financeiro || "").toLowerCase().includes("inadimplente")) etapaStats[etapa].inadimplentes++;
        if (r.dias_desde_ultimo_login != null) etapaStats[etapa].dias.push(r.dias_desde_ultimo_login);
      }

      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }
      for (const r of eng) {
        const etapa = csEtapaMap[r.cs_atual] || "Sem etapa";
        if (etapaStats[etapa] && finMap[r.id_curseduca]) etapaStats[etapa].receita += finMap[r.id_curseduca];
      }

      const result = Object.entries(etapaStats).map(([etapa, v]) => ({
        etapa,
        total: v.total,
        inadimplentes: v.inadimplentes,
        receita: v.receita,
        media_dias_sem_login: v.dias.length ? avg(v.dias) : 0,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: engajamento
    // ═══════════════════════════════════════════
    if (metric === "engajamento") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const faixas: Record<string, { total: number; receita: number }> = {};
      for (const r of eng) {
        const s = (r.status_curseduca || "").toLowerCase();
        if (s === "cancelado" || s === "block") continue;
        const faixa = bucketDias(r.dias_desde_ultimo_login);
        if (!faixas[faixa]) faixas[faixa] = { total: 0, receita: 0 };
        faixas[faixa].total++;
        faixas[faixa].receita += finMap[r.id_curseduca] || 0;
      }

      const order = ["0-7 dias", "8-30 dias", "31-60 dias", "61-90 dias", "Sem dado"];
      const result = order.map(f => ({ faixa: f, total: faixas[f]?.total || 0, receita_em_risco: faixas[f]?.receita || 0 }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: membros
    // ═══════════════════════════════════════════
    if (metric === "membros") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const faixas: Record<string, { total: number; receita: number }> = {};
      const buckets = [
        { label: "0", min: 0, max: 0 },
        { label: "1-5", min: 1, max: 5 },
        { label: "6-20", min: 6, max: 20 },
        { label: "21-50", min: 21, max: 50 },
        { label: "51-100", min: 51, max: 100 },
        { label: "101-500", min: 101, max: 500 },
        { label: "500+", min: 501, max: 999999 },
      ];

      for (const r of eng) {
        const s = (r.status_curseduca || "").toLowerCase();
        if (s === "cancelado" || s === "block") continue;
        const m = r.membros_mes_atual ?? 0;
        const bucket = buckets.find(b => m >= b.min && m <= b.max) || { label: "Sem dado" };
        const label = bucket.label;
        if (!faixas[label]) faixas[label] = { total: 0, receita: 0 };
        faixas[label].total++;
        faixas[label].receita += finMap[r.id_curseduca] || 0;
      }

      const result = buckets.map(b => ({ faixa_alunos: b.label, total: faixas[b.label]?.total || 0, receita: faixas[b.label]?.receita || 0 }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: uso_recursos
    // ═══════════════════════════════════════════
    if (metric === "uso_recursos") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const ativos = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        return s === "ativo" || s === "active";
      });

      const bh = ativos.map(r => r.player_bandwidth_hired).filter((v: any) => v != null && v > 0);
      const bu = ativos.map(r => r.player_bandwidth_used).filter((v: any) => v != null);
      const sh = ativos.map(r => r.player_storage_hired).filter((v: any) => v != null && v > 0);
      const su = ativos.map(r => r.player_storage_used).filter((v: any) => v != null);
      const th = ativos.map(r => r.ai_tokens_hired).filter((v: any) => v != null && v > 0);
      const tu = ativos.map(r => r.ai_tokens_used).filter((v: any) => v != null);

      const toGB = (bytes: number) => bytes / (1024 * 1024 * 1024);

      return json({
        total_ativos: ativos.length,
        media_banda_contratada_gb: bh.length ? toGB(avg(bh)) : 0,
        media_banda_utilizada_gb: bu.length ? toGB(avg(bu)) : 0,
        media_storage_contratado_gb: sh.length ? toGB(avg(sh)) : 0,
        media_storage_utilizado_gb: su.length ? toGB(avg(su)) : 0,
        media_tokens_contratados: th.length ? avg(th) : 0,
        media_tokens_utilizados: tu.length ? avg(tu) : 0,
        media_certs_contratados: null,
        media_certs_utilizados: null,
        pct_uso_banda: bh.length ? avg(bu) / avg(bh) : 0,
        pct_uso_storage: sh.length ? avg(su) / avg(sh) : 0,
        pct_uso_tokens: th.length ? avg(tu) / avg(th) : 0,
      });
    }

    // ═══════════════════════════════════════════
    // METRIC: origens
    // ═══════════════════════════════════════════
    if (metric === "origens") {
      // Use plano as proxy for origem since there's no explicit origem field
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const origMap: Record<string, { total: number; ativos: number; cancelados: number; receita: number }> = {};
      for (const r of eng) {
        const origem = r.plano || "Sem plano";
        if (!origMap[origem]) origMap[origem] = { total: 0, ativos: 0, cancelados: 0, receita: 0 };
        origMap[origem].total++;
        const s = (r.status_curseduca || "").toLowerCase();
        if (s === "ativo" || s === "active") origMap[origem].ativos++;
        if (s === "cancelado" || s === "block") origMap[origem].cancelados++;
        origMap[origem].receita += finMap[r.id_curseduca] || 0;
      }

      const result = Object.entries(origMap)
        .map(([origem, v]) => ({ origem, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: churn_overview
    // ═══════════════════════════════════════════
    if (metric === "churn_overview") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const churnData = filterByCS(await getChurn(), csEmail, "cs_email");
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const ativos = eng.filter(r => { const s = (r.status_curseduca || "").toLowerCase(); return s === "ativo" || s === "active"; });
      const inadimplentes = eng.filter(r => (r.status_financeiro || "").toLowerCase().includes("inadimplente"));
      const comAlerta = eng.filter(r => r.alerta_inatividade === true);
      const inat30 = eng.filter(r => r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login >= 30);
      const inat60 = eng.filter(r => r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login >= 60);
      const inat90 = eng.filter(r => r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login >= 90);

      const receitaAtivos = sum(ativos.map(r => finMap[r.id_curseduca] || 0));
      const receitaRisco = sum(comAlerta.map(r => finMap[r.id_curseduca] || 0));
      const totalInadimplente = sum(inadimplentes.map(r => finMap[r.id_curseduca] || 0));

      const diasArr = ativos.map(r => r.dias_desde_ultimo_login).filter((d: any) => d != null);
      const varArr = ativos.map(r => r.variacao_m0_vs_m1).filter((v: any) => v != null);

      return json({
        total_ativos: ativos.length,
        churn_executado: churnData.filter(c => c.status === "cancelado").length,
        com_falha_cobranca: inadimplentes.filter(r => (Number(fin.find(f => f.id_curseduca === r.id_curseduca)?.numero_parcelas_inadimplentes) || 0) > 0).length,
        inadimplentes_vindi: inadimplentes.length,
        com_risco_churn: comAlerta.length,
        com_alerta_inatividade: comAlerta.length,
        com_stop_billing: 0,
        com_bloqueio: eng.filter(r => (r.status_curseduca || "").toLowerCase() === "block").length,
        inativos_30d: inat30.length,
        inativos_60d: inat60.length,
        inativos_90d: inat90.length,
        receita_em_risco: receitaRisco,
        receita_total_ativos: receitaAtivos,
        total_inadimplente: totalInadimplente,
        media_dias_sem_login: diasArr.length ? avg(diasArr) : 0,
        media_variacao_membros: varArr.length ? avg(varArr) : 0,
      });
    }

    // ═══════════════════════════════════════════
    // METRIC: churn_motivos
    // ═══════════════════════════════════════════
    if (metric === "churn_motivos") {
      const churnData = filterByCS(await getChurn(), csEmail, "cs_email");
      const motivoMap: Record<string, { motivo_cliente: string; total: number; receita_perdida: number }> = {};

      for (const c of churnData) {
        const motivo = c.loyalty_reason || "Sem motivo CS";
        if (!motivoMap[motivo]) motivoMap[motivo] = { motivo_cliente: motivo, total: 0, receita_perdida: 0 };
        motivoMap[motivo].total++;
        motivoMap[motivo].receita_perdida += Number(c.receita) || 0;
      }

      const result = Object.entries(motivoMap)
        .map(([motivo_cs, v]) => ({ motivo_cs, ...v }))
        .sort((a, b) => b.total - a.total);
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: churn_cohort
    // ═══════════════════════════════════════════
    if (metric === "churn_cohort") {
      const eng = filterByCS(await getEngajamento(), csEmail);

      // Group by status_curseduca
      const statusGroups: Record<string, any[]> = {};
      for (const r of eng) {
        let s = r.status_curseduca || "sem_status";
        if (!statusGroups[s]) statusGroups[s] = [];
        statusGroups[s].push(r);
      }

      const result = Object.entries(statusGroups).map(([status, rows]) => {
        const m0 = rows.map(r => r.membros_mes_atual).filter((v: any) => v != null);
        const m1 = rows.map(r => r.membros_mes_m1).filter((v: any) => v != null);
        const m2 = rows.map(r => r.membros_mes_m2).filter((v: any) => v != null);
        const m3 = rows.map(r => r.membros_mes_m3).filter((v: any) => v != null);
        const m4 = rows.map(r => r.membros_mes_m4).filter((v: any) => v != null);
        const vars = rows.map(r => r.variacao_m0_vs_m1).filter((v: any) => v != null);
        const vars12 = rows.map(r => r.variacao_m1_vs_m2).filter((v: any) => v != null);
        const rets = rows.map(r => r.taxa_retencao_membro).filter((v: any) => v != null);

        return {
          status,
          total: rows.length,
          media_m0: m0.length ? avg(m0) : null,
          media_m1: m1.length ? avg(m1) : null,
          media_m2: m2.length ? avg(m2) : null,
          media_m3: m3.length ? avg(m3) : null,
          media_m4: m4.length ? avg(m4) : null,
          media_var_m0_m1: vars.length ? avg(vars) : null,
          media_var_m1_m2: vars12.length ? avg(vars12) : null,
          media_taxa_retencao: rets.length ? avg(rets) : null,
        };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: churn_detalhe
    // ═══════════════════════════════════════════
    if (metric === "churn_detalhe") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }
      const inadFinMap: Record<string, number> = {};
      for (const f of fin) {
        if ((Number(f.numero_parcelas_inadimplentes) || 0) > 0) {
          inadFinMap[f.id_curseduca] = (inadFinMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0);
        }
      }

      // Only include clients at risk
      const atRisk = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        if (s === "cancelado" || s === "block") return false;
        return r.alerta_inatividade || (r.status_financeiro || "").toLowerCase().includes("inadimplente") || (r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login > 30);
      });

      const result = atRisk.map(r => ({
        id_curseduca: r.id_curseduca,
        nome: r.nome,
        contrato_status: r.status_curseduca || "Sem status",
        plano: r.plano || "",
        receita: finMap[r.id_curseduca] || null,
        status_financeiro: r.status_financeiro,
        valor_inadimplente: inadFinMap[r.id_curseduca] || null,
        falha_cobranca: (inadFinMap[r.id_curseduca] || 0) > 0,
        dias_desde_ultimo_login: r.dias_desde_ultimo_login,
        alerta_inatividade: r.alerta_inatividade || false,
        membros_mes_atual: r.membros_mes_atual,
        membros_mes_m1: r.membros_mes_m1,
        variacao_membros: r.variacao_m0_vs_m1,
        risco_churn: r.alerta_inatividade ? "alto" : (r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login > 60 ? "medio" : null),
        previsao_churn: null,
        motivo_churn_cs: null,
        cs_nome: r.cs_atual,
        cs_email: r.cs_atual,
        ultimo_nps: null,
        ultimo_csat: null,
        funil_renovacao_etapa: null,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: churn_risk
    // ═══════════════════════════════════════════
    if (metric === "churn_risk") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const atRisk = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        if (s === "cancelado" || s === "block") return false;
        return r.alerta_inatividade || (r.status_financeiro || "").toLowerCase().includes("inadimplente") || (r.dias_desde_ultimo_login != null && r.dias_desde_ultimo_login > 30);
      });

      const result = atRisk.map(r => ({
        id_curseduca: r.id_curseduca,
        cliente_nome: r.nome,
        plano: r.plano || "",
        status: r.status_curseduca || "Sem status",
        inadimplencia: (r.status_financeiro || "").toLowerCase().includes("inadimplente") ? "Inadimplente" : (r.status_financeiro || "").toLowerCase().includes("adimplente") ? "Adimplente" : "—",
        fatura: finMap[r.id_curseduca] || null,
        dias_sem_login: r.dias_desde_ultimo_login,
        alunos: r.membros_mes_atual,
        variacao_membros: r.variacao_m0_vs_m1,
        cs_nome: r.cs_atual,
        etapa_do_cs: null,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: novos_clientes
    // ═══════════════════════════════════════════
    if (metric === "novos_clientes") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      // Consider "new" as created in the last 90 days
      const now = new Date();
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const novos = eng.filter(r => {
        if (!r.data_criacao) return false;
        return new Date(r.data_criacao) >= cutoff;
      });

      const result = novos.map(r => ({
        nome: r.nome,
        id_curseduca: r.id_curseduca,
        plano: r.plano,
        receita: finMap[r.id_curseduca] || 0,
        data_ativacao: r.data_criacao ? new Date(r.data_criacao).toISOString().split("T")[0] : null,
        cs_nome: r.cs_atual,
        contrato_status: r.status_curseduca,
      }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: novos_por_dia / novos_por_semana / novos_por_mes
    // ═══════════════════════════════════════════
    if (metric === "novos_por_dia" || metric === "novos_por_semana" || metric === "novos_por_mes") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const granularity = metric === "novos_por_dia" ? "dia" : metric === "novos_por_semana" ? "semana" : "mes";
      const periodMap: Record<string, { total: number; receita: number }> = {};

      for (const r of eng) {
        const pk = periodKey(r.data_criacao, granularity as any);
        if (!pk) continue;
        if (!periodMap[pk]) periodMap[pk] = { total: 0, receita: 0 };
        periodMap[pk].total++;
        periodMap[pk].receita += finMap[r.id_curseduca] || 0;
      }

      const result = Object.entries(periodMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodo, v]) => ({ periodo, ...v }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: novos_por_plano
    // ═══════════════════════════════════════════
    if (metric === "novos_por_plano") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const now = new Date();
      const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const novos = eng.filter(r => r.data_criacao && new Date(r.data_criacao) >= cutoff);

      const planoMap: Record<string, { total: number; receita: number }> = {};
      for (const r of novos) {
        const p = r.plano || "Sem plano";
        if (!planoMap[p]) planoMap[p] = { total: 0, receita: 0 };
        planoMap[p].total++;
        planoMap[p].receita += finMap[r.id_curseduca] || 0;
      }

      const result = Object.entries(planoMap)
        .map(([plano, v]) => ({ plano, ...v }))
        .sort((a, b) => b.total - a.total);
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: implantacao_clientes
    // ═══════════════════════════════════════════
    if (metric === "implantacao_clientes") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const impl = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        return s.includes("implant");
      });

      const result = impl.map(r => {
        const diasContrato = r.data_criacao ? Math.floor((Date.now() - new Date(r.data_criacao).getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          nome: r.nome,
          id_curseduca: r.id_curseduca,
          plano: r.plano,
          receita: finMap[r.id_curseduca] || 0,
          status_financeiro: r.status_financeiro,
          risco_churn: r.alerta_inatividade ? "alto" : null,
          dias_contrato: diasContrato,
          dias_desde_primeiro_aluno: null,
          membros_mes_atual: r.membros_mes_atual,
          cs_nome: r.cs_atual,
        };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: implantacao_overview
    // ═══════════════════════════════════════════
    if (metric === "implantacao_overview") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const impl = eng.filter(r => (r.status_curseduca || "").toLowerCase().includes("implant"));

      const adimplente = impl.filter(r => !(r.status_financeiro || "").toLowerCase().includes("inadimplente"));
      const inadimplente = impl.filter(r => (r.status_financeiro || "").toLowerCase().includes("inadimplente"));

      const churnData = filterByCS(await getChurn(), csEmail, "cs_email");
      const churnImpl = churnData.filter(c => {
        const e = eng.find(r => r.id_curseduca === c.id_curseduca);
        return e && (e.status_curseduca || "").toLowerCase().includes("implant");
      });

      return json({
        total_implantacao: impl.length,
        pct_adimplente: impl.length > 0 ? (adimplente.length / impl.length) * 100 : 0,
        pct_inadimplente: impl.length > 0 ? (inadimplente.length / impl.length) * 100 : 0,
        churn_em_implantacao: churnImpl.length,
        pct_churn_implantacao: impl.length > 0 ? (churnImpl.length / impl.length) * 100 : 0,
      });
    }

    // ═══════════════════════════════════════════
    // METRIC: implantacao_finalizada_dia/semana/mes
    // ═══════════════════════════════════════════
    if (metric === "implantacao_finalizada_dia" || metric === "implantacao_finalizada_semana" || metric === "implantacao_finalizada_mes") {
      // Approximate: clients that were in implantation and now are active
      // Use data_criacao as proxy since we don't have exact "finished implantation" date
      const eng = await getEngajamento();
      const granularity = metric.endsWith("dia") ? "dia" : metric.endsWith("semana") ? "semana" : "mes";

      const active = eng.filter(r => {
        const s = (r.status_curseduca || "").toLowerCase();
        return s === "ativo" || s === "active";
      });

      const periodMap: Record<string, number> = {};
      for (const r of active) {
        const pk = periodKey(r.data_criacao, granularity as any);
        if (!pk) continue;
        periodMap[pk] = (periodMap[pk] || 0) + 1;
      }

      const result = Object.entries(periodMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([periodo, total]) => ({ periodo, total }));
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: upsell_overview
    // ═══════════════════════════════════════════
    if (metric === "upsell_overview") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }
      const upsellMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_upsell) upsellMap[f.id_curseduca] = (upsellMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const ativos = eng.filter(r => { const s = (r.status_curseduca || "").toLowerCase(); return s === "ativo" || s === "active"; });

      const elegBanda = ativos.filter(r => (r.player_bandwidth_pct_uso || 0) > 80);
      const elegTokens = ativos.filter(r => (r.ai_tokens_pct_uso || 0) > 80);
      const elegAlunos = ativos.filter(r => r.gatilho_upgrade_100alunos === true);
      const elegProdutos = ativos.filter(r => r.cobranca_automatica_banda_excedente || r.cobranca_automatica_token_excedente);

      const elegIds = new Set([
        ...elegBanda.map(r => r.id_curseduca),
        ...elegTokens.map(r => r.id_curseduca),
        ...elegAlunos.map(r => r.id_curseduca),
        ...elegProdutos.map(r => r.id_curseduca),
      ]);
      const elegiveis = ativos.filter(r => elegIds.has(r.id_curseduca));

      const bandaPcts = ativos.map(r => r.player_bandwidth_pct_uso).filter((v: any) => v != null);
      const tokensPcts = ativos.map(r => r.ai_tokens_pct_uso).filter((v: any) => v != null);
      const storagePcts = ativos.map(r => r.player_storage_pct_uso).filter((v: any) => v != null);

      // Score: sum of usage percentages
      const scores = elegiveis.map(r => (r.player_bandwidth_pct_uso || 0) + (r.ai_tokens_pct_uso || 0) + (r.player_storage_pct_uso || 0));

      return json({
        total_ativos: ativos.length,
        com_potencial_upsell: elegiveis.length,
        elegivel_banda: elegBanda.length,
        elegivel_tokens: elegTokens.length,
        elegivel_alunos: elegAlunos.length,
        elegivel_produtos: elegProdutos.length,
        total_elegiveis: elegiveis.length,
        score_medio: scores.length ? avg(scores) : 0,
        upsell_total_realizado: sum(Object.values(upsellMap)),
        media_uso_banda_pct: bandaPcts.length ? avg(bandaPcts) : 0,
        media_uso_tokens_pct: tokensPcts.length ? avg(tokensPcts) : 0,
        media_uso_storage_pct: storagePcts.length ? avg(storagePcts) : 0,
        receita_base_elegiveis: sum(elegiveis.map(r => finMap[r.id_curseduca] || 0)),
      });
    }

    // ═══════════════════════════════════════════
    // METRIC: upsell_por_tipo
    // ═══════════════════════════════════════════
    if (metric === "upsell_por_tipo") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }

      const ativos = eng.filter(r => { const s = (r.status_curseduca || "").toLowerCase(); return s === "ativo" || s === "active"; });

      const tipos = [
        { tipo: "Banda", filter: (r: any) => (r.player_bandwidth_pct_uso || 0) > 80, pctField: "player_bandwidth_pct_uso" },
        { tipo: "Tokens IA", filter: (r: any) => (r.ai_tokens_pct_uso || 0) > 80, pctField: "ai_tokens_pct_uso" },
        { tipo: "Alunos", filter: (r: any) => r.gatilho_upgrade_100alunos === true, pctField: null },
        { tipo: "Produtos", filter: (r: any) => r.cobranca_automatica_banda_excedente || r.cobranca_automatica_token_excedente, pctField: null },
      ];

      const result = tipos.map(t => {
        const eleg = ativos.filter(t.filter);
        const pcts = t.pctField ? eleg.map((r: any) => r[t.pctField]).filter((v: any) => v != null) : [];
        return {
          tipo: t.tipo,
          elegiveis: eleg.length,
          media_uso_pct: pcts.length ? avg(pcts) : null,
          receita_elegiveis: sum(eleg.map(r => finMap[r.id_curseduca] || 0)),
        };
      });
      return json(result);
    }

    // ═══════════════════════════════════════════
    // METRIC: upsell_oportunidades
    // ═══════════════════════════════════════════
    if (metric === "upsell_oportunidades") {
      const eng = filterByCS(await getEngajamento(), csEmail);
      const fin = await getFinanceiro();
      const finMap: Record<string, number> = {};
      for (const f of fin) { if (f.is_plano) finMap[f.id_curseduca] = (finMap[f.id_curseduca] || 0) + (Number(f.valor_contratado) || 0); }
      const upsellMap: Record<string, { total: number; lastDate: string | null }> = {};
      for (const f of fin) {
        if (f.is_upsell) {
          if (!upsellMap[f.id_curseduca]) upsellMap[f.id_curseduca] = { total: 0, lastDate: null };
          upsellMap[f.id_curseduca].total += Number(f.valor_contratado) || 0;
          if (f.data_criacao && (!upsellMap[f.id_curseduca].lastDate || f.data_criacao > upsellMap[f.id_curseduca].lastDate))
            upsellMap[f.id_curseduca].lastDate = f.data_criacao;
        }
      }

      const ativos = eng.filter(r => { const s = (r.status_curseduca || "").toLowerCase(); return s === "ativo" || s === "active"; });

      // Only clients with some eligibility
      const result = ativos
        .filter(r =>
          (r.player_bandwidth_pct_uso || 0) > 50 ||
          (r.ai_tokens_pct_uso || 0) > 50 ||
          r.gatilho_upgrade_100alunos ||
          r.cobranca_automatica_banda_excedente ||
          r.cobranca_automatica_token_excedente
        )
        .map(r => {
          const score = ((r.player_bandwidth_pct_uso || 0) > 80 ? 10 : 0) +
            ((r.ai_tokens_pct_uso || 0) > 80 ? 10 : 0) +
            (r.gatilho_upgrade_100alunos ? 5 : 0) +
            ((r.cobranca_automatica_banda_excedente || r.cobranca_automatica_token_excedente) ? 5 : 0);

          return {
            id_curseduca: r.id_curseduca,
            nome: r.nome,
            plano: r.plano || "",
            receita: finMap[r.id_curseduca] || null,
            score_potencial_upsell: score,
            elegivel_upsell_banda: (r.player_bandwidth_pct_uso || 0) > 80,
            elegivel_upsell_tokens: (r.ai_tokens_pct_uso || 0) > 80,
            elegivel_upsell_alunos: r.gatilho_upgrade_100alunos || false,
            elegivel_upsell_produtos: r.cobranca_automatica_banda_excedente || r.cobranca_automatica_token_excedente || false,
            upsell_total_realizado: upsellMap[r.id_curseduca]?.total || null,
            data_ultimo_upsell: upsellMap[r.id_curseduca]?.lastDate || null,
            uso_banda_pct: r.player_bandwidth_pct_uso,
            uso_tokens_pct: r.ai_tokens_pct_uso,
            uso_storage_pct: r.player_storage_pct_uso,
            alunos_atual: r.membros_mes_atual,
            crescimento_membros: r.variacao_m0_vs_m1,
            cs_nome: r.cs_atual,
            cs_email: r.cs_atual,
          };
        })
        .sort((a, b) => b.score_potencial_upsell - a.score_potencial_upsell);
      return json(result);
    }

    return json({ error: `Unknown metric: ${metric}` }, 400);
  } catch (err: any) {
    console.error("bi-dashboard error:", err);
    return json({ error: err.message || "Internal error" }, 500);
  }
});
