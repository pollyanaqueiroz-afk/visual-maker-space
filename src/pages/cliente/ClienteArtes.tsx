import { useAuth } from '@/hooks/useAuth';
import ClientReviewPage from '@/pages/ClientReviewPage';

export default function ClienteArtes() {
  const { user } = useAuth();
  return <ClientReviewPage injectedEmail={user?.email || undefined} />;
}
