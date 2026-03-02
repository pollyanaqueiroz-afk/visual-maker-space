import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Smartphone, UserPlus } from 'lucide-react';

export default function ClienteLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [plataformaUrl, setPlataformaUrl] = useState('');
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !nome.trim() || !plataformaUrl.trim()) return;
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: nome.trim() },
        },
      });
      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role: 'cliente' as any,
        });

        await supabase.from('app_clientes').insert({
          nome: nome.trim(),
          email: email.trim(),
          empresa: plataformaUrl.trim(),
          plataforma: 'ambos',
          status: 'no_prazo',
        });
      }

      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setMode('login');
      setPassword('');
    } catch (err: any) {
      toast.error(err.message === 'User already registered'
        ? 'Este e-mail já está cadastrado'
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
              {mode === 'login' ? <Smartphone className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
          </div>
          <CardTitle className="text-xl">
            {mode === 'login' ? 'Portal do Cliente' : 'Criar Conta'}
          </CardTitle>
          <CardDescription className="text-white/50">
            {mode === 'login'
              ? 'Acompanhe suas artes e aplicativo'
              : 'Preencha os dados para se cadastrar'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'login' ? (
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
              <p className="text-center text-xs text-white/40">
                Não tem conta?{' '}
                <button type="button" onClick={() => setMode('signup')} className="text-primary hover:underline">
                  Criar conta
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/70">Nome completo *</Label>
                <Input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  placeholder="Seu nome"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">E-mail *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  placeholder="seu@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">URL da plataforma *</Label>
                <Input
                  value={plataformaUrl}
                  onChange={e => setPlataformaUrl(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  placeholder="https://suaplataforma.curseduca.pro"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">Senha * (mín. 6 caracteres)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email || !password || !nome || !plataformaUrl}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Criar conta
              </Button>
              <p className="text-center text-xs text-white/40">
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
  );
}
