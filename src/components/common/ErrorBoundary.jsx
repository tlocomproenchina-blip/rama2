import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Copy } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error) {
    const isDynamicImportError = String(error?.message || '').includes('Failed to fetch dynamically imported module');
    if (isDynamicImportError) {
      return { hasError: false, error: null, errorInfo: null };
    }
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const isDynamicImportError = String(error?.message || '').includes('Failed to fetch dynamically imported module');
    if (isDynamicImportError) {
      console.warn('[ErrorBoundary] Lazy import skipped:', error?.message);
      return;
    }

    // Log to console
    console.error('[ErrorBoundary] Captured error:', error, errorInfo);

    // Small hash (djb2-based) to fingerprint errors
    const hash = (str) => {
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
      return (h >>> 0).toString(36);
    };

    const signature = [
      String(error?.message || ''),
      String(error?.stack || '').slice(0, 500),
      String(errorInfo?.componentStack || ''),
      typeof window !== 'undefined' ? window.location.pathname : ''
    ].join('|');
    const fingerprint = hash(signature);
    const errorId = `ERR-${fingerprint}`;

    this.setState({ hasError: true, error, errorInfo, errorId });

    // Track via analytics (safe, minimal payload)
    try {
      base44.analytics.track({
        eventName: 'frontend_error',
        properties: {
          id: errorId,
          message: String(error?.message || 'unknown'),
          name: String(error?.name || 'Error'),
          stack: error?.stack ? String(error.stack).slice(0, 1500) : null,
          component_stack: errorInfo?.componentStack ? String(errorInfo.componentStack).slice(0, 1500) : null,
          url: typeof window !== 'undefined' ? window.location.href : null
        }
      });
    } catch (_) {}

    // Persist to ErrorLog entity (dedupe by fingerprint)
    (async () => {
      try {
        const me = await base44.auth.me().catch(() => null);
        const existing = await base44.entities.ErrorLog.filter({ fingerprint }, '-updated_date', 1);
        if (existing.length > 0) {
          const el = existing[0];
          await base44.entities.ErrorLog.update(el.id, {
            count: (el.count || 0) + 1,
            last_seen: new Date().toISOString(),
            message: String(error?.message || el.message || ''),
            url: typeof window !== 'undefined' ? window.location.href : el.url
          });
        } else {
          await base44.entities.ErrorLog.create({
            fingerprint,
            message: String(error?.message || 'unknown'),
            name: String(error?.name || 'Error'),
            stack: error?.stack ? String(error.stack).slice(0, 8000) : null,
            component_stack: errorInfo?.componentStack ? String(errorInfo.componentStack).slice(0, 8000) : null,
            url: typeof window !== 'undefined' ? window.location.href : null,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            user_email: me?.email || null,
            severity: 'error',
            count: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          });
        }
      } catch (e) {
        // Silencioso para no romper la UI
        console.warn('[ErrorBoundary] persist failed', e);
      }
    })();
  }

  handleRetry = () => {
    // Full reload to recover from broken state
    window.location.reload();
  };

  handleCopy = () => {
    const { error, errorInfo, errorId } = this.state;
    const details = `ID: ${errorId || ''}\nMensaje: ${error?.message || ''}\n\nStack:\n${error?.stack || ''}\n\nComponent stack:\n${errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(details);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[50vh] flex items-center justify-center">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-xl shadow p-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Ocurrió un problema</h2>
            <p className="text-slate-600 mt-1">Se produjo un error y la página no pudo mostrarse. Puedes reintentar o copiar los detalles para soporte.</p>
            {this.state.errorId && (
              <p className="text-xs text-slate-400 mt-2">ID: {this.state.errorId}</p>
            )}
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button onClick={this.handleRetry} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCcw className="h-4 w-4" /> Reintentar
              </Button>
              <Button variant="outline" onClick={this.handleCopy}>
                <Copy className="h-4 w-4" /> Copiar detalles
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}