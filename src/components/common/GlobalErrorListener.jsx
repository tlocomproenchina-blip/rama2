import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, RefreshCcw, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { notifyAdmins } from '@/components/NotificationUtils';

export default function GlobalErrorListener() {
  const [errorInfo, setErrorInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

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
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
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
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
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
    const text = `Tipo: ${errorInfo.type}\nMensaje: ${errorInfo.message}\nFuente: ${errorInfo.source || ''}\nLinea: ${errorInfo.line || ''}:${errorInfo.column || ''}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}\nUserAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}\nStack: ${errorInfo.stack || ''}`;
    navigator.clipboard.writeText(text);
  };

  const handleSendReport = async () => {
    if (sending) return;
    // Evitar spam (60s)
    const last = Number(sessionStorage.getItem('lastErrorReportSent') || '0');
    if (Date.now() - last < 60000) {
      toast.info('Ya recibimos un reporte reciente. Intenta en un minuto.');
      return;
    }
    setSending(true);
    try {
      const me = await base44.auth.me().catch(() => null);
      const summary = `Tipo: ${errorInfo.type}\nMensaje: ${errorInfo.message}\nFuente: ${errorInfo.source || ''}\nLinea: ${errorInfo.line || ''}:${errorInfo.column || ''}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}\nUserAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}\nStack: ${errorInfo.stack || ''}`;

      const subject = 'Reporte de error en la app';
      const userMsg = notes?.trim() ? notes.trim() : 'Sin comentarios del usuario';

      await base44.entities.SupportTicket.create({
        client_email: me?.email || 'anon@local',
        subject,
        priority: 'alta',
        category: 'otro',
        messages: [
          {
            sender_email: me?.email || 'anon@local',
            sender_name: me?.full_name || 'Usuario',
            message: `Comentario del usuario:\n${userMsg}`,
            timestamp: new Date().toISOString(),
            is_admin: false,
          },
          {
            sender_email: 'system@local',
            sender_name: 'Sistema',
            message: `Detalles técnicos (auto):\n${summary}`,
            timestamp: new Date().toISOString(),
            is_admin: true,
          },
        ],
      });

      // Notificar admins
      notifyAdmins({
        subject: '🚨 Reporte de error de un usuario',
        body: `${me?.full_name || 'Usuario'} (${me?.email || 'anon'}) reportó un error.\n\n${summary}`,
        message: 'Nuevo reporte de error',
        type: 'system',
        icon: 'alert',
      });

      base44.analytics.track({ eventName: 'user_reported_error' });
      toast.success('Gracias. Tu reporte fue enviado.');
      sessionStorage.setItem('lastErrorReportSent', String(Date.now()));
      setShowDialog(false);
      setNotes('');
    } catch (e) {
      toast.error('No se pudo enviar el reporte');
    }
    setSending(false);
  };

  return (
    <>
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
              <Button size="sm" variant="outline" onClick={() => setShowDialog(true)}>
                <Send className="h-3 w-3" /> Notificar
              </Button>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-3 w-3" /> Reintentar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notificar error</DialogTitle>
            <DialogDescription>Describe brevemente qué pasó; incluiremos datos técnicos automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>¿Qué estabas haciendo?</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Escribe aquí..." />
            <div className="text-xs text-slate-600 bg-white rounded border p-2">
              URL: {typeof window !== 'undefined' ? window.location.href : ''}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendReport} disabled={sending} className="bg-blue-600 hover:bg-blue-700">
              {sending ? 'Enviando…' : 'Enviar reporte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}