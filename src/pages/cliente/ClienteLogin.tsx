import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Smartphone, Palette } from 'lucide-react';

export default function ClienteLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      navigate('/cliente');
    } catch (err: any) {
      toast.error(err.message === 'Invalid login credentials'
        ? 'E-mail ou senha incorretos'
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4" style={{ fontFamily: "'Sora', sans-serif" }}>
      <Card className="w-full max-w-sm bg-[#1E293B] border-white/10 text-white">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Smartphone className="h-5 w-5" />
            </div>
          </div>
          <CardTitle className="text-xl">Portal do Cliente</CardTitle>
          <CardDescription className="text-white/50">
            Acompanhe suas artes e aplicativo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="seu@email.com"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70">Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email || !password}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
