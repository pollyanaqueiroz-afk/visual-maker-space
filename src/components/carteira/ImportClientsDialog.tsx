import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface ImportClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ColumnMapping = {
  client_url: string;
  client_name: string;
  loyalty_index: string;
};

const DB_FIELDS = [
  { key: 'client_url', label: 'URL do Cliente', required: true },
  { key: 'client_name', label: 'Nome do Cliente', required: false },
  { key: 'loyalty_index', label: 'Índice de Fidelidade', required: false },
] as const;

export default function ImportClientsDialog({ open, onOpenChange, onSuccess }: ImportClientsDialogProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ client_url: '', client_name: '', loyalty_index: '' });
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setRawData([]);
    setCsvHeaders([]);
    setMapping({ client_url: '', client_name: '', loyalty_index: '' });
    setFileName('');
    setImportResult(null);
  }, []);

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

        // Auto-map columns by name similarity
        const autoMap: ColumnMapping = { client_url: '', client_name: '', loyalty_index: '' };
        for (const h of headers) {
          const lower = h.toLowerCase().trim();
          if (!autoMap.client_url && (lower.includes('url') || lower.includes('link') || lower.includes('site') || lower.includes('dominio') || lower.includes('domínio'))) {
            autoMap.client_url = h;
          }
          if (!autoMap.client_name && (lower.includes('nome') || lower.includes('name') || lower.includes('cliente') || lower.includes('client'))) {
            autoMap.client_name = h;
          }
          if (!autoMap.loyalty_index && (lower.includes('fidelidade') || lower.includes('loyalty') || lower.includes('indice') || lower.includes('índice') || lower.includes('index'))) {
            autoMap.loyalty_index = h;
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

  const mappedData = rawData.map(row => ({
    client_url: mapping.client_url ? (row[mapping.client_url] || '').trim() : '',
    client_name: mapping.client_name ? (row[mapping.client_name] || '').trim() : null,
    loyalty_index: mapping.loyalty_index ? parseInt(row[mapping.loyalty_index]) || null : null,
  })).filter(row => row.client_url.length > 0);

  const handleImport = async () => {
    if (mappedData.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setStep('importing');
    let success = 0;
    let errors = 0;

    // Batch upsert in chunks of 50
    const chunks = [];
    for (let i = 0; i < mappedData.length; i += 50) {
      chunks.push(mappedData.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const { error } = await supabase.from('clients' as any).upsert(
        chunk.map(row => ({
          client_url: row.client_url,
          client_name: row.client_name,
          loyalty_index: row.loyalty_index,
        })),
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
              Formato aceito: CSV (separado por vírgula ou ponto e vírgula). Colunas esperadas: URL, Nome, Fidelidade.
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

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Mapeamento de colunas</p>
              {DB_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <span className="text-sm w-40 shrink-0">
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </span>
                  <Select
                    value={mapping[field.key as keyof ColumnMapping]}
                    onValueChange={v => setMapping(prev => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))}
                  >
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue placeholder="Selecionar coluna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Não mapear —</SelectItem>
                      {csvHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!mapping.client_url && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                A coluna "URL do Cliente" é obrigatória
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={reset}>Voltar</Button>
              <Button
                size="sm"
                disabled={!mapping.client_url}
                onClick={() => setStep('preview')}
              >
                Pré-visualizar ({mappedData.length} registros)
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
                    <TableHead className="text-[11px] uppercase tracking-wider">URL</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider">Nome</TableHead>
                    <TableHead className="text-center text-[11px] uppercase tracking-wider">Fidelidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedData.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium truncate max-w-[200px]">{row.client_url}</TableCell>
                      <TableCell className="text-xs">{row.client_name || '—'}</TableCell>
                      <TableCell className="text-center text-xs">{row.loyalty_index ?? '—'}</TableCell>
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
