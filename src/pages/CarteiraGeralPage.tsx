import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Globe, Users, Search, Loader2, Upload, DollarSign,
} from 'lucide-react';
import ImportWizard from '@/components/carteira/importer/ImportWizard';

interface ClientRecord {
  [key: string]: any;
}

const HIDDEN_COLS = ['id', 'created_at', 'updated_at'];

// Fixed columns in exact order requested
const FIXED_COLUMNS: { key: string; label: string }[] = [
  { key: 'id_curseduca', label: 'ID Curseduca' },
  { key: 'client_url', label: 'URL do Cliente' },
  { key: 'client_name', label: 'Nome do Cliente' },
  { key: 'email_do_cliente', label: 'E-mail do Cliente' },
  { key: 'telefone_do_cliente', label: 'Telefone do Cliente' },
  { key: 'portal_do_cliente', label: 'Portal do Cliente' },
  { key: 'status_financeiro', label: 'Status Financeiro' },
  { key: 'forma_de_pagamento', label: 'Forma de Pagamento' },
  { key: 'valor_mensal', label: 'Valor Mensal' },
  { key: 'valor_total_devido', label: 'Valor Total Devido' },
  { key: 'data_da_primeira_parcela_vencida', label: 'Data da Primeira Parcela Vencida' },
  { key: 'plano_detalhado', label: 'Plano Detalhado' },
  { key: 'plano_contratado', label: 'Plano Contratado' },
  { key: 'tipo_de_cs', label: 'Tipo de CS' },
  { key: 'nome_antigo', label: 'Nome Antigo' },
  { key: 'email_do_cs_antigo', label: 'E-mail do CS Antigo' },
  { key: 'nome_do_cs_atual', label: 'Nome do CS Atual' },
  { key: 'email_do_cs_atual', label: 'E-mail do CS Atual' },
  { key: 'etapa_antiga_sensedata', label: 'Etapa Antiga Sensedata' },
  { key: 'origem_do_dado', label: 'Origem do Dado' },
  { key: 'nome_da_plataforma', label: 'Nome da Plataforma' },
  { key: 'data_do_dado', label: 'Data do Dado' },
  { key: 'data_do_processamento_do_dado', label: 'Data do Processamento do Dado' },
  { key: 'banda_contratada', label: 'Banda Contratada' },
  { key: 'banda_utilizada', label: 'Banda Utilizada' },
  { key: 'armazenamento_contratado', label: 'Armazenamento Contratado' },
  { key: 'armazenamento_utilizado', label: 'Armazenamento Utilizado' },
  { key: 'token_de_ia_contratado', label: 'Token de IA Contratado' },
  { key: 'token_de_ia_utilizado', label: 'Token de IA Utilizado' },
  { key: 'certificado_mec_contratado', label: 'Certificado MEC Contratado' },
  { key: 'certificado_mec_utilizado', label: 'Certificado MEC Utilizado' },
  { key: 'data_da_primeira_compra', label: 'Data da Primeira Compra' },
  { key: 'data_da_10_compra', label: 'Data da 10ª Compra' },
  { key: 'data_da_50_compra', label: 'Data da 50ª Compra' },
  { key: 'data_da_100_compra', label: 'Data da 100ª Compra' },
  { key: 'data_da_200_compra', label: 'Data da 200ª Compra' },
  { key: 'data_do_primeiro_conteudo_finalizado', label: 'Data do 1º Conteúdo Finalizado' },
  { key: 'data_do_10_conteudo_finalizado', label: 'Data do 10º Conteúdo Finalizado' },
  { key: 'data_do_50_conteudo_finalizado', label: 'Data do 50º Conteúdo Finalizado' },
  { key: 'data_do_100_conteudo_finalizado', label: 'Data do 100º Conteúdo Finalizado' },
  { key: 'data_do_200_conteudo_finalizado', label: 'Data do 200º Conteúdo Finalizado' },
  { key: 'nome_do_closer', label: 'Nome do Closer' },
  { key: 'email_do_closer', label: 'E-mail do Closer' },
  { key: 'data_do_fechamento_do_contrato', label: 'Data do Fechamento do Contrato' },
  { key: 'metrica_de_sucesso_acordada_na_venda', label: 'Métrica de Sucesso Acordada na Venda' },
  { key: 'desconto_concedido', label: 'Desconto Concedido' },
  { key: 'data_do_ultimo_login', label: 'Data do Último Login' },
  { key: 'tempo_medio_de_uso_em_min', label: 'Tempo Médio de Uso (min)' },
  { key: 'membros_do_mes_atual', label: 'Membros do Mês Atual' },
  { key: 'variacao_de_quantidade_de_membros_por_mes', label: 'Variação de Membros por Mês' },
  { key: 'dias_desde_o_ultimo_login', label: 'Dias Desde o Último Login' },
  { key: 'email_do_cliente_2', label: 'E-mail do Cliente 2' },
];

