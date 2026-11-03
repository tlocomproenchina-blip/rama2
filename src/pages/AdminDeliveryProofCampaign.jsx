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
import { Mail, Send, Loader2, Save, ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';
import CampaignImagesEditor from '@/components/delivery-proof/CampaignImagesEditor';
import CampaignAudiencePanel from '@/components/delivery-proof/CampaignAudiencePanel';
import CampaignSendChannel from '@/components/delivery-proof/CampaignSendChannel';
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
  const [provider, setProvider] = useState('brevo');
  // Grupo de destinatarios: la audiencia completa (con Shipping Mark) o la
  // selección personalizada que el admin marca cliente por cliente.
  const [group, setGroup] = useState('elegibles');
  const [selectedEmails, setSelectedEmails] = useState([]);
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
          images: config.images || []
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
     
  }, []);

  // La vista previa se rearma sola al editar el asunto, el texto o las imágenes.
  useEffect(() => {
    if (!draft) return;
    if (skipAuto.current) {
      skipAuto.current = false;
      return;
    }
    const timer = setTimeout(() => {
      refreshPreview({
        ...draft,
        exclude_notified: excludeNotified,
        group,
        recipient_emails: selectedEmails
      });
    }, 700);
    return () => clearTimeout(timer);
     
  }, [draft, excludeNotified, group, selectedEmails]);

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
    let sent = 0;
    let failed = 0;
    let lastResults = [];
    let status = 'enviada';
    try {
      // Una sola confirmación: se piden lotes seguidos hasta cubrir a todos los
      // clientes pendientes, sin repetir a los que ya recibieron el correo.
      for (;;) {
        const data = await call({
          action: 'send',
          confirm: true,
          exclude_notified: excludeNotified,
          provider,
          group,
          recipient_emails: selectedEmails,
          ...draft
        });
        if (!data?.ok) throw new Error(data?.error || 'No se pudo enviar la campaña');

        sent += Number(data.sent || 0);
        failed += Number(data.failed || 0);
        lastResults = data.results || lastResults;
        status = failed === 0 ? 'enviada' : sent === 0 ? 'fallida' : 'parcial';
        if (data.totals) setPreview((prev) => ({ ...prev, totals: data.totals }));

        const remaining = Number(data.remaining || 0);
        const continues = remaining > 0 && Number(data.sent || 0) > 0;
        const runDate = new Date().toISOString();
        const message = continues
          ? `Enviando… ${sent} correos entregados${failed ? `, ${failed} fallidos` : ''}. Faltan ${remaining} clientes.`
          : '';
        setResult({ status, results: lastResults, sent, failed, date: runDate, message: message || data.message });
        setLastRun({ status, results: lastResults, sent, failed, date: runDate, message: message || data.message });

        if (continues) continue;
        if (remaining > 0) {
          toast.warning(`El envío se detuvo con ${remaining} clientes pendientes: el último lote no pudo entregarse.`);
        }
        break;
      }

      const channel = provider === 'base44' ? 'Base44' : 'Brevo';
      const summary = failed
        ? `Enviado por ${channel}: ${sent} correos entregados, ${failed} fallidos.`
        : `Enviado por ${channel}: ${sent} correos entregados.`;
      setResult({ status, results: lastResults, sent, failed, date: new Date().toISOString(), message: summary });
      setLastRun({ status, results: lastResults, sent, failed, date: new Date().toISOString(), message: summary });
      toast.success(summary);
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
        description="Correo para todos los clientes con Shipping Mark asignado: desde que lo reciben, cargar la fecha en que el vendedor entregó el paquete y la foto del comprobante es obligatorio para que el seguro de su carga pueda ser válido."
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
              <CampaignSendChannel provider={provider} onChange={setProvider} disabled={sending} />
              <CampaignAudiencePanel
                totals={preview.totals}
                sample={preview.sample}
                loading={previewLoading}
                excludeNotified={excludeNotified}
                onToggleExclude={setExcludeNotified}
                group={group}
                onGroupChange={setGroup}
                selected={selectedEmails}
                onSelectionChange={setSelectedEmails}
                disabled={sending}
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
              {group === 'personalizada'
                ? `Se enviará el correo del comprobante de entrega solo a los ${targets} ${targets === 1 ? 'cliente' : 'clientes'} que seleccionaste.`
                : `Se enviará el correo del comprobante de entrega a ${targets} ${targets === 1 ? 'cliente' : 'clientes'} con Shipping Mark asignado.`}{' '}
              El correo les avisa que, desde su recepción, cargar la fecha y la foto del
              comprobante es obligatorio para que el seguro de su carga sea válido. El envío sale por{' '}
              <strong>{provider === 'base44' ? 'Base44 (créditos de integración)' : 'Brevo'}</strong>. El envío sigue
              solo hasta cubrir a todos los clientes pendientes y cada correo queda registrado en el resultado por
              cliente.
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