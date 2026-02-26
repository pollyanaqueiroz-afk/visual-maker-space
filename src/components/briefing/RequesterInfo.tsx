import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { BriefingFormData } from '@/types/briefing';

interface Props {
  data: BriefingFormData;
  onChange: (updates: Partial<BriefingFormData>) => void;
}

export default function RequesterInfo({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Informações do Solicitante</h2>
        <p className="text-sm text-muted-foreground">Dados de contato e plataforma</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo *</Label>
          <Input id="name" value={data.requester_name} onChange={e => onChange({ requester_name: e.target.value })} required placeholder="Seu nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" value={data.requester_email} onChange={e => onChange({ requester_email: e.target.value })} required placeholder="seu@email.com" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">URL da Plataforma Curseduca *</Label>
        <Input id="url" value={data.platform_url} onChange={e => onChange({ platform_url: e.target.value })} required placeholder="https://suaempresa.curseduca.pro" />
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Sua plataforma possui:</p>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={data.has_trail} onCheckedChange={v => onChange({ has_trail: !!v })} />
            <span className="text-sm">Trilha</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={data.has_challenge} onCheckedChange={v => onChange({ has_challenge: !!v })} />
            <span className="text-sm">Desafio</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={data.has_community} onCheckedChange={v => onChange({ has_community: !!v })} />
            <span className="text-sm">Comunidade</span>
          </label>
        </div>
      </div>
    </div>
  );
}
