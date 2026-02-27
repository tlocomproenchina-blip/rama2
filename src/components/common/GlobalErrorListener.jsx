import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCcw, Copy } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';

export default function GlobalErrorListener() {
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    const handleWindowError = (event) => {
      const { message, filename, lineno, colno, error } = event;
      const details = {
        type: 'error',
        message: String(message || error?.message || 'Unknown error'),
        source: filename || null,
        line: lineno || null,
        column: colno || null,
        stack: error?.stack ? String(error.stack).slice(0, 1500) : null,
      };
      console.error('[GlobalErrorListener] window.error:', details);
      try {
        base44.analytics.track({ eventName: 'global_error', properties: details });
      } catch (_) {}
      setErrorInfo(details);
    };

    const handleUnhandledRejection = (event) => {
      const reason = event?.reason;
      const details = {
        type: 'unhandledrejection',
        message: String(reason?.message || reason || 'Unhandled promise rejection'),
        stack: reason?.stack ? String(reason.stack).slice(0, 1500) : null,
      };
      console.error('[GlobalErrorListener] unhandledrejection:', details);
      try {
        base44.analytics.track({ eventName: 'global_error', properties: details });
      } catch (_) {}
      setErrorInfo(details);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (!errorInfo) return null;

  const copyDetails = () => {
    const text = `Tipo: ${errorInfo.type}\nMensaje: ${errorInfo.message}\nFuente: ${errorInfo.source || ''}\nLinea: ${errorInfo.line || ''}:${errorInfo.column || ''}\nStack: ${errorInfo.stack || ''}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[1000] px-3 py-2">
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-300 bg-amber-50 text-amber-900 shadow">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Se detectó un error en la aplicación</p>
            <p className="text-xs text-amber-800 truncate">{errorInfo.message}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyDetails}>
              <Copy className="h-3 w-3" /> Copiar
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => window.location.reload()}>
              <RefreshCcw className="h-3 w-3" /> Reintentar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}