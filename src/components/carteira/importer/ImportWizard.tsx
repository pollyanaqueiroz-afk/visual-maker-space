import { useState, useCallback, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Upload, FileSpreadsheet, Link, Loader2, CheckCircle, AlertTriangle, ArrowLeft, ArrowRight,
  ChevronDown, RotateCcw, Wand2, Eye, Filter, Download, Send, Check, X,
} from 'lucide-react';
import {
  type WizardStep, type MappedColumn, type ColumnDataType, type ColumnDefinition,
  WIZARD_STEPS, CURSEDUCA_TEMPLATE, DATA_TYPE_LABELS,
  validateValue, autoDetectType, similarityScore,
} from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function ImportWizard({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappedColumns, setMappedColumns] = useState<MappedColumn[]>([]);
  const [fileName, setFileName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const ROWS_PER_PAGE = 50;

  const reset = useCallback(() => {
    setStep('upload');
    setRawData([]);
    setCsvHeaders([]);
    setMappedColumns([]);
    setFileName('');
    setSheetUrl('');
    setLoadingSheet(false);
    setImporting(false);
    setImportResult(null);
    setPreviewPage(0);
    setShowOnlyErrors(false);
    setEditingCell(null);
  }, []);

  const stepIdx = WIZARD_STEPS.findIndex(s => s.key === step);

  // ─── Auto-map headers to template ───
  const autoMap = useCallback((headers: string[]) => {
    const mapped: MappedColumn[] = headers.map(h => {
      let bestMatch: ColumnDefinition | null = null;
      let bestScore = 0;
      for (const col of CURSEDUCA_TEMPLATE) {
        const s1 = similarityScore(h, col.label);
        const s2 = similarityScore(h, col.dbKey);
        const score = Math.max(s1, s2);
        if (score > bestScore && score > 0.5) {
          bestScore = score;
          bestMatch = col;
        }
      }
      if (bestMatch) {
        return {
          csvHeader: h,
          dbKey: bestMatch.dbKey,
          label: bestMatch.label,
          type: bestMatch.type,
          enumValues: bestMatch.enumValues,
          ignored: false,
        };
      }
      return {
        csvHeader: h,
        dbKey: '',
        label: h,
        type: 'texto' as ColumnDataType,
        ignored: true,
      };
    });
    // Deduplicate dbKeys: if two headers map to the same dbKey, keep first
    const seen = new Set<string>();
    for (const m of mapped) {
      if (m.dbKey && seen.has(m.dbKey)) {
        m.dbKey = '';
        m.ignored = true;
      } else if (m.dbKey) {
        seen.add(m.dbKey);
      }
    }
    setMappedColumns(mapped);
  }, []);

  // ─── Parse file data ───
  const processParsedData = useCallback((data: Record<string, string>[], source: string) => {
    if (data.length === 0) {
      toast.error('Nenhum dado válido encontrado');
      return;
    }
    const headers = Object.keys(data[0]);
    setCsvHeaders(headers);
    setRawData(data);
    setFileName(source);
    autoMap(headers);
    setStep('mapping');
    toast.success(`${data.length} registros carregados de "${source}"`);
  }, [autoMap]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (['xlsx', 'xls'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
          // Convert all values to strings
          const strData = data.map(row => {
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(row)) {
              out[k] = v == null ? '' : String(v);
            }
            return out;
          });
          processParsedData(strData, file.name);
        } catch {
          toast.error('Erro ao ler arquivo Excel');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (['csv', 'txt'].includes(ext || '')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          processParsedData(results.data as Record<string, string>[], file.name);
        },
        error: (err) => toast.error(`Erro: ${err.message}`),
      });
    } else {
      toast.error('Formato não suportado. Use .xlsx, .xls ou .csv');
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      toast.error('Link inválido');
      return;
    }
    setLoadingSheet(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-google-sheet', {
        body: { url: sheetUrl.trim() },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || 'Erro');
        return;
      }
      const parsed = Papa.parse(data.csv, { header: true, skipEmptyLines: true });
      processParsedData(parsed.data as Record<string, string>[], 'Google Sheets');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setLoadingSheet(false);
    }
  };

  // ─── Validation ───
  const validationResults = useMemo(() => {
    const results: Record<string, { valid: number; invalid: number; errorRows: number[] }> = {};
    const activeCols = mappedColumns.filter(m => !m.ignored && m.dbKey);
    for (const col of activeCols) {
      let valid = 0, invalid = 0;
      const errorRows: number[] = [];
      rawData.forEach((row, i) => {
        const val = row[col.csvHeader] || '';
        if (validateValue(val, col.type, col.enumValues)) {
          valid++;
        } else {
          invalid++;
          errorRows.push(i);
        }
      });
      results[col.csvHeader] = { valid, invalid, errorRows };
    }
    return results;
  }, [rawData, mappedColumns]);

  const totalErrors = useMemo(() =>
    Object.values(validationResults).reduce((s, r) => s + r.invalid, 0),
    [validationResults]
  );

  const errorRows = useMemo(() => {
    const set = new Set<number>();
    Object.values(validationResults).forEach(r => r.errorRows.forEach(i => set.add(i)));
    return set;
  }, [validationResults]);

  // ─── Auto-detect types ───
  const handleAutoDetectTypes = () => {
    setMappedColumns(prev => prev.map(col => {
      if (col.ignored) return col;
      const values = rawData.slice(0, 200).map(r => r[col.csvHeader] || '');
      const detected = autoDetectType(values);
      return { ...col, type: detected.type, enumValues: detected.enumValues || col.enumValues };
    }));
    toast.success('Tipos auto-detectados');
  };

  const handleRestoreDefaults = () => {
    autoMap(csvHeaders);
    toast.success('Padrões restaurados');
  };

  // ─── Build import data ───
  const buildImportData = () => {
    const activeCols = mappedColumns.filter(m => !m.ignored && m.dbKey);
    return rawData.map((row, idx) => {
      const mapped: Record<string, any> = {};
      for (const col of activeCols) {
        const val = (row[col.csvHeader] || '').trim();
        mapped[col.dbKey] = val || null;
      }
      // client_url is required by DB — generate from client_name or index if missing
      if (!mapped.client_url || String(mapped.client_url).trim().length === 0) {
        if (mapped.client_name && String(mapped.client_name).trim().length > 0) {
          mapped.client_url = String(mapped.client_name).trim()
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        } else {
          mapped.client_url = `import-${Date.now()}-${idx}`;
        }
      }
      return mapped;
    }).filter(row => row.client_url && String(row.client_url).length > 0);
  };

  const handleImport = async () => {
    const data = buildImportData();
    if (data.length === 0) {
      toast.error('Nenhum registro válido');
      return;
    }
    setImporting(true);
    let success = 0, errors = 0;
    const chunks = [];
    for (let i = 0; i < data.length; i += 50) chunks.push(data.slice(i, i + 50));

    for (const chunk of chunks) {
      const { error } = await supabase.from('clients' as any).upsert(chunk, { onConflict: 'client_url' }) as any;
      if (error) { errors += chunk.length; } else { success += chunk.length; }
    }
    setImportResult({ success, errors });
    setImporting(false);
    if (errors === 0) {
      toast.success(`${success} clientes importados!`);
      onSuccess();
    } else {
      toast.warning(`${success} importados, ${errors} com erro`);
    }
  };

  const handleExportCSV = () => {
    const data = buildImportData();
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_validado.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const data = buildImportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_validado.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeCols = mappedColumns.filter(m => !m.ignored && m.dbKey);
  const hasClientUrl = activeCols.some(c => c.dbKey === 'client_url');

  // ─── Preview pagination ───
  const previewData = useMemo(() => {
    const rows = showOnlyErrors ? rawData.filter((_, i) => errorRows.has(i)) : rawData;
    return rows;
  }, [rawData, showOnlyErrors, errorRows]);

  const pagedData = previewData.slice(previewPage * ROWS_PER_PAGE, (previewPage + 1) * ROWS_PER_PAGE);
  const totalPages = Math.ceil(previewData.length / ROWS_PER_PAGE);

  // ─── Inline editing ───
  const handleCellEdit = (rowIdx: number, csvHeader: string, newValue: string) => {
    setRawData(prev => prev.map((row, i) => i === rowIdx ? { ...row, [csvHeader]: newValue } : row));
    setEditingCell(null);
  };

  // ─── RENDER ───
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importador de Dados — Carteira Geral
          </DialogTitle>
          <DialogDescription>
            Importe dados de Excel (.xlsx/.xls), CSV ou Google Sheets
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 py-2 border-b mb-2">
          {WIZARD_STEPS.map((s, i) => {
            const isActive = i === stepIdx;
            const isDone = i < stepIdx;
            return (
              <div key={s.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-border mx-1">›</span>}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : isDone ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {isDone && <Check className="h-3 w-3" />}
                  <span>{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ═══ STEP 1: UPLOAD ═══ */}
          {step === 'upload' && (
            <div className="flex flex-col gap-6 py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium"><Link className="h-4 w-4 text-primary" /> Importar do Google Sheets</div>
                <div className="flex gap-2">
                  <Input placeholder="Cole o link da planilha..." value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} className="flex-1 h-9 text-sm" />
                  <Button size="sm" onClick={handleGoogleSheetImport} disabled={loadingSheet || !sheetUrl.trim()}>
                    {loadingSheet ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Importar'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">A planilha precisa estar compartilhada como "Qualquer pessoa com o link pode ver".</p>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
              </div>

              <div className="w-full border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-1">Arraste ou selecione um arquivo</p>
                <p className="text-xs text-muted-foreground mb-3">.xlsx, .xls, .csv (até 10.000 linhas)</p>
                <Label htmlFor="file-upload">
                  <Button variant="outline" size="sm" asChild><span>Selecionar Arquivo</span></Button>
                </Label>
                <Input id="file-upload" type="file" accept=".xlsx,.xls,.csv,.txt" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
          )}

          {/* ═══ STEP 2: MAPPING ═══ */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="outline">{rawData.length} registros</Badge>
                <Badge variant="outline">{csvHeaders.length} colunas</Badge>
              </div>

              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2">
                  {mappedColumns.map((col, idx) => (
                    <div key={col.csvHeader} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                      col.ignored ? 'border-border bg-muted/30 opacity-60' : 'border-primary/20 bg-primary/5'
                    }`}>
                      <Checkbox
                        checked={!col.ignored}
                        onCheckedChange={(checked) => {
                          setMappedColumns(prev => prev.map((m, i) => i === idx ? { ...m, ignored: !checked } : m));
                        }}
                      />
                      <span className="text-sm w-40 shrink-0 truncate font-medium" title={col.csvHeader}>{col.csvHeader}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <Select
                        value={col.dbKey || '__none__' }
                        onValueChange={(v) => {
                          const target = v === '__none__' ? '' : v;
                          const tmpl = CURSEDUCA_TEMPLATE.find(t => t.dbKey === target);
                          setMappedColumns(prev => prev.map((m, i) =>
                            i === idx ? {
                              ...m,
                              dbKey: target,
                              label: tmpl?.label || col.csvHeader,
                              type: tmpl?.type || 'texto',
                              enumValues: tmpl?.enumValues,
                              ignored: !target,
                            } : m
                          ));
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Selecionar campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Não mapear —</SelectItem>
                          {CURSEDUCA_TEMPLATE.map(t => (
                            <SelectItem key={t.dbKey} value={t.dbKey}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {!hasClientUrl && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  A coluna "URL do Cliente" precisa ser mapeada (obrigatória)
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 3: DATA TYPES ═══ */}
          {step === 'types' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={handleAutoDetectTypes} className="gap-1.5">
                  <Wand2 className="h-3.5 w-3.5" /> Auto-detectar tipos
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRestoreDefaults} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrões
                </Button>
              </div>

              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Campo</TableHead>
                      <TableHead className="text-xs">Tipo de Dado</TableHead>
                      <TableHead className="text-xs">Amostra</TableHead>
                      <TableHead className="text-xs text-right">Validação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeCols.map((col, idx) => {
                      const samples = rawData.slice(0, 5).map(r => r[col.csvHeader] || '').filter(Boolean);
                      const vr = validationResults[col.csvHeader];
                      return (
                        <TableRow key={col.csvHeader}>
                          <TableCell className="text-xs font-medium">{col.label}</TableCell>
                          <TableCell>
                            <Select
                              value={col.type}
                              onValueChange={(v) => {
                                const newType = v as ColumnDataType;
                                setMappedColumns(prev => prev.map(m => {
                                  if (m.csvHeader !== col.csvHeader) return m;
                                  // Auto-detect enum values when switching to enum
                                  let enumValues = m.enumValues;
                                  if (newType === 'enum' && !enumValues?.length) {
                                    const unique = [...new Set(rawData.map(r => (r[col.csvHeader] || '').trim()).filter(Boolean))];
                                    enumValues = unique.slice(0, 50);
                                  }
                                  return { ...m, type: newType, enumValues };
                                }));
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(DATA_TYPE_LABELS).map(([k, label]) => (
                                  <SelectItem key={k} value={k}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {samples.slice(0, 3).map((s, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] max-w-[120px] truncate font-normal">{s}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {vr && (
                              <div className="flex items-center justify-end gap-2 text-xs">
                                <span className="text-primary">{vr.valid} ✓</span>
                                {vr.invalid > 0 && <span className="text-destructive">{vr.invalid} ✗</span>}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* ═══ STEP 4: PREVIEW ═══ */}
          {step === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <Badge variant="outline">{rawData.length} linhas</Badge>
                <Badge variant="outline">{rawData.length - errorRows.size} válidas</Badge>
                {errorRows.size > 0 && <Badge variant="destructive">{errorRows.size} com erros</Badge>}
                <Button variant="ghost" size="sm" onClick={() => setShowOnlyErrors(!showOnlyErrors)} className="text-xs gap-1 h-7">
                  <Filter className="h-3 w-3" />
                  {showOnlyErrors ? 'Mostrar todos' : 'Somente erros'}
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="min-w-[1200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] w-10">#</TableHead>
                          {activeCols.map(col => (
                            <TableHead key={col.csvHeader} className="text-[10px] whitespace-nowrap">
                              {col.label}
                              {validationResults[col.csvHeader]?.invalid > 0 && (
                                <span className="text-destructive ml-1">({validationResults[col.csvHeader].invalid})</span>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedData.map((row, ri) => {
                          const realIdx = showOnlyErrors
                            ? [...errorRows][ri] ?? ri
                            : previewPage * ROWS_PER_PAGE + ri;
                          const hasError = errorRows.has(realIdx);
                          return (
                            <TableRow key={realIdx} className={hasError ? 'bg-destructive/5' : ''}>
                              <TableCell className="text-[10px] text-muted-foreground">{realIdx + 1}</TableCell>
                              {activeCols.map(col => {
                                const val = row[col.csvHeader] || '';
                                const isInvalid = val && !validateValue(val, col.type, col.enumValues);
                                const isEditing = editingCell?.row === realIdx && editingCell?.col === col.csvHeader;
                                return (
                                  <TableCell
                                    key={col.csvHeader}
                                    className={`text-[11px] max-w-[200px] truncate cursor-pointer ${isInvalid ? 'bg-destructive/10 text-destructive' : ''}`}
                                    onClick={() => setEditingCell({ row: realIdx, col: col.csvHeader })}
                                  >
                                    {isEditing ? (
                                      <Input
                                        defaultValue={val}
                                        autoFocus
                                        className="h-6 text-[11px] px-1"
                                        onBlur={(e) => handleCellEdit(realIdx, col.csvHeader, e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleCellEdit(realIdx, col.csvHeader, (e.target as HTMLInputElement).value);
                                          if (e.key === 'Escape') setEditingCell(null);
                                        }}
                                      />
                                    ) : (
                                      val || <span className="text-muted-foreground">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 text-xs">
                  <Button variant="ghost" size="sm" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>Anterior</Button>
                  <span className="text-muted-foreground">Página {previewPage + 1} de {totalPages}</span>
                  <Button variant="ghost" size="sm" disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 5: CONFIRM ═══ */}
          {step === 'confirm' && (
            <div className="space-y-6 py-4">
              {!importResult ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold text-primary">{buildImportData().length}</p>
                      <p className="text-xs text-muted-foreground">Registros para importar</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <p className="text-3xl font-bold">{activeCols.length}</p>
                      <p className="text-xs text-muted-foreground">Colunas mapeadas</p>
                    </div>
                  </div>

                  {totalErrors > 0 && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                      <AlertTriangle className="h-4 w-4" />
                      {totalErrors} erros de validação encontrados. Dados serão importados mesmo assim.
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Exportar dados validados:</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-1.5">
                        <Download className="h-3.5 w-3.5" /> JSON
                      </Button>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handleImport}
                    disabled={importing || buildImportData().length === 0}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {importing ? 'Importando...' : 'Confirmar Importação'}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-4 py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-primary" />
                  <div>
                    <p className="text-lg font-bold">{importResult.success} registros importados</p>
                    {importResult.errors > 0 && (
                      <p className="text-sm text-destructive">{importResult.errors} erros</p>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step !== 'upload' && step !== 'confirm' && (
          <DialogFooter className="gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => {
              const prev = WIZARD_STEPS[stepIdx - 1];
              if (prev) setStep(prev.key);
            }} className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
            <Button
              size="sm"
              disabled={step === 'mapping' && !hasClientUrl}
              onClick={() => {
                const next = WIZARD_STEPS[stepIdx + 1];
                if (next) setStep(next.key);
              }}
              className="gap-1.5"
            >
              Avançar <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
