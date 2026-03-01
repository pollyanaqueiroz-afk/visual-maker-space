import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ClientReviewPage from '@/pages/ClientReviewPage';

/**
 * Wrapper that injects the client's email into the ClientReviewPage
 * so it works within the authenticated hub (no manual email entry needed).
 */
export default function ClienteArtes() {
  const { user } = useAuth();

  // We inject the email as a URL param so the existing component auto-loads
  useEffect(() => {
    if (user?.email) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('email') && !url.searchParams.has('token')) {
        url.searchParams.set('email', user.email);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [user?.email]);

  return <ClientReviewPage />;
}
