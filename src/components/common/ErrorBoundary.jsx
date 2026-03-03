import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Copy } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console
    console.error('[ErrorBoundary] Captured error:', error, errorInfo);
    // Track via analytics (safe, minimal payload)
    try {
      base44.analytics.track({
        eventName: 'frontend_error',
        properties: {
          message: String(error?.message || 'unknown'),
          name: String(error?.name || 'Error'),
          stack: error?.stack ? String(error.stack).slice(0, 1500) : null,
          component_stack: errorInfo?.componentStack ? String(errorInfo.componentStack).slice(0, 1500) : null,
        }
      });
    } catch (_) {}
  }

  handleRetry = () => {
    // Full reload to recover from broken state
    window.location.reload();
  };

  handleCopy = () => {
    const { error, errorInfo } = this.state;
    const details = `Mensaje: ${error?.message || ''}\n\nStack:\n${error?.stack || ''}\n\nComponent stack:\n${errorInfo?.componentStack || ''}`;
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