function formatCellValue(value: any): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export default function CarteiraGeralPage() {
  const navigate = useNavigate();
  const [clientRecords, setClientRecords] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Fetch all clients (bypass 1000 row default limit)
    let allData: ClientRecord[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data: page, error: pageError } = await (supabase.from('clients' as any).select('*').order('client_name', { ascending: true }).range(from, from + PAGE_SIZE - 1) as any);
      if (pageError) {
        console.error(pageError);
        toast.error('Erro ao carregar dados');
        setLoading(false);
        return;
      }
      allData = allData.concat((page || []) as ClientRecord[]);
      hasMore = (page || []).length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    const data = allData;
    const error = null;

    if (error) {
      console.error(error);
      toast.error('Erro ao carregar dados');
    } else {
      setClientRecords((data || []) as ClientRecord[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter by search only
  const filtered = useMemo(() => {
    if (!search) return clientRecords;
    const q = search.toLowerCase();
    return clientRecords.filter(cr =>
      Object.values(cr).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }, [clientRecords, search]);

  const stats = useMemo(() => ({
    total: clientRecords.length,
    totalRevenue: clientRecords.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
  }), [clientRecords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carteira Geral</h1>
          <p className="text-sm text-muted-foreground">Visão geral de todos os clientes importados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1.5" />
          Importar Dados
        </Button>
      </div>

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} onSuccess={loadData} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Globe className="h-5 w-5 text-foreground" />
            <span className="text-2xl font-bold text-foreground">{stats.total}</span>
            <span className="text-[11px] text-muted-foreground">Total de Clientes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <Users className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-foreground">{filtered.length}</span>
            <span className="text-[11px] text-muted-foreground">Exibindo</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center gap-1">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}
            </span>
            <span className="text-[11px] text-muted-foreground">Receita Total</span>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em qualquer coluna..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Client Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
          ) : (
            <div className="w-full border rounded-md flex flex-col">
              {/* Top scrollbar */}
              <div
                className="w-full overflow-x-auto"
                onScroll={(e) => {
                  const bottom = (e.currentTarget as HTMLDivElement).nextElementSibling as HTMLDivElement;
                  if (bottom) bottom.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
                }}
              >
                <div className="min-w-[4000px] h-[1px]" />
              </div>
              {/* Table with synced scroll */}
              <div
                className="w-full overflow-x-auto"
                onScroll={(e) => {
                  const top = (e.currentTarget as HTMLDivElement).previousElementSibling as HTMLDivElement;
                  if (top) top.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
                }}
              >
                <div className="min-w-[4000px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                        {FIXED_COLUMNS.map(col => (
                          <TableHead key={col.key} className="text-[11px] uppercase tracking-wider whitespace-nowrap">
                            {col.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row, i) => (
                        <TableRow key={row.id || i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {FIXED_COLUMNS.map(col => (
                            <TableCell key={col.key} className="text-xs whitespace-nowrap max-w-[250px] truncate">
                              {col.key === 'client_url' && row[col.key] ? (
                                <a href={row[col.key]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {row[col.key]}
                                </a>
                              ) : (
                                formatCellValue(row[col.key])
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
