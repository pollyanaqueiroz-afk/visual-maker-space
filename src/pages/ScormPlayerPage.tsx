import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScormPlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: err } = await (supabase.from('scorm_packages' as any) as any)
        .select('*')
        .eq('id', id)
        .single();
      if (err || !data) {
        setError('Pacote SCORM não encontrado');
      } else {
        setPkg(data);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <p className="text-destructive">{error || 'Erro ao carregar'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const scormUrl = `https://${projectId}.supabase.co/storage/v1/object/public/scorm-packages/${pkg.storage_path}/${pkg.entry_point}`;

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-medium truncate">{pkg.title}</h1>
      </div>
      <iframe
        src={scormUrl}
        className="flex-1 w-full border-0"
        title={pkg.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
