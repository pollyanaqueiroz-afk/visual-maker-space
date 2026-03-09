import { createContext, useContext, ReactNode } from 'react';

interface ImpersonationContextType {
  impersonatedEmail: string | null;
  clienteName: string | null;
  clienteId: string | null;
  isImpersonating: boolean;
}

const ClienteImpersonationContext = createContext<ImpersonationContextType>({
  impersonatedEmail: null,
  clienteName: null,
  clienteId: null,
  isImpersonating: false,
});

export function ClienteImpersonationProvider({
  children,
  email,
  clienteName,
  clienteId,
}: {
  children: ReactNode;
  email: string | null;
  clienteName: string | null;
  clienteId: string | null;
}) {
  return (
    <ClienteImpersonationContext.Provider
      value={{
        impersonatedEmail: email,
        clienteName,
        clienteId,
        isImpersonating: !!email,
      }}
    >
      {children}
    </ClienteImpersonationContext.Provider>
  );
}

export function useClienteImpersonation() {
  return useContext(ClienteImpersonationContext);
}
