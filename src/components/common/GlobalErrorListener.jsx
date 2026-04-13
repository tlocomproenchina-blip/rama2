import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { base44 as rawBase44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, RefreshCcw, Copy, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { notifyAdmins } from '@/components/NotificationUtils';

export default function GlobalErrorListener() {
  const [errorInfo, setErrorInfo] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [viewerRole, setViewerRole] = useState(null);
  const dismissedErrorIdsRef = useRef(new Set());

  const isIntegrationQuotaError = (message = '', stack = '') => /credit|cr[eé]dito|quota|cuota|insufficient credits|integration credits|rate limit|too many requests|429|limit exceeded|usage limit|billing|invoke llm|sendemail|uploadfile|extractdatafromuploadedfile|generateimage|core\./i.test(`${String(message)} ${String(stack)}`);

  useEffect(() => {
    rawBase44.auth.me().then((me) => setViewerRole(me?.role || null)).catch(() => setViewerRole(null));
    const hash = (str) => { let h = 5381; for (let i=0;i<str.length;i++) h=((h<<5)+h) ^ str.charCodeAt(i); return (h>>>0).toString(36); };

    const persist = async (payload) => {
      try {
        const signature = [payload.type, payload.message, payload.stack || '', payload.source || '', payload.url || ''].join('|');
        const fingerprint = hash(signature);
        const errorId = `ERR-${fingerprint}`;
        // Anti-spam (5s)
        const now = Date.now();
        const last = Number(sessionStorage.getItem('lastErrorPersisted') || '0');
        if (now - last < 5000) return;
        sessionStorage.setItem('lastErrorPersisted', String(now));

        const existing = await base44.entities.ErrorLog.filter({ fingerprint }, '-updated_date', 1);
        if (existing.length) {
          await base44.entities.ErrorLog.update(existing[0].id, {
            count: (existing[0].count || 0) + 1,
            last_seen: new Date().toISOString(),
            message: payload.message
          });
        } else {
          const me = await base44.auth.me().catch(() => null);
          await base44.entities.ErrorLog.create({
            fingerprint,
            message: payload.message,
            name: payload.name || 'Error',
            stack: payload.stack || null,
            component_stack: null,
            url: payload.url || null,
            user_agent: payload.userAgent || null,
            user_email: me?.email || null,
            severity: payload.type === 'error' ? 'error' : 'warn',
            count: 1,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString()
          });
        }

        setErrorInfo(prev => ({ ...(prev || {}), errorId }));
      } catch (e) { console.warn('[GlobalErrorListener] persist failed', e); }
    };

    const handleWindowError = (event) => {
      const { message, filename, lineno, colno, error } = event;
      const details = {
        type: 'error',
        message: String(message || error?.message || 'Unknown error'),
        name: String(error?.name || 'Error'),
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
      persist(details);
    };

    const handleUnhandledRejection = (event) => {
      const reason = event?.reason;
      const details = {
        type: 'unhandledrejection',
        message: String(reason?.message || reason || 'Unhandled promise rejection'),
        name: String(reason?.name || 'PromiseRejection'),
        stack: reason?.stack ? String(reason.stack).slice(0, 1500) : null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      };
      console.error('[GlobalErrorListener] unhandledrejection:', details);
      try {
        base44.analytics.track({ eventName: 'global_error', properties: details });
      } catch (_) {}
      setErrorInfo(details);
      persist(details);
    };

    const handleSoftError = (event) => {
      const details = {
        type: 'soft-error',
        ...event.detail,
      };
      if (dismissedErrorIdsRef.current.has(details.errorId)) return;
      setErrorInfo(details);
      persist(details);
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('app:soft-error', handleSoftError);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('app:soft-error', handleSoftError);
    };
  }, []);

  if (!errorInfo) return null;
  if (viewerRole !== 'admin' && isIntegrationQuotaError(errorInfo.message, errorInfo.stack)) return null;

  const copyDetails = () => {
    const text = `ID: ${errorInfo.errorId || ''}\nTipo: ${errorInfo.type}\nMensaje: ${errorInfo.message}\nFuente: ${errorInfo.source || ''}\nLinea: ${errorInfo.line || ''}:${errorInfo.column || ''}\nURL: ${typeof window !== 'undefined' ? window.location.href : ''}\nUserAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}\nStack: ${errorInfo.stack || ''}`;
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
              {errorInfo.errorId && (
                <p className="text-[10px] text-amber-700 mt-0.5">ID: {errorInfo.errorId}</p>
              )}
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
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-amber-700 hover:text-amber-900" onClick={() => {
                if (errorInfo?.errorId) dismissedErrorIdsRef.current.add(errorInfo.errorId);
                setErrorInfo(null);
              }}>
                <X className="h-4 w-4" />
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