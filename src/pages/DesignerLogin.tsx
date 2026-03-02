import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Palette } from 'lucide-react';
import CursEducaLayout from '@/components/CursEducaLayout';

export default function DesignerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      // Validate email by checking if designer has any assigned arts
      const { supabase } = await import('@/integrations/supabase/client');
      const { data, error } = await supabase.functions.invoke('designer-data', {
        body: { email: email.trim().toLowerCase() },
      });

      if (error) throw error;

      const images = data?.images || [];
      if (images.length === 0) {
        toast.error('Nenhuma arte encontrada para este e-mail. Verifique se digitou corretamente.');
        setLoading(false);
        return;
      }

      // Store email and navigate
      sessionStorage.setItem('designer_email', email.trim().toLowerCase());
      navigate('/designer');
    } catch {
      toast.error('Erro ao verificar e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CursEducaLayout title="Painel do Designer" subtitle="Acesse sua área de trabalho">
      <div className="flex justify-center px-4 -mt-8 pb-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Palette className="h-5 w-5" />
              </div>
            </div>
            <CardTitle className="text-xl">Acesso Designer</CardTitle>
            <CardDescription>
              Digite seu e-mail para acessar suas artes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="designer@email.com"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Acessar minhas artes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </CursEducaLayout>
  );
}
