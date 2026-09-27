import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { waitUntil } from 'base44:runtime';
import { authenticateIntegratedApp, touchIntegratedApp, saveStatusReport, errorResponse } from '../../shared/integratedApps.ts';
import { runOperation, auditPayload, RESOURCE_LABELS } from '../../shared/integratedAppResources.ts';

async function writeAudit(base44, payload) {
  try {
    await base44.asServiceRole.entities.ActivityAuditLog.create(payload);
  } catch (_) {
    // la auditoría no debe romper la operación de la copia
  }
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const rawKey = req.headers.get('x-app-key') || body?.app_key || '';

    const auth = await authenticateIntegratedApp(base44, rawKey);
    if (auth.error) return auth.error;
    const app = auth.app;

    const resource = String(body?.resource || '').trim().toLowerCase();
    const operation = String(body?.operation || '').trim().toLowerCase();

    if (!resource) {
      return errorResponse('missing_resource', 'Indica "resource": clients, prealerts, invoices o payments.', 400);
    }

    if (resource === 'health' || resource === 'ping') {
      const report = body?.report;
      // El reporte de la copia y la marca de uso se guardan en orden para no pisarse.
      waitUntil((async () => {
        if (report) await saveStatusReport(base44, app, report);
        await touchIntegratedApp(base44, app, 'health');
      })());
      return Response.json({
        ok: true,
        service: 'integratedAppApi',
        app: { name: app.name, slug: app.slug },
        resources: Object.keys(RESOURCE_LABELS),
        operations: ['list', 'get', 'create', 'update', 'delete'],
        timestamp: new Date().toISOString()
      });
    }

    if (!RESOURCE_LABELS[resource]) {
      return errorResponse('unknown_resource', `Recurso no permitido: ${resource}. Usa clients, prealerts, invoices o payments.`, 400);
    }
    if (!operation) return errorResponse('missing_operation', 'Indica "operation": list, get, create, update o delete.', 400);

    const result = await runOperation(base44, app, resource, operation, body);

    waitUntil(touchIntegratedApp(base44, app, `${resource}.${operation}`));
    const audit = auditPayload(app, result.audit);
    if (audit) waitUntil(writeAudit(base44, audit));

    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return Response.json(
      { ok: false, error: { code: 'server_error', message: error?.message || 'Error inesperado en el servicio.' } },
      { status: 500 }
    );
  }
}