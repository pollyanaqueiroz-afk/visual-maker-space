// Column data types supported by the importer
export type ColumnDataType =
  | 'texto'
  | 'texto_longo'
  | 'numero_inteiro'
  | 'numero_decimal'
  | 'moeda'
  | 'email'
  | 'url'
  | 'telefone'
  | 'data'
  | 'enum'
  | 'booleano';

export const DATA_TYPE_LABELS: Record<ColumnDataType, string> = {
  texto: 'Texto',
  texto_longo: 'Texto Longo',
  numero_inteiro: 'Número Inteiro',
  numero_decimal: 'Número Decimal',
  moeda: 'Moeda (R$)',
  email: 'E-mail',
  url: 'URL',
  telefone: 'Telefone',
  data: 'Data',
  enum: 'Enum (lista)',
  booleano: 'Booleano',
};

export interface ColumnDefinition {
  label: string;
  dbKey: string;
  type: ColumnDataType;
  enumValues?: string[];
}

export interface MappedColumn {
  csvHeader: string;
  dbKey: string;
  label: string;
  type: ColumnDataType;
  enumValues?: string[];
  ignored: boolean;
}

export interface ValidationResult {
  valid: number;
  invalid: number;
  errors: { row: number; value: string }[];
}

export type WizardStep = 'upload' | 'mapping' | 'types' | 'preview' | 'confirm';

export const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'mapping', label: 'Mapeamento' },
  { key: 'types', label: 'Tipos de Dados' },
  { key: 'preview', label: 'Prévia & Validação' },
  { key: 'confirm', label: 'Confirmação' },
];

