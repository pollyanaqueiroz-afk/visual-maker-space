import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Loader2, Check, X } from 'lucide-react';

interface AISuggestion {
  suggestion_text: string;
  selections?: Record<string, boolean>;
  has_trail?: boolean;
  has_challenge?: boolean;
  has_community?: boolean;
  images?: Record<string, any>;
}

interface Props {
  onApply: (suggestion: AISuggestion) => void;
  currentForm?: any;
}

export default function AIBriefingAssistant({ onApply, currentForm }: Props) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);

  const handleAsk = async () => {
    if (!message.trim()) {
      toast.error('Descreva o que você precisa');
      return;
    }

    setLoading(true);
    setSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke('suggest-briefing', {
        body: { message: message.trim(), currentForm },
      });

      if (error) throw new Error(error.message || 'Erro ao processar');

      if (data?.data) {
        setSuggestion(data.data);
      } else {
        throw new Error('Resposta inválida da IA');
      }
    } catch (err: any) {
      console.error('AI suggestion error:', err);
      toast.error(err.message || 'Erro ao gerar sugestão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Assistente IA</h3>
            <p className="text-xs text-muted-foreground">Descreva o que precisa e a IA sugere o briefing preenchido</p>
          </div>
        </div>

        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Ex: Preciso de um banner para minha plataforma de cursos de marketing digital, com cores vibrantes, estilo moderno e uma foto do professor João..."
          rows={3}
          className="bg-background"
        />

        <Button
          onClick={handleAsk}
          disabled={loading || !message.trim()}
          size="sm"
          className="gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Gerando sugestão...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Gerar briefing com IA</>
          )}
        </Button>

        {suggestion && (
          <div className="space-y-3 pt-2 border-t border-primary/10">
            <p className="text-sm text-foreground">{suggestion.suggestion_text}</p>

            {suggestion.selections && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(suggestion.selections)
                  .filter(([, v]) => v)
                  .map(([key]) => (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key === 'login_image' && 'Login'}
                      {key === 'banner_vitrine' && 'Banner Vitrine'}
                      {key === 'product_covers' && 'Capas'}
                      {key === 'trail_banner' && 'Trilha'}
                      {key === 'challenge_banner' && 'Desafio'}
                      {key === 'community_banner' && 'Comunidade'}
                    </Badge>
                  ))}
              </div>
            )}

            {suggestion.images && (
              <div className="space-y-2 text-xs text-muted-foreground">
                {Object.entries(suggestion.images).map(([key, val]) => {
                  if (!val) return null;
                  const items = Array.isArray(val) ? val : [val];
                  return items.map((item: any, i: number) => {
                    if (!item || (!item.image_text && !item.element_suggestion)) return null;
                    return (
                      <div key={`${key}-${i}`} className="bg-background rounded-md p-2 border">
                        <span className="font-medium text-foreground text-xs">{key.replace(/_/g, ' ')}</span>
                        {item.image_text && <p>📝 {item.image_text}</p>}
                        {item.element_suggestion && <p>🎨 {item.element_suggestion}</p>}
                        {item.font_suggestion && <p>🔤 {item.font_suggestion}</p>}
                      </div>
                    );
                  });
                })}
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              <Button size="sm" onClick={() => { onApply(suggestion); setSuggestion(null); setMessage(''); }} className="gap-1.5 w-full">
                <Check className="h-3.5 w-3.5" /> Usar esta sugestão
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)} className="gap-1.5 w-full">
                <X className="h-3.5 w-3.5" /> Descartar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
