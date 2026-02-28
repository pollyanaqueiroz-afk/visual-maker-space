import { Button } from '@/components/ui/button';
import { ImageBriefingFormData, defaultImageBriefing } from '@/types/briefing';
import ImageBriefingSection from './ImageBriefingSection';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  covers: ImageBriefingFormData[];
  onChange: (covers: ImageBriefingFormData[]) => void;
}

export default function ProductCoversSection({ covers, onChange }: Props) {
  const addCover = () => {
    onChange([...covers, { ...defaultImageBriefing, enabled: true }]);
  };

  const removeCover = (idx: number) => {
    onChange(covers.filter((_, i) => i !== idx));
  };

  const updateCover = (idx: number, data: ImageBriefingFormData) => {
    const updated = [...covers];
    updated[idx] = data;
    onChange(updated);
  };

  const copyFromPrevious = (idx: number) => {
    if (idx <= 0) return;
    const prev = covers[idx - 1];
    const updated = [...covers];
    updated[idx] = {
      ...updated[idx],
      font_suggestion: prev.font_suggestion,
      element_suggestion: prev.element_suggestion,
      orientation: prev.orientation,
    };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b mb-2">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Capas de Produto / Módulo</h2>
          <p className="text-sm text-muted-foreground">
            Adicione uma capa para cada produto. Total: {covers.length} {covers.length === 1 ? 'capa' : 'capas'}
          </p>
        </div>
        <Button type="button" onClick={addCover} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {covers.map((cover, idx) => (
        <div key={idx} className="relative">
          <ImageBriefingSection
            title={`Capa ${idx + 1}${cover.product_name ? ` — ${cover.product_name}` : ''}`}
            description="Imagem que ficará visível na vitrine"
            data={{ ...cover, enabled: true }}
            onChange={d => updateCover(idx, d)}
            showOrientation
            showProductName
            showCopyPrevious={idx > 0}
            onCopyPrevious={() => copyFromPrevious(idx)}
            required
          />
          {covers.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-destructive hover:text-destructive"
              onClick={() => removeCover(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {covers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <p>Nenhuma capa adicionada</p>
          <Button type="button" onClick={addCover} variant="outline" size="sm" className="mt-2">
            <Plus className="h-4 w-4 mr-1" /> Adicionar primeira capa
          </Button>
        </div>
      )}

      {covers.length >= 3 && (
        <div className="sticky bottom-4 z-10 flex justify-center">
          <Button
            type="button"
            onClick={addCover}
            size="default"
            className="shadow-lg gap-2"
          >
            <Plus className="h-4 w-4" /> Adicionar mais capas ({covers.length})
          </Button>
        </div>
      )}
    </div>
  );
}
