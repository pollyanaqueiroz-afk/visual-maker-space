import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ClienteSolicitarApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clientEmail = user?.email || '';

  const [form, setForm] = useState({
    nome: '', url_cliente: '', email: clientEmail, whatsapp: '', plataforma: 'ambos',
  });

  // Check if client already has an app project (by email OR empresa/URL)
  const { data: existingApp, isLoading: checking } = useQuery({
    queryKey: ['cliente-app-exists', clientEmail],
    enabled: !!clientEmail,
    queryFn: async () => {
      const { data } = await supabase
        .from('app_clientes')
        .select('id')
        .eq('email', clientEmail)
        .maybeSingle();
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Check if a project already exists with same URL, email or nome
      const { data: existingByAny } = await supabase
        .from('app_clientes')
        .select('id')
        .or(`empresa.eq.${form.url_cliente},email.eq.${form.email},nome.eq.${form.nome}`)
        .limit(1)
        .maybeSingle();

      if (existingByAny) {
        // Link client to existing project (update contact info)
        const { error } = await supabase.from('app_clientes').update({
          email: form.email,
          whatsapp: form.whatsapp || null,
          nome: form.nome,
        }).eq('id', existingByAny.id);
        if (error) throw error;
        return;
      }

      // No existing project — create new
      const { error } = await supabase.from('app_clientes').insert({
        nome: form.nome,
        empresa: form.url_cliente,
        email: form.email,
        whatsapp: form.whatsapp || null,
        plataforma: form.plataforma,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-app'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-app-exists'] });
      toast.success('Aplicativo solicitado com sucesso!');
      navigate('/cliente/aplicativo');
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (existingApp) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <p className="text-lg font-semibold">Você já possui um projeto de aplicativo</p>
        <p className="text-sm text-white/50">Cada cliente pode solicitar apenas um aplicativo.</p>
        <Button onClick={() => navigate('/cliente/aplicativo')}>Ver meu aplicativo</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <button onClick={() => navigate('/cliente')} className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div>
        <h1 className="text-xl font-bold">Solicitar Aplicativo</h1>
        <p className="text-sm text-white/50 mt-1">Preencha os dados para iniciar seu projeto de app</p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70">Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">URL do Cliente *</Label>
            <Input value={form.url_cliente} onChange={e => setForm(p => ({ ...p, url_cliente: e.target.value }))} placeholder="exemplo.curseduca.com" className="bg-white/5 border-white/10" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-white/70">E-mail *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-white/70">WhatsApp</Label>
            <Input value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="5511999999999" className="bg-white/5 border-white/10" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-white/70">Plataforma *</Label>
          <Select value={form.plataforma} onValueChange={v => setForm(p => ({ ...p, plataforma: v }))}>
            <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="apple">🍎 Apple</SelectItem>
              <SelectItem value="google">🤖 Google</SelectItem>
              <SelectItem value="ambos">🍎+🤖 Ambos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className="w-full"
          disabled={!form.nome || !form.url_cliente || !form.email || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Criando...' : 'Solicitar aplicativo'}
        </Button>
      </div>
    </div>
  );
}
