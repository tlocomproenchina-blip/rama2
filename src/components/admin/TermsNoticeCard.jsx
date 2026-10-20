import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Send, Loader2, RotateCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Aviso de actualización de términos: el administrador revisa el texto y
// confirma el envío a todos los clientes activos. El primer lote sale de
// inmediato y el resto lo termina la cola de correos, así que la tarjeta
// muestra el avance y se actualiza sola mientras queden correos pendientes.
export default function TermsNoticeCard() {
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [termsUrl, setTermsUrl] = useState('');
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const call = useCallback(async (payload) => {
    const res = await base44.functions.invoke('sendTermsUpdate', payload);
    const data = res?.data;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const loadPreview = useCallback(async () => {
    const data = await call({ action: 'preview' });
    setTotal(data.total || 0);
    setSubject(data.subject || '');
    setMessage(data.message || '');
    setTermsUrl(data.terms_url || '');
    if (data.last?.total) setResult(data.last);
    return data;
  }, [call]);

  useEffect(() => {
    (async () => {
      try {
        await loadPreview();
      } catch (error) {
        toast.error(error.message || 'No se pudo cargar el aviso');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPreview]);

  // Mientras queden correos en cola, la tarjeta se refresca sola.
  useEffect(() => {
    if (!result?.pending) return undefined;
    const id = setInterval(async () => {
      try {
        const data = await call({ action: 'status', batch_id: result.batch_id });
        if (data?.summary) setResult(data.summary);
      } catch (_) {}
    }, 30000);
    return () => clearInterval(id);
  }, [result?.pending, result?.batch_id, call]);

  const refreshCount = async () => {
    setLoading(true);
    try {
      await loadPreview();
    } catch (error) {
      toast.error(error.message || 'No se pudo actualizar el avance');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const data = await call({ action: 'send', confirm: true, subject, message, terms_url: termsUrl });
      setResult(data);
      toast.success(data.message || 'Aviso en proceso de envío.');
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar el aviso');
    } finally {
      setSending(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await call({ action: 'test', subject, message, terms_url: termsUrl });
      toast.success('Prueba enviada a tu correo.');
    } catch (error) {
      toast.error(error.message || 'No se pudo enviar la prueba');
    } finally {
      setTesting(false);
    }
  };

  const pending = result?.pending || 0;
  const finished = !!result && pending === 0;

  return (
    <div className="p-4 md:p-6 bg-sky-50 rounded-xl border border-sky-200 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Mail className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Aviso de actualización de términos</h3>
            <p className="text-sm text-slate-600">
              Envía un correo a los clientes activos informando que actualizamos nuestros términos de servicio.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshCount} disabled={loading} className="shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="p-3 bg-white rounded-lg border border-sky-200">
        <p className="text-sm text-slate-700">
          {loading ? 'Contando destinatarios…' : `${total} cliente(s) activo(s) recibirán el aviso`}
        </p>
        <p className="text-xs text-slate-500 mt-1">Solo clientes con la cuenta habilitada. No se incluye a administradores ni empleados.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Asunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Actualizamos nuestros términos de servicio" />
        </div>
        <div className="space-y-2">
          <Label>Mensaje</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} placeholder="Escribe el mensaje que recibirán tus clientes..." />
          <p className="text-xs text-slate-500">El correo lleva el encabezado de TLEC CARGO, tu mensaje y el botón hacia los términos.</p>
        </div>
        <div className="space-y-2">
          <Label>Enlace a los términos</Label>
          <Input value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} placeholder="https://tleccargo.com/TermsOfService" />
        </div>
      </div>

      {result && (
        <div className="p-3 bg-white rounded-lg border border-sky-200 space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-semibold text-emerald-600">{result.sent || 0}</p>
              <p className="text-xs text-slate-500">Entregados</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-amber-600">{pending}</p>
              <p className="text-xs text-slate-500">En cola</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-rose-600">{result.failed || 0}</p>
              <p className="text-xs text-slate-500">Fallidos</p>
            </div>
          </div>
          {finished ? (
            <p className="flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Aviso enviado: {(result.sent || 0)} entregado(s) de {result.total || 0}
              {(result.failed ? `, ${result.failed} fallido(s)` : '')}.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-slate-600">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              El resto de los correos sale automáticamente en los próximos minutos. Esta tarjeta se actualiza sola.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleTest} disabled={testing || sending || loading} className="sm:w-auto">
          {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          Enviar prueba a mi correo
        </Button>
        <Button
          onClick={() => setConfirmOpen(true)}
          disabled={sending || loading || total === 0}
          className="flex-1 bg-sky-600 hover:bg-sky-700"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar aviso a {total} cliente(s)
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar el aviso ahora?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará este correo a {total} cliente(s) activo(s) con el asunto «{subject}». Es un envío único: no se puede deshacer ni repetir sin volver a confirmarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} className="bg-sky-600 hover:bg-sky-700">
              Sí, enviar a {total} cliente(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}