import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import PackageEditRequestRow from '@/components/support/package-edit/PackageEditRequestRow';
import { applyPackageEditRequest, rejectPackageEditRequest } from '@/lib/packageEditRequests';

// Solicitud de cambio de paquete vista por Supervisión: aquí se decide si los
// datos y las imágenes pasan al paquete o se devuelven al ATC con el motivo.
export default function PackageEditReviewCard({ request, user, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');

  const handle = async (apply) => {
    setBusy(apply ? 'aplicar' : 'rechazar');
    try {
      if (apply) {
        await applyPackageEditRequest(request, user, note);
        toast.success('Cambios aplicados al paquete');
      } else {
        await rejectPackageEditRequest(request, user, note);
        toast.success('Solicitud rechazada');
      }
      onDone?.();
    } catch {
      toast.error(apply ? 'No se pudieron aplicar los cambios' : 'No se pudo rechazar la solicitud');
    }
    setBusy('');
  };

  return (
    <PackageEditRequestRow
      request={request}
      actions={(
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5">
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={!!busy}
            placeholder="Nota para el ATC: qué revisaste o por qué no se aplica…"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => handle(true)} disabled={!!busy}>
              {busy === 'aplicar' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Aplicar al paquete
            </Button>
            <Button size="sm" variant="outline" onClick={() => handle(false)} disabled={!!busy}>
              {busy === 'rechazar' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
              No aplicar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Al aplicar, los datos quedan en el paquete y el pago del seguro vuelve a la bandeja de validación de administración: la aprobación no la hace Soporte.
          </p>
        </div>
      )}
    />
  );
}