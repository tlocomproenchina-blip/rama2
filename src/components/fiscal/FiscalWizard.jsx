import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { computeTotals } from '@/lib/fiscalCalc';
import { fiscalCall } from '@/lib/fiscalApi';
import { invokeErrorMessage } from '@/lib/invokeErrorMessage';
import { buildPayload, firstStepWithErrors, validateLines, validatePayment, validateTaxData } from '@/lib/fiscalForm';
import FiscalStepper from '@/components/fiscal/FiscalStepper';
import FiscalTaxDataStep from '@/components/fiscal/FiscalTaxDataStep';
import FiscalLinesStep from '@/components/fiscal/FiscalLinesStep';
import FiscalTotalsSummary from '@/components/fiscal/FiscalTotalsSummary';
import FiscalVatPaymentStep from '@/components/fiscal/FiscalVatPaymentStep';
import useFiscalForm from '@/components/fiscal/useFiscalForm';

const STEP_TITLES = { 1: 'Datos de identificación fiscal', 2: 'Detalle de productos o servicios', 3: 'Resumen y pago del IVA' };

export default function FiscalWizard({ request, methods, previous, onChanged }) {
  const { form, setForm, clearLocal } = useFiscalForm(request);
  const [step, setStep] = useState(request.status === 'comprobante_rechazado' ? 3 : 1);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const totals = useMemo(() => computeTotals(form.lines), [form.lines]);
  const vp = request.vat_payment || {};
  const verified = vp.verification_status === 'verificado' && Math.round(Number(vp.verified_amount || 0) * 100) === Math.round(totals.vat_amount * 100);
  const rejectionNote = request.status === 'comprobante_rechazado' ? vp.verification_notes : '';

  const reuse = () => {
    setForm((f) => ({
      ...f,
      legal_name: previous.legal_name,
      rif: previous.rif,
      fiscal_address: previous.fiscal_address,
      rif_document_uri: previous.rif_document_uri,
      rif_document_type: previous.rif_document_type || '',
    }));
    toast.success('Datos fiscales cargados. Puedes modificarlos antes de enviar.');
  };

  const next = () => {
    const e = step === 1 ? validateTaxData(form) : validateLines(form);
    setErrors(e);
    if (Object.keys(e).length) return toast.error('Completa los datos obligatorios');
    setStep(step + 1);
  };

  const run = async (action, label) => {
    setBusy(action);
    try {
      const res = await fiscalCall(action, { id: request.id, ...buildPayload(form) });
      clearLocal();
      toast.success(label);
      onChanged(res.request, action === 'submit');
    } catch (err) {
      toast.error(invokeErrorMessage(err, 'No se pudo completar la acción. Intenta de nuevo.'));
    } finally {
      setBusy('');
    }
  };

  const saveDraft = () => run('saveDraft', 'Borrador guardado');

  const submit = () => {
    const e = { ...validateTaxData(form), ...validateLines(form), ...(verified ? {} : validatePayment(form, totals.vat_amount)) };
    setErrors(e);
    if (Object.keys(e).length) {
      setStep(firstStepWithErrors(e));
      return toast.error('Revisa los datos marcados antes de enviar');
    }
    run('submit', 'Solicitud enviada');
  };

  return (
    <div className="space-y-5">
      <FiscalStepper current={step} onStep={setStep} />
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">{STEP_TITLES[step]}</h2>
          {step === 1 && <FiscalTaxDataStep form={form} setForm={setForm} errors={errors} previous={previous} onReuse={reuse} />}
          {step === 2 && (
            <>
              <FiscalLinesStep form={form} setForm={setForm} error={errors.lines} />
              <FiscalTotalsSummary subtotal={totals.subtotal} vat={totals.vat_amount} total={totals.total} />
            </>
          )}
          {step === 3 && (
            <>
              <FiscalTotalsSummary subtotal={totals.subtotal} vat={totals.vat_amount} total={totals.total} />
              <FiscalVatPaymentStep form={form} setForm={setForm} methods={methods} vatAmount={totals.vat_amount} errors={errors} verified={verified} rejectionNote={rejectionNote} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" disabled={step === 1 || !!busy} onClick={() => setStep(step - 1)}>
          <ArrowLeft className="h-4 w-4" /> Atrás
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!!busy} onClick={saveDraft}>
            {busy === 'saveDraft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar borrador
          </Button>
          {step < 3 ? (
            <Button type="button" onClick={next}>Siguiente <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" disabled={!!busy} onClick={submit}>
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} ENVIAR SOLICITUD PARA VERIFICACIÓN
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}