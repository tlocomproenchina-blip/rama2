// Verificación de todos los paquetes: busca el MISMO envío registrado dos veces —la
// pre-alerta que declaró el cliente y la carga que el almacén dio de alta por su
// cuenta— y aplica la regla de unificación: se conserva el registro del cliente (su
// descripción, sus datos y su foto) sumándole la evidencia de la recepción, y el
// registro de carga se retira. Un envío nunca queda dos veces.
//
// Corre primero en modo revisión (dry_run) y no cambia nada hasta que se pide aplicar.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  hasReceptionEvidence,
  isPendingPrealert,
  looksGenericDescription,
  unifyOrphanIntoClientRecord,
} from '../../shared/orphanConsolidation.ts';
import { fetchAllFilter } from '../../shared/paginatedFetch.ts';

// El registro que el cliente declaró: su pre-alerta (pendiente o ya recibida) con su
// descripción de producto o su foto. Los registros que el almacén dio de alta por su
// cuenta traen una descripción genérica de carga sin pre-alerta.
function isDeclaredRecord(pkg: any): boolean {
  if (isPendingPrealert(pkg)) return true;
  if (String(pkg?.product_image_url || '').trim()) return true;
  return !looksGenericDescription(pkg);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// La base de datos corta las ráfagas de escritura: cada unificación se reintenta con
// una pequeña espera antes de darla por fallida. Si el registro ya no está, la
// unificación ya se había hecho: no es un error.
async function unifyWithRetries(task: () => Promise<any>, attempts = 4) {
  let lastError: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (error: any) {
      if (String(error?.message || '') === 'orphan_not_found') return null;
      lastError = error;
      await sleep(700 * (i + 1));
    }
  }
  throw lastError;
}

function briefRecord(pkg: any) {
  return {
    id: pkg.id,
    estado: pkg.status,
    descripcion: pkg.description || '',
    recibido: hasReceptionEvidence(pkg),
    fotos: Array.isArray(pkg.package_image_urls) ? pkg.package_image_urls.length : 0,
  };
}

// Todos los paquetes, página por página.
function loadAllPackages(base44: any) {
  return fetchAllFilter(base44.asServiceRole.entities.Package, {}, '-created_date');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo un administrador puede correr esta verificación' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Por defecto solo revisa: hay que pedir expresamente que unifique.
    const dryRun = body?.dry_run !== false;
    // Las unificaciones se aplican por tandas: cada una escribe y borra, y una
    // corrida muy larga se topa con el límite de la base de datos.
    const maxPerRun = Math.max(1, Math.min(Number(body?.limit) || 15, 60));

    const rows = await loadAllPackages(base44);
    const groups = new Map<string, any[]>();
    for (const row of rows) {
      const tracking = String(row?.tracking_number || '').trim();
      if (!tracking) continue;
      if (!groups.has(tracking)) groups.set(tracking, []);
      groups.get(tracking)!.push(row);
    }

    const unified: any[] = [];
    const pendientes: any[] = [];
    const fallidos: any[] = [];
    const review: any[] = [];
    const work: { tracking: string; client_email: string; keeper: any; absorbed: any[] }[] = [];

    for (const [tracking, list] of groups) {
      if (list.length < 2) continue;

      const byClient = new Map<string, any[]>();
      for (const row of list) {
        const email = String(row?.client_email || '').trim().toLowerCase();
        if (!email) continue;
        if (!byClient.has(email)) byClient.set(email, []);
        byClient.get(email)!.push(row);
      }

      for (const [email, records] of byClient) {
        if (records.length < 2) continue;

        const declared = records.filter(isDeclaredRecord);
        const load = records.filter((p) => !isDeclaredRecord(p));

        // Una sola declaración del cliente y al menos un registro de carga: es el mismo
        // envío registrado dos veces. Con dos declaraciones propias no se toca nada:
        // pueden ser dos bultos del mismo tracking que el cliente declaró por separado.
        if (declared.length === 1 && load.length >= 1) {
          work.push({ tracking, client_email: email, keeper: declared[0], absorbed: load });
          continue;
        }

        review.push({
          tracking,
          client_email: email,
          motivo: declared.length === 0 ? 'sin_registro_del_cliente' : `${declared.length}_registros_del_cliente`,
          registros: records.map(briefRecord),
        });
      }

      // Cargas sin cliente repetidas (el mismo paquete dado de alta dos veces): se
      // informan, no se tocan aquí.
      const unowned = list.filter((p) => !String(p?.client_email || '').trim());
      if (unowned.length > 1) {
        review.push({
          tracking,
          client_email: '',
          motivo: 'cargas_sin_cliente_repetidas',
          registros: unowned.map(briefRecord),
        });
      }
    }

    // Respiro antes de empezar a escribir: la lectura completa de los paquetes ya
    // consumió su propia ráfaga.
    if (!dryRun && work.length > 0) await sleep(800);

    for (const item of work) {
      if (dryRun) {
        unified.push({
          tracking: item.tracking,
          client_email: item.client_email,
          conserva: { id: item.keeper.id, descripcion: item.keeper.description || '', estado: item.keeper.status },
          retira: item.absorbed.map((p) => ({ id: p.id, descripcion: p.description || '' })),
        });
        continue;
      }

      if (unified.length >= maxPerRun) {
        pendientes.push({ tracking: item.tracking, client_email: item.client_email });
        continue;
      }

      let current = item.keeper;
      const removed: string[] = [];
      try {
        for (const record of item.absorbed) {
          const result = await unifyWithRetries(() => unifyOrphanIntoClientRecord({
            base44,
            orphan: record,
            clientRecord: current,
            shippingMark: item.keeper.shipping_mark,
            by: `Verificación de duplicados (${user.email})`,
          }));
          if (result?.package) current = result.package;
          if (result?.removed_orphan_id) removed.push(result.removed_orphan_id);
        }
      } catch (error: any) {
        // La base de datos cortó la tanda (límite de velocidad): lo que falte se
        // retoma en la corrida siguiente, sin repetir lo ya unificado.
        fallidos.push({
          tracking: item.tracking,
          client_email: item.client_email,
          motivo: String(error?.message || error),
        });
        unified.push({
          tracking: item.tracking,
          client_email: item.client_email,
          conserva: { id: current.id, descripcion: current.description || '', estado: current.status },
          retira: removed,
        });
        break;
      }

      unified.push({
        tracking: item.tracking,
        client_email: item.client_email,
        conserva: { id: current.id, descripcion: current.description || '', estado: current.status },
        retira: removed,
      });
      // Pausa entre unificaciones: cada una escribe y borra, y sin respirar se topa
      // el límite de la base de datos.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return Response.json({
      dry_run: dryRun,
      paquetes_revisados: rows.length,
      envios_con_repetidos: Array.from(groups.values()).filter((l) => l.length > 1).length,
      unificados: unified.length,
      pendientes_en_otra_tanda: pendientes.length,
      cortados_por_limite: fallidos.length,
      por_revisar: review.length,
      detalle_unificados: unified.slice(0, 80),
      detalle_por_revisar: review.slice(0, 40),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});