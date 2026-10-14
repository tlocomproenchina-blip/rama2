import React, { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHero from '@/components/common/PageHero';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Mail, Send, Loader2, Save, ImageIcon, Clock3, FileText } from 'lucide-react';
import { toast } from 'sonner';
import CampaignImagesEditor from '@/components/delivery-proof/CampaignImagesEditor';
import CampaignAudiencePanel from '@/components/delivery-proof/CampaignAudiencePanel';
import CampaignEmailPreview from '@/components/delivery-proof/CampaignEmailPreview';
import CampaignSendResults from '@/components/delivery-proof/CampaignSendResults';

export default function AdminDeliveryProofCampaign() {
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState({ html: '', totals: null, sample: [] });
  const [lastRun, setLastRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [excludeNotified, setExcludeNotified] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const skipAuto = useRef(true);

  const call = useCallback(async (payload) => {
    const res = await base44.functions.invoke('deliveryProofCampaign', payload);
    return res?.data || null;
  }, []);

  const errorMessage = (error) =>
    error?.response?.data?.error || error?.data?.error || error?.message || 'No se pudo completar la campaña';

  const refreshPreview = useCallback(async (payload) => {
    setPreviewLoading(true);
    try {
      const data = await call({ action: 'preview', ...payload });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo preparar la vista previa');
      setPreview({ html: data.html, totals: data.totals, sample: data.sample || [] });
      if (data.config) {
        setLastRun({
          status: data.config.last_run_status,
          results: data.config.results || [],
          message: data.config.last_run_message,
          date: data.config.last_run_date,
          sent: data.config.last_run_sent,
          failed: data.config.last_run_failed,
          by: data.config.last_run_by
        });
        return data.config;
      }
      return null;
    } catch (error) {
      toast.error(errorMessage(error));
      return null;
    } finally {
      setPreviewLoading(false);
    }
  }, [call]);

  useEffect(() => {
    let active = true;
    (async () => {
      const config = await refreshPreview({ exclude_notified: true });
      if (!active) return;
      if (config) {
        setDraft({
          subject: config.subject || '',
          intro_text: config.intro_text || '',
          images: config.images || [],
          deadline_hours: config.deadline_hours || 48
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La vista previa se rearma sola al editar el asunto, el texto o las imágenes.
  useEffect(() => {
    if (!draft) return;
    if (skipAuto.current) {
      skipAuto.current = false;
      return;
    }
    const timer = setTimeout(() => {
      refreshPreview({ ...draft, exclude_notified: excludeNotified });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, excludeNotified]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await call({ action: 'save', ...draft });
      if (!data?.ok) throw new Error(data?.error || 'No se pudieron guardar los cambios');
      toast.success('Cambios guardados en la campaña');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const data = await call({ action: 'send', confirm: true, exclude_notified: excludeNotified, ...draft });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo enviar la campaña');
      const runDate = new Date().toISOString();
      setResult({ ...data, date: runDate });
      setLastRun({
        status: data.status,
        results: data.results || [],
        message: data.message,
        date: runDate,
        sent: data.sent,
        failed: data.failed
      });
      if (data.totals) setPreview((prev) => ({ ...prev, totals: data.totals }));
      toast.success(data.message || 'Campaña enviada');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const targets = preview.totals?.targets ?? 0;
  const canSend = !!draft && targets > 0 && !sending;

  return (
    <div className="space-y-6 pb-10">
      <PageHero
        icon={Mail}
        badge="Comunicaciones"
        title="Comprobantes de entrega"
        description="Recordatorio a los clientes con cargas pre-alertadas de los últimos 30 días: deben registrar la fecha en que el vendedor entregó el paquete y subir la foto del comprobante, dentro de las 48 horas siguientes al correo, para respaldar la cobertura del seguro."
        loadingLabel={loading ? 'Preparando la campaña…' : undefined}
        actions={
          <>
            <Button variant="outline" onClick={handleSave} disabled={!draft || saving || sending}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar cambios
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirmar y enviar
            </Button>
          </>
        }
      />

      {loading || !draft ? (
        <div className="flex items-center justify-center rounded-3xl border border-border/70 bg-card py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <Card className="border-border/70 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <FileText className="h-4 w-4 text-primary" /> Mensaje del correo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-subject">Asunto</Label>
                    <Input
                      id="campaign-subject"
                      value={draft.subject}
                      onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
                      disabled={sending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-intro">Párrafo de apertura</Label>
                    <Textarea
                      id="campaign-intro"
                      rows={5}
                      value={draft.intro_text}
                      onChange={(event) => setDraft({ ...draft, intro_text: event.target.value })}
                      disabled={sending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Después de este párrafo el correo explica los 3 pasos para cargar la fecha y la foto dentro de Mis Paquetes.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-hours" className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5" /> Horas para cargar el comprobante
                    </Label>
                    <Input
                      id="campaign-hours"
                      type="number"
                      min={1}
                      max={168}
                      value={draft.deadline_hours}
                      onChange={(event) => setDraft({ ...draft, deadline_hours: Number(event.target.value) || 48 })}
                      disabled={sending}
                    />
                    <p className="text-xs text-muted-foreground">
                      El plazo se cuenta desde el momento en que sale cada correo.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <ImageIcon className="h-4 w-4 text-primary" /> Imágenes del correo
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Ejemplos del comprobante (Pinduoduo, 1688) y la guía dentro de la app. Sube una imagen o pega su enlace público.
                  </p>
                </CardHeader>
                <CardContent>
                  <CampaignImagesEditor
                    images={draft.images}
                    onChange={(images) => setDraft({ ...draft, images })}
                    disabled={sending}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <CampaignAudiencePanel
                totals={preview.totals}
                sample={preview.sample}
                loading={previewLoading}
                excludeNotified={excludeNotified}
                onToggleExclude={setExcludeNotified}
              />
              <CampaignEmailPreview html={preview.html} subject={draft.subject} loading={previewLoading} />
            </div>
          </div>

          <CampaignSendResults result={result} lastRun={lastRun} sending={sending} />
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar la campaña a {targets} clientes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se enviará el correo de comprobante de entrega a {targets} {targets === 1 ? 'cliente' : 'clientes'} con cargas
              pre-alertadas de los últimos 30 días, con un plazo de {draft?.deadline_hours || 48} horas desde la recepción.
              Después de enviarlo, cada correo queda registrado en el resultado por cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar sin enviar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Sí, enviar la campaña</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}