// The 52 standard columns template
export const CURSEDUCA_TEMPLATE: ColumnDefinition[] = [
  { label: 'ID Curseduca', dbKey: 'id_curseduca', type: 'texto' },
  { label: 'URL do Cliente', dbKey: 'client_url', type: 'url' },
  { label: 'Nome do Cliente', dbKey: 'client_name', type: 'texto' },
  { label: 'E-mail do Cliente', dbKey: 'email_do_cliente', type: 'email' },
  { label: 'Telefone do Cliente', dbKey: 'telefone_do_cliente', type: 'telefone' },
  { label: 'Portal do Cliente', dbKey: 'portal_do_cliente', type: 'enum', enumValues: ['Ativo', 'Inativo'] },
  { label: 'Status Financeiro', dbKey: 'status_financeiro', type: 'enum', enumValues: ['Adimplente', 'Inadimplente'] },
  { label: 'Forma de Pagamento', dbKey: 'forma_de_pagamento', type: 'enum' },
  { label: 'Valor Mensalidade', dbKey: 'valor_mensal', type: 'moeda' },
  { label: 'Valor Total Devido', dbKey: 'valor_total_devido', type: 'texto' },
  { label: 'Data da Primeira Parcela Vencida', dbKey: 'data_da_primeira_parcela_vencida', type: 'data' },
  { label: 'Plano Detalhado', dbKey: 'plano_detalhado', type: 'texto' },
  { label: 'Plano Contratado', dbKey: 'plano_contratado', type: 'enum', enumValues: ['Scale', 'Evolution', 'Curseduca', 'Engage', 'Evolution APP'] },
  { label: 'Tipo de CS', dbKey: 'tipo_de_cs', type: 'enum', enumValues: ['CS', 'Administrador'] },
  { label: 'Nome Antigo', dbKey: 'nome_antigo', type: 'texto' },
  { label: 'E-mail do CS Antigo', dbKey: 'e_mail_do_cs_antigo', type: 'email' },
  { label: 'Nome do CS Atual', dbKey: 'nome_do_cs_atual', type: 'texto' },
  { label: 'E-mail do CS Atual', dbKey: 'e_mail_do_cs_atual', type: 'email' },
  { label: 'Etapa Antiga Sensedata', dbKey: 'etapa_antiga_sensedata', type: 'enum', enumValues: ['MONITORAMENTO', '+7 DIAS SEM RETORNO', 'ENTRADA', 'RISCO DE CHURN', 'CANCELADOS', 'ENGAJADO/ATIVO', 'INADIMPLENTES', 'IMPLANTAÇÃO', 'ADAPTAÇÃO'] },
  { label: 'Origem do Dado', dbKey: 'origem_do_dado', type: 'enum', enumValues: ['Base Consolidada Manual', 'Somente no Sense'] },
  { label: 'Nome da Plataforma', dbKey: 'nome_da_plataforma', type: 'texto' },
  { label: 'Data do Dado', dbKey: 'data_do_dado', type: 'data' },
  { label: 'Data do Processamento do Dado', dbKey: 'data_do_processamento_do_dado', type: 'data' },
  { label: 'Banda Contratada', dbKey: 'banda_contratada', type: 'numero_inteiro' },
  { label: 'Banda Utilizada', dbKey: 'banda_utilizada', type: 'numero_inteiro' },
  { label: 'Armazenamento Contratado', dbKey: 'armazenamento_contratado', type: 'numero_inteiro' },
  { label: 'Armazenamento Utilizado', dbKey: 'armazenamento_utilizado', type: 'numero_inteiro' },
  { label: 'Token de IA Contratado', dbKey: 'token_de_ia_contratado', type: 'numero_inteiro' },
  { label: 'Token de IA Utilizado', dbKey: 'token_de_ia_utilizado', type: 'numero_inteiro' },
  { label: 'Certificado MEC Contratado', dbKey: 'certificado_mec_contratado', type: 'numero_inteiro' },
  { label: 'Certificado MEC Utilizado', dbKey: 'certificado_mec_utilizado', type: 'numero_inteiro' },
  { label: 'Data da Primeira Compra', dbKey: 'data_da_primeira_compra', type: 'data' },
  { label: 'Data da 10ª Compra', dbKey: 'data_da_10_compra', type: 'data' },
  { label: 'Data da 50ª Compra', dbKey: 'data_da_50_compra', type: 'data' },
  { label: 'Data da 100ª Compra', dbKey: 'data_da_100_compra', type: 'data' },
  { label: 'Data da 200ª Compra', dbKey: 'data_da_200_compra', type: 'data' },
  { label: 'Data do 1º Conteúdo Finalizado', dbKey: 'data_do_primeiro_conteudo_finalizado', type: 'data' },
  { label: 'Data do 10º Conteúdo Finalizado', dbKey: 'data_do_10_conteudo_finalizado', type: 'data' },
  { label: 'Data do 50º Conteúdo Finalizado', dbKey: 'data_do_50_conteudo_finalizado', type: 'data' },
  { label: 'Data do 100º Conteúdo Finalizado', dbKey: 'data_do_100_conteudo_finalizado', type: 'data' },
  { label: 'Data do 200º Conteúdo Finalizado', dbKey: 'data_do_200_conteudo_finalizado', type: 'data' },
  { label: 'Nome do Closer', dbKey: 'nome_do_closer', type: 'texto' },
  { label: 'E-mail do Closer', dbKey: 'e_mail_do_closer', type: 'email' },
  { label: 'Data do Fechamento do Contrato', dbKey: 'data_do_fechamento_do_contrato', type: 'data' },
  { label: 'Métrica de Sucesso Acordada na Venda', dbKey: 'metrica_de_sucesso_acordada_na_venda', type: 'texto_longo' },
  { label: 'Desconto Concedido', dbKey: 'desconto_concedido', type: 'texto' },
  { label: 'Data do Último Login', dbKey: 'data_do_ultimo_login', type: 'data' },
  { label: 'Tempo Médio de Uso (min)', dbKey: 'tempo_medio_de_uso_em_min', type: 'numero_decimal' },
  { label: 'Membros do Mês Atual', dbKey: 'membros_do_mes_atual', type: 'numero_inteiro' },
  { label: 'Variação de Membros por Mês', dbKey: 'variacao_de_quantidade_de_membros_por_mes', type: 'numero_inteiro' },
  { label: 'Dias Desde o Último Login', dbKey: 'dias_desde_o_ultimo_login', type: 'numero_inteiro' },
];

