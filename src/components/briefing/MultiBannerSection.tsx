import { Button } from '@/components/ui/button';
import { ImageBriefingFormData, defaultImageBriefing } from '@/types/briefing';
import ImageBriefingSection from './ImageBriefingSection';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  itemLabel: string;
  items: ImageBriefingFormData[];
  onChange: (items: ImageBriefingFormData[]) => void;
  showOrientation?: boolean;
  showProductName?: boolean;
}

export default function MultiBannerSection({ title, description, itemLabel, items, onChange, showOrientation, showProductName }: Props) {
  const add = () => onChange([...items, { ...defaultImageBriefing, enabled: true }]);
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx: number, data: ImageBriefingFormData) => {
    const updated = [...items];
    updated[idx] = data;
    onChange(updated);
  };
  const copyFromPrevious = (idx: number) => {
    if (idx <= 0) return;
    const prev = items[idx - 1];
    const updated = [...items];
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground">
            {description} — Total: {items.length} {items.length === 1 ? itemLabel : `${itemLabel}s`}
          </p>
        </div>
        <Button type="button" onClick={add} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="relative">
          <ImageBriefingSection
            title={`${itemLabel} ${idx + 1}${showProductName && item.product_name ? ` — ${item.product_name}` : ''}`}
            description={description}
            data={{ ...item, enabled: true }}
            onChange={d => update(idx, d)}
            showOrientation={showOrientation}
            showProductName={showProductName}
            showCopyPrevious={idx > 0}
            onCopyPrevious={() => copyFromPrevious(idx)}
            required
          />
          {items.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-destructive hover:text-destructive"
              onClick={() => remove(idx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <p>Nenhum {itemLabel.toLowerCase()} adicionado</p>
          <Button type="button" onClick={add} variant="outline" size="sm" className="mt-2">
            <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro {itemLabel.toLowerCase()}
          </Button>
        </div>
      )}
    </div>
  );
}
