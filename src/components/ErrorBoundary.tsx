import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { logSystemError } from '@/lib/errorLogger';

interface Props {
  children: ReactNode;
  module?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary:', error, info);
    logSystemError({
      module: this.props.module || 'unknown',
      screen: window.location.pathname,
      action: 'component_crash',
      error,
      severity: 'critical',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Algo deu errado nesta seção</h2>
          <p className="text-sm text-muted-foreground">Ocorreu um erro inesperado. Tente recarregar.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => this.setState({ hasError: false })}>
              Tentar novamente
            </Button>
            <Button onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
