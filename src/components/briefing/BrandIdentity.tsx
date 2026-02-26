import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BriefingFormData } from '@/types/briefing';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useState } from 'react';

interface Props {
  data: BriefingFormData;
  onChange: (updates: Partial<BriefingFormData>) => void;
}

export default function BrandIdentity({ data, onChange }: Props) {
  const [driveWarning, setDriveWarning] = useState('');

  const handleDriveLinkChange = (link: string) => {
    onChange({ brand_drive_link: link });
    if (link && !link.includes('drive.google.com') && !link.includes('docs.google.com')) {
      setDriveWarning('Este não parece ser um link do Google Drive. Verifique se o link está correto.');
    } else if (link && !link.includes('sharing') && !link.includes('usp=sharing') && !link.includes('view')) {
      setDriveWarning('⚠️ Certifique-se de que o link esteja com acesso público habilitado. Vá em "Compartilhar" → "Qualquer pessoa com o link".');
    } else {
      setDriveWarning('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Identidade Visual</h2>
        <p className="text-sm text-muted-foreground">Envie o manual da marca ou compartilhe via Google Drive</p>
      </div>

      <div className="space-y-2">
        <Label>Arquivo de identidade visual</Label>
        <Input
          type="file"
          accept=".pdf,.ai,.psd,.png,.jpg,.svg,.zip"
          onChange={e => onChange({ brand_file: e.target.files?.[0] || null })}
        />
        <p className="text-xs text-muted-foreground">Aceita PDF, AI, PSD, PNG, JPG, SVG ou ZIP</p>
      </div>

      <div className="space-y-2">
        <Label>Ou link do Google Drive (acesso público)</Label>
        <Input
          value={data.brand_drive_link}
          onChange={e => handleDriveLinkChange(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
        />
        {driveWarning && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{driveWarning}</AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          Inclua paleta de cores, fontes e logos. Certifique-se de que o acesso esteja público.
        </p>
      </div>
    </div>
  );
}
