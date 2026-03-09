import { useAuth } from '@/hooks/useAuth';
import { useClienteImpersonation } from '@/contexts/ClienteImpersonation';

/**
 * Returns the effective client email.
 * If CS is impersonating a client, returns the impersonated email.
 * Otherwise, returns the authenticated user's email.
 */
export function useClienteEmail(): string {
  const { user } = useAuth();
  const { impersonatedEmail, isImpersonating } = useClienteImpersonation();

  if (isImpersonating && impersonatedEmail) {
    return impersonatedEmail;
  }
  return user?.email || '';
}
