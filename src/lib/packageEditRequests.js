import { base44 } from '@/api/base44Client';

const day = (value) => String(value || '').slice(0, 10);

// Lleva al paquete los cambios que el ATC pidió desde el asistente: es el paso
// con el que Supervisión confirma lo que ya revisó. El pago del seguro queda
// registrado pero pendiente: la aprobación sigue siendo de administración.
export async function applyPackageEditRequest(request, user, reviewNote = '') {
  const pkg = await base44.entities.Package.get(request.package_id);
  if (!pkg) throw new Error('No se encontró el paquete');

  const packageUpdates = {};
  const nextTracking = String(request.tracking_number_new || '').trim();
  if (nextTracking && nextTracking !== (pkg.tracking_number || '')) {
    packageUpdates.tracking_number = nextTracking;
  }
  if (request.dispatched_date && day(pkg.dispatched_date) !== request.dispatched_date) {
    packageUpdates.dispatched_date = new Date(`${request.dispatched_date}T12:00:00`).toISOString();
  }
  if (request.dispatch_proof?.url && request.dispatch_proof.url !== pkg.dispatch_confirmation_image_url) {
    packageUpdates.dispatch_confirmation_image_url = request.dispatch_proof.url;
  }
  if (Object.keys(packageUpdates).length) {
    await base44.entities.Package.update(pkg.id, packageUpdates);
  }

  const insuranceUpdates = {};
  if (request.insurance_amount !== null && request.insurance_amount !== undefined) {
    insuranceUpdates.amount = Number(request.insurance_amount) || 0;
  }
  if (request.insurance_proof?.url) {
    insuranceUpdates.proof_url = request.insurance_proof.url;
  }

  if (Object.keys(insuranceUpdates).length) {
    const rows = await base44.entities.InsurancePayment.filter({ package_id: pkg.id }, '-created_date', 1);
    const existing = (rows || [])[0] || null;
    if (existing) {
      await base44.entities.InsurancePayment.update(existing.id, {
        ...insuranceUpdates,
        status: 'pendiente',
        reject_reason: '',
        rejected_date: null,
        reported_date: new Date().toISOString(),
      });
    } else {
      const fob = Number(pkg.fob_value) || 0;
      const amount = Number(request.insurance_amount) || fob;
      await base44.entities.InsurancePayment.create({
        client_email: pkg.client_email || request.client_email,
        tracking_number: packageUpdates.tracking_number || pkg.tracking_number,
        package_id: pkg.id,
        fob_value: fob || amount,
        insurance_percentage: fob > 0 ? Number(((amount / fob) * 100).toFixed(2)) : 0,
        amount,
        method: 'otro',
        proof_url: request.insurance_proof?.url || '',
        status: 'pendiente',
        reported_date: new Date().toISOString(),
      });
    }
  }

  const reviewed = {
    status: 'aplicada',
    reviewed_by_email: user?.email || '',
    reviewed_by_name: user?.full_name || user?.email || 'Supervisión',
    reviewed_date: new Date().toISOString(),
    review_note: String(reviewNote || '').trim(),
  };
  await base44.entities.PackageEditRequest.update(request.id, reviewed);
  return { ...request, ...reviewed };
}

// Cierra la solicitud sin tocar el paquete: lo que el ATC pidió no se aplicó y
// queda registrado el motivo para que sepa qué hacer con el cliente.
export async function rejectPackageEditRequest(request, user, reviewNote = '') {
  const reviewed = {
    status: 'rechazada',
    reviewed_by_email: user?.email || '',
    reviewed_by_name: user?.full_name || user?.email || 'Supervisión',
    reviewed_date: new Date().toISOString(),
    review_note: String(reviewNote || '').trim(),
  };
  await base44.entities.PackageEditRequest.update(request.id, reviewed);
  return { ...request, ...reviewed };
}