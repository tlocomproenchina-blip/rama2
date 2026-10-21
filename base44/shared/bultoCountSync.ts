// Sincroniza las guías de despacho ya emitidas cuando cambia el conteo de paquetes de un
// bulto o cuando un bulto se une dentro de otro.
//
// - La línea del bulto corregido queda con la cantidad nueva de paquetes.
// - La línea de un bulto que dejó de existir (se unió dentro de otro) se quita.
// - Se recalculan los totales del cliente y de la guía, y los códigos incluidos.
//
// Así la guía impresa/reimpresa y el informe de contenedores por cliente muestran el
// conteo corregido, sin depender de volver a emitir la guía.
import { normCode, recomputeGuideTotals, unique } from './dispatchGuideAppend.ts';

export async function syncGuidesAfterBultoChange(
  base44: any,
  { counts = {}, removedCodes = [], actor = '' }: any
): Promise<{ guides: number }> {
  const countMap = new Map<string, number>();
  for (const [code, value] of Object.entries(counts || {})) {
    const key = normCode(code);
    if (key) countMap.set(key, Number(value) || 0);
  }
  const removed = unique((removedCodes || []).map(normCode));
  const touched = unique([...countMap.keys(), ...removed]);
  if (!touched.length) return { guides: 0 };

  // Guías que contienen alguno de esos bultos (una guía puede contener varios).
  const byId = new Map<string, any>();
  for (const code of touched) {
    const rows: any[] = await base44.asServiceRole.entities.DispatchGuide
      .filter({ bulto_codes: code }, '-emitted_date', 50)
      .catch(() => []);
    for (const guide of rows || []) {
      if (guide?.id) byId.set(guide.id, guide);
    }
  }

  let updated = 0;
  for (const guide of byId.values()) {
    const clients = (Array.isArray(guide.clients) ? guide.clients : []).map((client: any) => {
      const bultos = (client.bultos || []).flatMap((line: any) => {
        const code = normCode(line?.label_code);
        if (removed.includes(code)) return [];
        if (!countMap.has(code)) return [line];
        return [{ ...line, package_count: countMap.get(code) }];
      });
      const totals = {
        ...(client.totals || {}),
        bultos: bultos.length,
        packages: bultos.reduce(
          (sum: number, line: any) => sum + (Number(line.package_count) || 0),
          0
        ),
      };
      return { ...client, bultos, totals };
    }).filter((client: any) => (client.bultos || []).length > 0);

    if (JSON.stringify(clients) === JSON.stringify(guide.clients || [])) continue;

    const codesInGuide = unique(
      clients.flatMap((client: any) => (client.bultos || []).map((line: any) => normCode(line?.label_code)))
    );

    await base44.asServiceRole.entities.DispatchGuide.update(guide.id, {
      clients,
      bulto_codes: codesInGuide,
      totals: recomputeGuideTotals(clients),
      last_updated_date: new Date().toISOString(),
      last_updated_by: actor || 'Ajuste de conteo',
    });
    updated += 1;
  }

  return { guides: updated };
}