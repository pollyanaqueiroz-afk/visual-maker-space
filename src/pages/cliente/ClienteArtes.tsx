import { useClienteEmail } from '@/hooks/useClienteEmail';
import ClientReviewPage from '@/pages/ClientReviewPage';
import { Loader2 } from 'lucide-react';

export default function ClienteArtes() {
  const email = useClienteEmail();

  if (!email) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  return <ClientReviewPage injectedEmail={email} embedded />;
}
