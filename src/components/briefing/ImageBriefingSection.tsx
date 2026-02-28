import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { ImageBriefingFormData, IMAGE_DIMENSIONS } from '@/types/briefing';
import { Upload, X, Image as ImageIcon, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  title: string;
  description: string;
  data: ImageBriefingFormData;
  onChange: (data: ImageBriefingFormData) => void;
  showOrientation?: boolean;
  showProductName?: boolean;
  showCopyPrevious?: boolean;
  onCopyPrevious?: () => void;
  required?: boolean;
}

export default function ImageBriefingSection({
  title,
  description,
  data,
  onChange,
  showOrientation,
  showProductName,
  showCopyPrevious,
  onCopyPrevious,
  required = false,
}: Props) {
  const update = (updates: Partial<ImageBriefingFormData>) => onChange({ ...data, ...updates });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newRefs = Array.from(files).map(file => ({ file, is_exact_use: false }));
    update({ reference_images: [...data.reference_images, ...newRefs] });
    e.target.value = '';
  };

  const removeRef = (idx: number) => {
    update({ reference_images: data.reference_images.filter((_, i) => i !== idx) });
  };

  const toggleExact = (idx: number) => {
    const updated = [...data.reference_images];
    updated[idx] = { ...updated[idx], is_exact_use: !updated[idx].is_exact_use };
    update({ reference_images: updated });
  };

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {!required && (
            <Switch checked={data.enabled} onCheckedChange={v => update({ enabled: v })} />
          )}
        </div>

        {(data.enabled || required) && (
          <div className="space-y-4 pt-2">
            {showCopyPrevious && onCopyPrevious && (
              <Button
                type="button"
                variant="secondary"
                size="default"
                onClick={onCopyPrevious}
                className="gap-2 border-2 border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-medium shadow-sm"
              >
                <Copy className="h-4 w-4" />
                Copiar estilo / fonte da capa anterior
              </Button>
            )}

            {showProductName && (
              <div className="space-y-2">
                <Label>Nome do Produto/Módulo *</Label>
                <Input value={data.product_name || ''} onChange={e => update({ product_name: e.target.value })} placeholder="Ex: Módulo de Marketing" required />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Texto da imagem</Label>
                <Input value={data.image_text} onChange={e => update({ image_text: e.target.value })} placeholder="Texto que aparecerá na arte" />
              </div>
              <div className="space-y-2">
                <Label>Fonte sugerida</Label>
                <Input value={data.font_suggestion} onChange={e => update({ font_suggestion: e.target.value })} placeholder="Ex: Poppins, Neulis Cursive" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dimensão da imagem</Label>
              <Select value={data.dimension || ''} onValueChange={v => update({ dimension: v, custom_dimension: v === 'custom' ? data.custom_dimension : undefined })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a dimensão" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {IMAGE_DIMENSIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>
                      <span>{d.label}</span>
                      <span className="ml-2 text-muted-foreground text-xs">— {d.hint}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.dimension === 'custom' && (
                <Input value={data.custom_dimension || ''} onChange={e => update({ custom_dimension: e.target.value })} placeholder="Ex: 1200x300" className="mt-2" />
              )}
            </div>

            {showOrientation && (
              <div className="space-y-2">
                <Label>Orientação da capa *</Label>
                <Select value={data.orientation || ''} onValueChange={v => update({ orientation: v })} required>
                  <SelectTrigger className={!data.orientation ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione a orientação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
                {!data.orientation && (
                  <p className="text-xs text-destructive">Selecione a orientação da imagem</p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <Label>Elemento ou imagem sugerida</Label>
              <Textarea value={data.element_suggestion} onChange={e => update({ element_suggestion: e.target.value })} placeholder="Descreva o visual desejado, elementos gráficos, estilo..." rows={3} />
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground font-normal">Ou envie imagens / cole um link com referências</Label>
                <Input value={data.element_suggestion_url || ''} onChange={e => update({ element_suggestion_url: e.target.value })} placeholder="https://drive.google.com/... ou link com imagens" />
                <div className="flex flex-wrap gap-3">
                  {(data.element_suggestion_images || []).map((file, idx) => (
                    <div key={idx} className="relative group border rounded-lg p-2 flex flex-col items-center gap-1 w-32">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs truncate w-full text-center">{file.name}</span>
                      <button type="button" onClick={() => {
                        const updated = (data.element_suggestion_images || []).filter((_, i) => i !== idx);
                        update({ element_suggestion_images: updated });
                      }} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                  <Upload className="h-4 w-4" />
                  Adicionar imagem de elemento
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const current = data.element_suggestion_images || [];
                    update({ element_suggestion_images: [...current, ...Array.from(files)] });
                    e.target.value = '';
                  }} />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link foto do profissional (opcional)</Label>
              <Input value={data.professional_photo_url} onChange={e => update({ professional_photo_url: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>


            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={data.observations} onChange={e => update({ observations: e.target.value })} placeholder="Detalhes adicionais importantes..." rows={2} />
            </div>

            {/* Reference images */}
            <div className="space-y-3">
              <Label>Imagens de referência</Label>
              <div className="flex flex-wrap gap-3">
                {data.reference_images.map((ref, idx) => (
                  <div key={idx} className="relative group border rounded-lg p-2 flex flex-col items-center gap-1 w-32">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    <span className="text-xs truncate w-full text-center">{ref.file.name}</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <Checkbox checked={ref.is_exact_use} onCheckedChange={() => toggleExact(idx)} />
                      <span className="text-[10px] text-muted-foreground">{ref.is_exact_use ? 'Usar exatamente' : 'Referência'}</span>
                    </label>
                    <button type="button" onClick={() => removeRef(idx)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-primary hover:underline">
                <Upload className="h-4 w-4" />
                Adicionar imagem
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-xs text-muted-foreground">Marque "Usar exatamente" se a imagem deve ser usada como está, ou deixe como "Referência" se é apenas inspiração.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
