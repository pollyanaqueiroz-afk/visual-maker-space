import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Palette, UserPlus } from 'lucide-react';
import CursEducaLayout from '@/components/CursEducaLayout';

export default function DesignerLogin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      // Check if user has designer role
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'designer')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            navigate('/designer', { replace: true });
          }
        });
    }
  }, [user, navigate]);

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
      // Auth state change will trigger the useEffect above
    } catch (err: any) {
      toast.error(
        err.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !nome.trim()) return;
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: nome.trim(), is_designer: true },
        },
      });
      if (error) throw error;
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setMode('login');
      setPassword('');
    } catch (err: any) {
      toast.error(
        err.message === 'User already registered'
          ? 'Este e-mail já está cadastrado'
          : err.message
      );
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
                {mode === 'login' ? <Palette className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              </div>
            </div>
            <CardTitle className="text-xl">
              {mode === 'login' ? 'Login Designer' : 'Criar Conta Designer'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Entre com suas credenciais para acessar suas artes'
                : 'Preencha os dados para criar sua conta de designer'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="designer@email.com"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Entrar
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline">
                    Criar conta
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome completo *</Label>
                  <Input
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="designer@email.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Senha * (mín. 6 caracteres)</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !email || !password || !nome}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar conta
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => setMode('login')} className="text-primary hover:underline">
                    Entrar
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </CursEducaLayout>
  );
}
