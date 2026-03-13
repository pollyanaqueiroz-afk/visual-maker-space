import { supabase } from '@/integrations/supabase/client';

interface ErrorLogParams {
  module: string;
  screen: string;
  action: string;
  error: Error | string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  endpoint?: string;
  requestData?: string;
  userEmail?: string;
  userRole?: string;
}

export async function logSystemError(params: ErrorLogParams) {
  try {
    const errorMessage = typeof params.error === 'string' ? params.error : params.error.message;
    const stackTrace = typeof params.error === 'string' ? undefined : params.error.stack;

    await (supabase.from('system_error_logs' as any).insert({
      user_email: params.userEmail || null,
      user_role: params.userRole || null,
      module: params.module,
      screen: params.screen,
      action: params.action,
      error_message: errorMessage.slice(0, 2000),
      stack_trace: stackTrace?.slice(0, 5000) || null,
      request_data: params.requestData?.slice(0, 5000) || null,
      endpoint: params.endpoint || null,
      severity: params.severity || 'medium',
    }) as any);
  } catch (e) {
    // Silent fail - don't throw from error logger
    console.error('Failed to log error:', e);
  }
}

/**
 * Sets up global error handlers to auto-log unhandled errors.
 */
export function setupGlobalErrorHandlers() {
  window.addEventListener('error', (event) => {
    logSystemError({
      module: 'global',
      screen: window.location.pathname,
      action: 'unhandled_error',
      error: event.error || event.message,
      severity: 'high',
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || event.reason?.toString() || 'Unhandled promise rejection';
    logSystemError({
      module: 'global',
      screen: window.location.pathname,
      action: 'unhandled_promise_rejection',
      error: new Error(errorMsg),
      severity: 'high',
    });
  });
}
