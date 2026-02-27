import { useState, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2, Plus, Columns } from 'lucide-react';

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ColumnMapping = Record<string, string>; // csv_header -> db_column

interface DbColumn {
  column_name: string;
  data_type: string;
}

interface NewColumnApproval {
  csvHeader: string;
  dbName: string;
  approved: boolean;
}

const RESERVED_COLUMNS = ['id', 'created_at', 'updated_at'];

function sanitizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_/, '')
    .replace(/_$/, '')
    .replace(/^(\d)/, 'c_$1')
    .slice(0, 63);
}

export default function ImportClientsDialog({ open, onOpenChange, onSuccess }: ImportClientsDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'new_columns' | 'preview' | 'importing'>('upload');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dbColumns, setDbColumns] = useState<DbColumn[]>([]);
  const [newColumns, setNewColumns] = useState<NewColumnApproval[]>([]);
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [creatingColumns, setCreatingColumns] = useState(false);

  const mappableDbColumns = dbColumns.filter(c => !RESERVED_COLUMNS.includes(c.column_name));

  const reset = useCallback(() => {
    setStep('upload');
    setRawData([]);
    setCsvHeaders([]);
    setMapping({});
    setNewColumns([]);
    setFileName('');
    setImportResult(null);
    setCreatingColumns(false);
  }, []);

  // Load existing DB columns when dialog opens
  useEffect(() => {
    if (!open) return;
    const loadColumns = async () => {
      const { data, error } = await supabase.functions.invoke('manage-client-columns', {
        body: { action: 'list' },
      });
      if (!error && data?.columns) {
        setDbColumns(data.columns as DbColumn[]);
      }
    };
    loadColumns();
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'txt'].includes(ext || '')) {
      toast.error('Formato não suportado. Use arquivos .csv');
      return;
    }

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parse warnings:', results.errors);
        }
        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          toast.error('Arquivo vazio ou sem dados válidos');
          return;
        }
        const headers = Object.keys(data[0]);
        setCsvHeaders(headers);
        setRawData(data);

        // Auto-map columns by similarity
        const autoMap: ColumnMapping = {};
        const existingNames = dbColumns.map(c => c.column_name);

        for (const h of headers) {
          const lower = h.toLowerCase().trim();
          // Try exact match first
          const sanitized = sanitizeColumnName(h);
          if (existingNames.includes(sanitized)) {
            autoMap[h] = sanitized;
            continue;
          }
          // Heuristics for known columns
          if (lower.includes('url') || lower.includes('link') || lower.includes('site') || lower.includes('dominio') || lower.includes('domínio')) {
            autoMap[h] = 'client_url';
          } else if (lower.includes('nome') || lower.includes('name') || lower.includes('cliente') || lower.includes('client')) {
            autoMap[h] = 'client_name';
          } else if (lower.includes('fidelidade') || lower.includes('loyalty') || lower.includes('indice') || lower.includes('índice') || lower.includes('index')) {
            autoMap[h] = 'loyalty_index';
          }
        }
        setMapping(autoMap);
        setStep('mapping');
        toast.success(`${data.length} registros encontrados`);
      },
      error: (err) => {
        toast.error(`Erro ao ler arquivo: ${err.message}`);
      },
    });
  };

  const handleMappingNext = () => {
    // Detect unmapped CSV headers (not mapped to any existing DB column)
    const mappedHeaders = Object.keys(mapping).filter(k => mapping[k]);
    const unmappedHeaders = csvHeaders.filter(h => !mappedHeaders.includes(h));

    if (unmappedHeaders.length > 0) {
      setNewColumns(
        unmappedHeaders.map(h => ({
          csvHeader: h,
          dbName: sanitizeColumnName(h),
          approved: false,
        }))
      );
      setStep('new_columns');
    } else {
      setStep('preview');
    }
  };

  const handleApproveColumns = async () => {
    const approved = newColumns.filter(nc => nc.approved);
    if (approved.length === 0) {
      // No new columns to create, just go to preview
      setStep('preview');
      return;
    }

    setCreatingColumns(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-client-columns', {
        body: {
          action: 'create',
          columns: approved.map(nc => ({ name: nc.dbName, type: 'text' })),
        },
      });

      if (error) {
        toast.error('Erro ao criar colunas: ' + error.message);
        setCreatingColumns(false);
        return;
      }

      const results = data?.results || [];
      const failed = results.filter((r: any) => !r.success);
      if (failed.length > 0) {
        toast.warning(`${failed.length} coluna(s) não puderam ser criadas`);
      }

      // Add approved columns to mapping
      const newMapping = { ...mapping };
      for (const nc of approved) {
        const result = results.find((r: any) => r.db_name === nc.dbName);
        if (result?.success) {
          newMapping[nc.csvHeader] = nc.dbName;
        }
      }
      setMapping(newMapping);

      // Refresh DB columns
      const { data: colData } = await supabase.functions.invoke('manage-client-columns', { body: { action: 'list' } });
      if (colData?.columns) {
        setDbColumns(colData.columns as DbColumn[]);
      }

      toast.success(`${approved.length - failed.length} coluna(s) criada(s) com sucesso`);
      setStep('preview');
    } catch (err: any) {
      toast.error('Erro ao criar colunas: ' + err.message);
    } finally {
      setCreatingColumns(false);
    }
  };

  const getMappedData = () => {
    return rawData.map(row => {
      const mapped: Record<string, any> = {};
      for (const [csvHeader, dbCol] of Object.entries(mapping)) {
        if (!dbCol) continue;
        const val = (row[csvHeader] || '').trim();
        if (dbCol === 'loyalty_index') {
          mapped[dbCol] = val ? parseInt(val) || null : null;
        } else {
          mapped[dbCol] = val || null;
        }
      }
      return mapped;
    }).filter(row => row.client_url && String(row.client_url).length > 0);
  };

  const mappedData = getMappedData();

  const handleImport = async () => {
    if (mappedData.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setStep('importing');
    let success = 0;
    let errors = 0;

    const chunks = [];
    for (let i = 0; i < mappedData.length; i += 50) {
      chunks.push(mappedData.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const { error } = await supabase.from('clients' as any).upsert(
        chunk,
        { onConflict: 'client_url' }
      ) as any;

      if (error) {
        console.error('Import error:', error);
        errors += chunk.length;
      } else {
        success += chunk.length;
      }
    }

    setImportResult({ success, errors });
    if (errors === 0) {
      toast.success(`${success} clientes importados com sucesso!`);
      onSuccess();
    } else {
      toast.warning(`${success} importados, ${errors} com erro`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Base de Clientes
          </DialogTitle>
          <DialogDescription>
            Importe um arquivo CSV com os dados dos clientes. Registros com URL duplicada serão atualizados.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {['Upload', 'Mapeamento', 'Novas Colunas', 'Preview', 'Importar'].map((label, i) => {
            const steps = ['upload', 'mapping', 'new_columns', 'preview', 'importing'];
            const currentIdx = steps.indexOf(step);
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={label} className="flex items-center gap-1">
                {i > 0 && <span className="text-border">›</span>}
                <span className={isActive ? 'font-bold text-primary' : isDone ? 'text-success' : ''}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Arraste um arquivo CSV ou clique para selecionar</p>
              <Label htmlFor="csv-upload">
                <Button variant="outline" size="sm" asChild>
                  <span>Selecionar Arquivo</span>
                </Button>
              </Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Formato aceito: CSV (separado por vírgula ou ponto e vírgula). Colunas extras serão detectadas automaticamente.
            </p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="outline">{rawData.length} registros</Badge>
            </div>

            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Mapeamento de colunas</p>
                {csvHeaders.map(header => (
                  <div key={header} className="flex items-center gap-3">
                    <span className="text-sm w-44 shrink-0 truncate" title={header}>
                      {header}
                    </span>
                    <Select
                      value={mapping[header] || '__none__'}
                      onValueChange={v => setMapping(prev => ({ ...prev, [header]: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue placeholder="Selecionar coluna..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não mapear —</SelectItem>
                        {mappableDbColumns.map(col => (
                          <SelectItem key={col.column_name} value={col.column_name}>
                            {col.column_name} ({col.data_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {!Object.values(mapping).includes('client_url') && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                A coluna "client_url" precisa ser mapeada (obrigatória)
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button
                size="sm"
                disabled={!Object.values(mapping).includes('client_url')}
                onClick={handleMappingNext}
              >
                Avançar
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'new_columns' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Columns className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Novas colunas detectadas</p>
                <p className="text-xs text-muted-foreground">
                  Estas colunas do CSV não existem no banco. Selecione quais deseja criar:
                </p>
              </div>
            </div>

            <ScrollArea className="max-h-[350px]">
              <div className="space-y-2">
                {newColumns.map((nc, i) => (
                  <div
                    key={nc.csvHeader}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      nc.approved ? 'border-primary/40 bg-primary/5' : 'border-border'
                    }`}
                  >
                    <Checkbox
                      checked={nc.approved}
                      onCheckedChange={(checked) => {
                        setNewColumns(prev => prev.map((item, idx) =>
                          idx === i ? { ...item, approved: !!checked } : item
                        ));
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{nc.csvHeader}</span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <Badge variant="outline" className="text-[10px] font-mono">{nc.dbName}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Será criada como coluna do tipo TEXT
                      </p>
                    </div>
                    <Plus className={`h-4 w-4 ${nc.approved ? 'text-primary' : 'text-muted-foreground/30'}`} />
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="text-xs text-muted-foreground">
              {newColumns.filter(nc => nc.approved).length} de {newColumns.length} coluna(s) selecionada(s)
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button size="sm" onClick={handleApproveColumns} disabled={creatingColumns}>
                {creatingColumns ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Criando colunas...
                  </>
                ) : (
                  <>
                    Avançar
                    {newColumns.filter(nc => nc.approved).length > 0 && (
                      <span className="ml-1">({newColumns.filter(nc => nc.approved).length} novas)</span>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Pré-visualização</p>
              <Badge>{mappedData.length} registros válidos</Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-lg max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead className="text-[11px] uppercase tracking-wider">#</TableHead>
                    {Object.entries(mapping).filter(([, v]) => v).map(([csvH, dbCol]) => (
                      <TableHead key={csvH} className="text-[11px] uppercase tracking-wider">{dbCol}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedData.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      {Object.entries(mapping).filter(([, v]) => v).map(([, dbCol]) => (
                        <TableCell key={dbCol} className="text-xs truncate max-w-[180px]">
                          {row[dbCol] ?? '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {mappedData.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ...e mais {mappedData.length - 50} registros
                </p>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('mapping')}>Voltar</Button>
              <Button size="sm" onClick={handleImport}>
                <Upload className="h-4 w-4 mr-1" />
                Importar {mappedData.length} registros
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            {!importResult ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Importando {mappedData.length} registros...</p>
              </>
            ) : (
              <>
                <CheckCircle className="h-10 w-10 text-success" />
                <p className="text-lg font-bold text-foreground">{importResult.success} importados</p>
                {importResult.errors > 0 && (
                  <p className="text-sm text-destructive">{importResult.errors} com erro</p>
                )}
                <Button size="sm" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
