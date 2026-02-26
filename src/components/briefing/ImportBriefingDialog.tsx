import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IMAGE_TYPE_LABELS } from '@/types/briefing';
import mammoth from 'mammoth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Upload, FileText, Loader2, Check, AlertCircle, CalendarIcon } from 'lucide-react';

interface ParsedImage {
  image_type: string;
  product_name: string;
  image_text: string;
  font_suggestion: string;
  element_suggestion: string;
  professional_photo_url: string;
  orientation: string;
  observations: string;
}

interface ParsedBriefing {
  platform_url: string;
  brand_drive_link: string;
  has_trail: boolean;
  has_challenge: boolean;
  has_community: boolean;
  images: ParsedImage[];
}

type Step = 'upload' | 'parsing' | 'duplicate' | 'preview' | 'saving' | 'done' | 'error';

interface Props {
  onImported: () => void;
}

export default function ImportBriefingDialog({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedBriefing | null>(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<{ date: string; imageCount: number } | null>(null);
  const [receivedAt, setReceivedAt] = useState<Date>(new Date());
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setParsed(null);
    setFileName('');
    setErrorMsg('');
    setDuplicateInfo(null);
    setReceivedAt(new Date());
  };

  const extractText = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }
    // For other files, read as text
    return await file.text();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setStep('parsing');

    try {
      const text = await extractText(file);

      if (!text || text.trim().length < 50) {
        throw new Error('Não foi possível extrair texto suficiente do documento. Para PDFs, use o formato DOCX.');
      }

      const response = await supabase.functions.invoke('parse-briefing', {
        body: { documentText: text },
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao processar');

      const data = response.data?.data;
      if (!data || !data.platform_url) {
        throw new Error('Não foi possível extrair os dados do briefing');
      }

      // Check for duplicate by platform_url
      const { data: existing } = await (supabase
        .from('briefing_requests')
        .select('id, created_at, briefing_images:briefing_images(id)')
        .eq('platform_url', data.platform_url) as any)
        .order('created_at', { ascending: false })
        .limit(1);

      setParsed(data);

      if (existing && existing.length > 0) {
        setDuplicateInfo({
          date: new Date(existing[0].created_at).toLocaleDateString('pt-BR'),
          imageCount: existing[0].briefing_images?.length || 0,
        });
        setStep('duplicate');
      } else {
        setStep('preview');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      setErrorMsg(err.message || 'Erro ao importar documento');
      setStep('error');
    }

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSave = async () => {
    if (!parsed) return;
    setStep('saving');

    try {
      const { data: request, error } = await supabase.from('briefing_requests').insert({
        requester_name: 'Importado via documento',
        requester_email: 'importado@curseduca.com',
        platform_url: parsed.platform_url,
        has_trail: parsed.has_trail,
        has_challenge: parsed.has_challenge,
        has_community: parsed.has_community,
        brand_drive_link: parsed.brand_drive_link || null,
        received_at: receivedAt.toISOString(),
      } as any).select('id').single();

      if (error) throw error;
      const requestId = (request as any).id;

      for (let i = 0; i < parsed.images.length; i++) {
        const img = parsed.images[i];
        const { error: imgError } = await supabase.from('briefing_images').insert({
          request_id: requestId,
          image_type: img.image_type,
          sort_order: i,
          product_name: img.product_name || null,
          image_text: img.image_text || null,
          font_suggestion: img.font_suggestion || null,
          element_suggestion: img.element_suggestion || null,
          professional_photo_url: img.professional_photo_url || null,
          orientation: img.orientation || null,
          observations: img.observations || null,
        } as any);
        if (imgError) throw imgError;
      }

      setStep('done');
      toast.success('Briefing importado com sucesso!');
      onImported();
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'Erro ao salvar');
      setStep('error');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Importar Briefing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Briefing de Documento</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Selecione o documento de briefing</p>
              <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .docx</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".docx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" /> Selecionar arquivo
            </Button>
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Analisando documento...</p>
              <p className="text-sm text-muted-foreground mt-1">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-2">Extraindo dados com IA</p>
            </div>
          </div>
        )}

        {step === 'duplicate' && parsed && duplicateInfo && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-medium">Documento já importado</p>
              <p className="text-sm text-muted-foreground">
                Um briefing para <span className="font-medium text-foreground">{parsed.platform_url}</span> já foi importado em {duplicateInfo.date} com {duplicateInfo.imageCount} arte(s).
              </p>
              <p className="text-sm text-muted-foreground">Deseja importar novamente mesmo assim?</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button variant="default" onClick={() => setStep('preview')}>Importar mesmo assim</Button>
            </div>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Plataforma:</span> <span className="font-medium">{parsed.platform_url}</span></div>
                  <div><span className="text-muted-foreground">Identidade visual:</span> <span className="font-medium">{parsed.brand_drive_link || '—'}</span></div>
                </div>
                <div className="flex gap-2 mt-2">
                  {parsed.has_trail && <Badge variant="secondary">Trilha</Badge>}
                  {parsed.has_challenge && <Badge variant="secondary">Desafio</Badge>}
                  {parsed.has_community && <Badge variant="secondary">Comunidade</Badge>}
                </div>
                <Separator />
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Data de recebimento do arquivo</Label>
                  <p className="text-xs text-muted-foreground">O SLA de 7 dias será contado a partir desta data.</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !receivedAt && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {receivedAt ? format(receivedAt, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={receivedAt}
                        onSelect={(d) => d && setReceivedAt(d)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {(() => {
                    const diff = Math.floor((new Date().getTime() - receivedAt.getTime()) / (1000 * 60 * 60 * 24));
                    if (diff >= 7) {
                      return (
                        <p className="text-xs text-destructive font-medium flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" /> SLA excedido — {diff} dias desde o recebimento
                        </p>
                      );
                    }
                    return (
                      <p className="text-xs text-muted-foreground mt-1">
                        {7 - diff} dia(s) restante(s) no SLA
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">{parsed.images.length} arte(s) encontrada(s)</h3>
              <div className="space-y-3">
                {parsed.images.map((img, idx) => (
                  <Card key={idx}>
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type}
                        </Badge>
                        {img.product_name && <span className="text-sm font-medium">{img.product_name}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                        {img.image_text && <div><span className="font-medium text-foreground">Texto:</span> {img.image_text}</div>}
                        {img.font_suggestion && <div><span className="font-medium text-foreground">Fonte:</span> {img.font_suggestion}</div>}
                        {img.element_suggestion && <div className="col-span-2"><span className="font-medium text-foreground">Elemento:</span> {img.element_suggestion}</div>}
                        {img.orientation && <div><span className="font-medium text-foreground">Orientação:</span> {img.orientation}</div>}
                        {img.observations && <div className="col-span-2"><span className="font-medium text-foreground">Obs:</span> {img.observations}</div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleSave} className="gap-2">
                <Check className="h-4 w-4" /> Confirmar e Importar
              </Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">Salvando briefing...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <p className="font-medium">Briefing importado com sucesso!</p>
            <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>Fechar</Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="font-medium">Erro na importação</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={reset}>Tentar novamente</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
