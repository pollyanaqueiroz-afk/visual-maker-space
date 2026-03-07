import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Database, AlertTriangle, CheckCircle, Mail, Tag, Globe, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useAuditoriaResumo, useAuditoriaList } from '@/hooks/useAuditoria';
import { format } from 'date-fns';
import { formatNumber } from '@/hooks/useDashboardBI';

function KpiCard({ icon: Icon, label, value, bg, iconColor, loading, onClick }: {
  icon: React.ElementType; label: string; value: number | null | undefined;
  bg: string; iconColor: string; loading: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={`border-0 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
      style={{ backgroundColor: bg }}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${iconColor}20` }}>
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="h-7 w-16 mt-1" /> : (
            <p className="text-2xl font-bold tracking-tight">{formatNumber(value ?? 0)}</p>
          )}
        </div>
        {onClick && !loading && (
          <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground opacity-50" />
        )}
      </CardContent>
    </Card>
  );
}

function OrigemBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, { bg: string; text: string }> = {
    CURSEDUCA: { bg: '#EFF6FF', text: '#3B82F6' },
    ASSINY: { bg: '#F5F3FF', text: '#8B5CF6' },
  };
  const c = colors[value] || { bg: '#F3F4F6', text: '#6B7280' };
  return (
    <Badge variant="outline" className="border-0 font-medium text-xs" style={{ backgroundColor: c.bg, color: c.text }}>
      {value}
    </Badge>
  );
}

function StatusBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const isActive = value === 'ACTIVE';
  return (
    <Badge variant="outline" className="border-0 font-medium text-xs"
      style={{ backgroundColor: isActive ? '#F0FDF4' : '#F3F4F6', color: isActive ? '#22C55E' : '#6B7280' }}>
      {value}
    </Badge>
  );
}

function VazioDetailDialog({ open, onOpenChange, data, loading, search, onSearch, page, onPage }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ReturnType<typeof useAuditoriaList>['data'];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  page: number;
  onPage: (p: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Clientes com ID Curseduca Vazio
          </DialogTitle>
          <DialogDescription>
            {data ? `${data.total} plataformas sem id_curseduca cadastrado` : 'Carregando...'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email..."
            value={search}
            onChange={e => { onSearch(e.target.value); onPage(1); }}
            className="pl-9"
          />
        </div>

        <div className="overflow-auto flex-1 border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plataforma</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !data?.rows?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum registro encontrado
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row, i) => (
                  <TableRow key={row.platform_uuid || i}>
                    <TableCell className="text-sm">{row.nome_plataforma || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">{row.nome_cliente || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {row.email ? <a href={`mailto:${row.email}`} className="text-primary hover:underline">{row.email}</a> : '—'}
                    </TableCell>
                    <TableCell><OrigemBadge value={row.criado_origem} /></TableCell>
                    <TableCell><StatusBadge value={row.status_plataforma} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">
              Página {data.page} de {data.pages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => onPage(page + 1)}>
                Próxima <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AuditoriaPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: resumo, loading: loadingResumo } = useAuditoriaResumo();
  const { data: lista, loading: loadingLista } = useAuditoriaList(search, page);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSearch, setDialogSearch] = useState('');
  const [dialogPage, setDialogPage] = useState(1);
  const { data: dialogData, loading: dialogLoading } = useAuditoriaList(dialogSearch, dialogPage);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria de Cadastro</h1>
        <p className="text-sm text-muted-foreground mt-1">Plataformas com problemas de cadastro (id_curseduca vazio ou inválido)</p>
      </div>

      {/* KPI Cards - Primary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Database} label="Total Plataformas" value={resumo?.total_plataformas} bg="#F1F5F9" iconColor="#64748B" loading={loadingResumo} />
        <KpiCard
          icon={AlertTriangle}
          label="ID Curseduca Vazio"
          value={resumo?.id_curseduca_vazio}
          bg="#FEF2F2"
          iconColor="#EF4444"
          loading={loadingResumo}
          onClick={() => { setDialogOpen(true); setDialogSearch(''); setDialogPage(1); }}
        />
        <KpiCard icon={CheckCircle} label="ID Curseduca OK" value={resumo?.id_curseduca_ok} bg="#F0FDF4" iconColor="#22C55E" loading={loadingResumo} />
      </div>

      {/* KPI Cards - Secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard icon={Mail} label="Com E-mail" value={resumo?.com_email} bg="#EFF6FF" iconColor="#3B82F6" loading={loadingResumo} />
        <KpiCard icon={Tag} label="Com Vindi ID" value={resumo?.com_vindi_id} bg="#FDF4FF" iconColor="#A855F7" loading={loadingResumo} />
        <KpiCard icon={Globe} label="Com Origem" value={resumo?.com_origem} bg="#FFFBEB" iconColor="#F59E0B" loading={loadingResumo} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, email, origem..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Vindi ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLista ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !lista?.rows?.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  lista.rows.map((row, i) => (
                    <TableRow key={row.platform_uuid || i}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.criado_em ? format(new Date(row.criado_em), 'dd/MM/yyyy HH:mm') : '—'}
                      </TableCell>
                      <TableCell><OrigemBadge value={row.criado_origem} /></TableCell>
                      <TableCell className="text-sm">{row.nome_plataforma || '—'}</TableCell>
                      <TableCell className="text-sm font-medium">{row.nome_cliente || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {row.email ? <a href={`mailto:${row.email}`} className="text-primary hover:underline">{row.email}</a> : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{row.vindi_customer_id || '—'}</TableCell>
                      <TableCell><StatusBadge value={row.status_plataforma} /></TableCell>
                      <TableCell className="text-sm">{row.plano || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {lista && lista.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {lista.total} registro{lista.total !== 1 ? 's' : ''} · Página {lista.page} de {lista.pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= lista.pages} onClick={() => setPage(p => p + 1)}>
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de detalhes */}
      <VazioDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        data={dialogData}
        loading={dialogLoading}
        search={dialogSearch}
        onSearch={setDialogSearch}
        page={dialogPage}
        onPage={setDialogPage}
      />
    </div>
  );
}
