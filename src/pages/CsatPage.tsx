import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Star, CheckCircle, Loader2, Frown, Meh, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CsatPage() {
  const { token } = useParams<{ token: string }>();
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [csatInfo, setCsatInfo] = useState<{ client_name: string | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    // Check if token exists and if already responded
    (async () => {
      const { data, error } = await (supabase
        .from('meeting_csat' as any)
        .select('client_name, responded_at')
        .eq('token', token)
        .single() as any);

      if (error || !data) {
        setLoading(false);
        return;
      }

      setCsatInfo({ client_name: data.client_name });
      if (data.responded_at) {
        setAlreadyResponded(true);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (score === null) {
      toast.error('Selecione uma nota de 0 a 10');
      return;
    }
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('submit-csat', {
        body: { token, score, comment },
      });

      if (error) throw error;
      if (data?.error === 'already_responded') {
        setAlreadyResponded(true);
        return;
      }
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: any) {
      toast.error('Erro ao enviar avaliação');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (n: number) => {
    if (n <= 3) return 'bg-destructive text-white';
    if (n <= 6) return 'bg-warning text-white';
    return 'bg-success text-white';
  };

  const getScoreEmoji = (n: number) => {
    if (n <= 3) return <Frown className="h-5 w-5" />;
    if (n <= 6) return <Meh className="h-5 w-5" />;
    return <Smile className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!csatInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium text-gray-700">Link inválido ou expirado</p>
            <p className="text-sm text-gray-500 mt-2">Este link de avaliação não foi encontrado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyResponded || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-gray-800">
              {submitted ? 'Obrigado pela sua avaliação!' : 'Avaliação já enviada'}
            </h1>
            <p className="text-gray-500">
              {submitted
                ? 'Sua opinião é muito importante para continuarmos melhorando.'
                : 'Você já respondeu esta pesquisa de satisfação.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-white p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardContent className="p-0">
          {/* Header */}
          <div className="bg-indigo-500 text-white p-6 rounded-t-xl">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold">Como foi sua reunião?</h1>
                <p className="text-indigo-100 text-sm mt-0.5">
                  {csatInfo.client_name ? `Olá, ${csatInfo.client_name}!` : 'Sua opinião é muito importante'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Score selector */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">
                De 0 a 10, qual sua satisfação com a reunião?
              </p>
              <div className="grid grid-cols-11 gap-1.5">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setScore(i)}
                    className={cn(
                      'h-10 rounded-lg text-sm font-bold transition-all duration-200 border-2',
                      score === i
                        ? `${getScoreColor(i)} border-transparent scale-110 shadow-lg`
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 px-1">
                <span>Muito insatisfeito</span>
                <span>Muito satisfeito</span>
              </div>
              {score !== null && (
                <div className="flex items-center justify-center gap-2 py-2">
                  {getScoreEmoji(score)}
                  <span className="text-lg font-bold text-gray-800">Nota: {score}/10</span>
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Gostaria de deixar um comentário? (opcional)
              </label>
              <div className="space-y-1">
                <Textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Conte-nos mais sobre sua experiência..."
                  rows={3}
                  className="resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-right text-muted-foreground">{comment.length}/2000</p>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={score === null || submitting}
              className="w-full h-12 text-base font-semibold bg-indigo-500 hover:bg-indigo-600"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              Enviar Avaliação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