// Validation functions
export function validateValue(value: string, type: ColumnDataType, enumValues?: string[]): boolean {
  if (!value || value.trim() === '') return true; // empty is valid (nullable)
  const v = value.trim();
  switch (type) {
    case 'texto':
    case 'texto_longo':
      return true;
    case 'numero_inteiro':
      return /^-?\d+$/.test(v.replace(/[.,\s]/g, ''));
    case 'numero_decimal':
    case 'moeda':
      return /^-?[\d.,\s]+$/.test(v.replace(/[R$\s]/g, ''));
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case 'url':
      return /^https?:\/\/.+/.test(v) || /^[\w.-]+\.\w{2,}/.test(v);
    case 'telefone':
      return /^[\d\s()+-]{7,20}$/.test(v);
    case 'data':
      return !isNaN(Date.parse(v)) || /^\d{2}\/\d{2}\/\d{4}/.test(v);
    case 'enum':
      if (!enumValues || enumValues.length === 0) return true;
    // Allow any value for enum — user will fix manually later
    return true;
    case 'booleano':
      return ['true', 'false', 'sim', 'não', 'nao', 'ativo', 'inativo', '1', '0', 'yes', 'no'].includes(v.toLowerCase());
    default:
      return true;
  }
}

export function autoDetectType(values: string[]): { type: ColumnDataType; enumValues?: string[] } {
  const nonEmpty = values.filter(v => v && v.trim() !== '');
  if (nonEmpty.length === 0) return { type: 'texto' };

  // Check email
  if (nonEmpty.every(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))) return { type: 'email' };
  // Check URL
  if (nonEmpty.every(v => /^https?:\/\//.test(v.trim()) || /^[\w.-]+\.\w{2,}/.test(v.trim()))) return { type: 'url' };
  // Check boolean
  const boolVals = ['true', 'false', 'sim', 'não', 'nao', 'ativo', 'inativo', '1', '0', 'yes', 'no'];
  if (nonEmpty.every(v => boolVals.includes(v.trim().toLowerCase()))) return { type: 'booleano' };
  // Check integer
  if (nonEmpty.every(v => /^-?\d+$/.test(v.trim().replace(/[.,\s]/g, '')))) return { type: 'numero_inteiro' };
  // Check decimal/currency
  if (nonEmpty.every(v => /^-?[\d.,\s]+$/.test(v.trim().replace(/[R$\s]/g, '')))) {
    if (nonEmpty.some(v => v.includes('R$') || v.includes(','))) return { type: 'moeda' };
    return { type: 'numero_decimal' };
  }
  // Check date
  if (nonEmpty.every(v => !isNaN(Date.parse(v.trim())) || /^\d{2}\/\d{2}\/\d{4}/.test(v.trim()))) return { type: 'data' };
  // Check phone
  if (nonEmpty.every(v => /^[\d\s()+-]{7,20}$/.test(v.trim()))) return { type: 'telefone' };
  // Check enum (few unique values relative to total)
  const unique = [...new Set(nonEmpty.map(v => v.trim()))];
  if (unique.length <= 15 && unique.length < nonEmpty.length * 0.3) {
    return { type: 'enum', enumValues: unique };
  }
  // Check long text
  if (nonEmpty.some(v => v.length > 100)) return { type: 'texto_longo' };

  return { type: 'texto' };
}

// Fuzzy match for auto-mapping
export function similarityScore(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Simple character overlap
  const set1 = new Set(na.split(''));
  const set2 = new Set(nb.split(''));
  const intersection = [...set1].filter(c => set2.has(c)).length;
  return intersection / Math.max(set1.size, set2.size);
}
