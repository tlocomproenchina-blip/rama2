import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { consolidation_tracking } = await req.json();

    if (!consolidation_tracking) {
      return Response.json({ error: 'consolidation_tracking es requerido' }, { status: 400 });
    }

    // Buscar la consolidación
    const consolidations = await base44.asServiceRole.entities.Consolidation.filter({ 
      consolidation_tracking 
    });

    if (consolidations.length === 0) {
      return Response.json({ error: 'Consolidación no encontrada' }, { status: 404 });
    }

    const consolidation = consolidations[0];

    // Actualizar los paquetes de vuelta a 'recibido'
    for (const pkgId of consolidation.package_ids || []) {
      await base44.asServiceRole.entities.Package.update(pkgId, {
        status: 'recibido',
        consolidation_id: null
      });
    }

    // Actualizar la solicitud de vuelta a 'aprobada'
    if (consolidation.consolidation_request_id) {
      await base44.asServiceRole.entities.ConsolidationRequest.update(
        consolidation.consolidation_request_id,
        {
          status: 'aprobada',
          consolidation_id: null
        }
      );
    }

    // Eliminar la factura asociada
    const invoices = await base44.asServiceRole.entities.Invoice.filter({ 
      consolidation_id: consolidation.id 
    });
    for (const invoice of invoices) {
      await base44.asServiceRole.entities.Invoice.delete(invoice.id);
    }

    // Eliminar AP y Pagos de Proveedor sincronizados relacionados a la consolidación
    let apDeleted = 0;
    let apLedgerDeleted = 0;
    let providerPaymentsDeleted = 0;
    let providerLedgersDeleted = 0;

    const apsRel = await base44.asServiceRole.entities.AccountsPayable.filter({ related_consolidation_id: consolidation.id });
    for (const ap of apsRel) {
      // Borrar ledger de AP
      const apLs = await base44.asServiceRole.entities.AccountsPayableLedger.filter({ ap_id: ap.id });
      for (const l of apLs) {
        await base44.asServiceRole.entities.AccountsPayableLedger.delete(l.id);
        apLedgerDeleted += 1;
      }

      // Buscar ProviderPayments que asignaron este AP
      const pps = await base44.asServiceRole.entities.ProviderPayment.filter({ provider_name: ap.vendor_name });
      for (const pp of pps) {
        const allocs = Array.isArray(pp.allocations) ? pp.allocations : [];
        if (allocs.some(a => a.ap_id === ap.id)) {
          const refKey = pp.reference || `PP:${pp.id}`;
          const ppl = await base44.asServiceRole.entities.ProviderPaymentLedger.filter({
            provider_name: pp.provider_name,
            transaction_type: 'pago',
            reference: refKey
          });
          for (const row of ppl) {
            await base44.asServiceRole.entities.ProviderPaymentLedger.delete(row.id);
            providerLedgersDeleted += 1;
          }
          await base44.asServiceRole.entities.ProviderPayment.delete(pp.id);
          providerPaymentsDeleted += 1;
        }
      }

      await base44.asServiceRole.entities.AccountsPayable.delete(ap.id);
      apDeleted += 1;
    }

    // Eliminar la consolidación
    await base44.asServiceRole.entities.Consolidation.delete(consolidation.id);

    return Response.json({ 
      success: true,
      message: 'Consolidación deshecha exitosamente',
      packages_restored: consolidation.package_ids?.length || 0,
      ap_deleted: apDeleted,
      ap_ledger_deleted: apLedgerDeleted,
      provider_payments_deleted: providerPaymentsDeleted,
      provider_ledgers_deleted: providerLedgersDeleted
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});