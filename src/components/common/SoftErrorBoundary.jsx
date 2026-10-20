import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';
import { base44 as rawBase44 } from '@/api/base44Client';
import { isStaleChunkError, reloadForStaleChunk } from '@/lib/staleChunkReload';

export default class SoftErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null, message: '', viewerRole: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: String(error?.message || 'Error inesperado')
    };
  }

  componentDidCatch(error, errorInfo) {
    // Página que el navegador no pudo descargar (versión nueva publicada o vista
    // previa reiniciándose): se recarga sola, con reintentos limitados, en vez
    // de dejar el error en pantalla.
    if (isStaleChunkError(error?.message) && reloadForStaleChunk()) return;

    rawBase44.auth.me().then((me) => this.setState({ viewerRole: me?.role || null })).catch(() => this.setState({ viewerRole: null }));
    const hash = (str) => {
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
      return (h >>> 0).toString(36);
    };

    const signature = [
      String(error?.message || ''),
      String(error?.stack || '').slice(0, 500),
      String(errorInfo?.componentStack || ''),
      typeof window !== 'undefined' ? window.location.pathname : '',
      this.props.name || 'section'
    ].join('|');

    const fingerprint = hash(signature);
    const errorId = `SOFT-${fingerprint}`;
    this.setState({ errorId });

    try {
      window.dispatchEvent(new CustomEvent('app:soft-error', {
        detail: {
          errorId,
          message: String(error?.message || 'unknown'),
          name: String(error?.name || 'Error'),
          stack: error?.stack ? String(error.stack).slice(0, 4000) : null,
          component_stack: errorInfo?.componentStack ? String(errorInfo.componentStack).slice(0, 4000) : null,
          boundary: this.props.name || 'section',
          url: typeof window !== 'undefined' ? window.location.href : null,
        }
      }));
    } catch {}

    try {
      base44.analytics.track({
        eventName: 'soft_frontend_error',
        properties: {
          id: errorId,
          boundary: this.props.name || 'section',
          message: String(error?.message || 'unknown')
        }
      });
    } catch {}
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorId: null, message: '' });
  };

  render() {
    if (this.state.hasError) {
      const isIntegrationQuotaError = /credit|cr[eé]dito|quota|cuota|insufficient credits|integration credits|rate limit|too many requests|429|limit exceeded|usage limit|billing|invoke llm|sendemail|uploadfile|extractdatafromuploadedfile|generateimage|core\./i.test(String(this.state.message || ''));
      if (this.state.viewerRole !== 'admin' && isIntegrationQuotaError) return null;
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-amber-100 p-2">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Esta sección tuvo un problema</p>
              <p className="mt-1 text-sm text-amber-800">El resto del sistema sigue funcionando.</p>
              {this.state.errorId && (
                <p className="mt-1 text-[11px] text-amber-700">ID: {this.state.errorId}</p>
              )}
              <button
                type="button"
                onClick={this.handleRetry}
                className="mt-3 text-sm font-medium text-amber-900 underline underline-offset-2"
              >
                Reintentar sección
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}