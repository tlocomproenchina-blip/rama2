// Combinar unidades en la mesa de empaque.
//
// Varias unidades abiertas del mismo cliente (bultos sueltos y cajas) se fusionan en una
// unidad nueva con su propio código: paquetes, trackings, códigos sin registrar, N° de
// contenedor y constancia de lo combinado. Las originales se borran del dispositivo y, al
// cerrar la unidad nueva, el servidor recibe sus etiquetas en `combine_codes` para
// eliminarlas allí. Nunca se borra una fuente antes de que la unidad nueva exista.
import { put } from '@/lib/offlineDb';
import { dropLocalBultoFromQueue } from '@/lib/cajaLocal';
import { realPackageCount } from '@/lib/bultoCounts';

const text = (value) => String(value ?? '').trim();
const uniq = (list) => [...new Set((list || []).map(text).filter(Boolean))];
const from = (units, pick) => units.flatMap((unit) => pick(unit) || []);

// Contenido de la unidad nueva: todo lo de las unidades combinadas, sin repetir.
export function buildCombinedUnit(target, sources, actor = '') {
  const now = new Date().toISOString();
  return {
    ...target,
    package_ids: uniq([...(target.package_ids || []), ...from(sources, (u) => u.package_ids)]),
    package_trackings: uniq([
      ...(target.package_trackings || []),
      ...from(sources, (u) => u.package_trackings),
    ]),
    unregistered_codes: uniq([
      ...(target.unregistered_codes || []),
      ...from(sources, (u) => u.unregistered_codes),
    ]),
    cbm_order_numbers: uniq([
      ...(target.cbm_order_numbers || []),
      ...from(sources, (u) => u.cbm_order_numbers),
    ]),
    // Las etiquetas de las cajas combinadas también viajan al cerrar, para que el
    // servidor elimine lo que haya quedado registrado de ellas.
    absorbed_codes: uniq([
      ...(target.absorbed_codes || []),
      ...from(sources, (u) => [...(u.absorbed_codes || []), u.label_code]),
    ]),
    absorbed_bultos: [
      ...(target.absorbed_bultos || []),
      ...sources.map((source) => ({
        label_code: text(source.label_code),
        bulto_number: Number(source.bulto_number) || 0,
        package_count: realPackageCount(source),
        order_numbers: source.cbm_order_numbers || [],
        status: text(source.status),
        printed: Number(source.print_count) > 0,
        trackings: uniq(source.package_trackings),
        absorbed_at: now,
        absorbed_by: actor,
      })),
    ],
    combined_codes: uniq(sources.map((source) => source.label_code)),
  };
}

// Guarda la unidad combinada y suelta las originales del dispositivo y de la cola de
// sincronización, para que no se registren por separado al reconectar.
export async function combineUnitsLocally(target, sources, actor = '') {
  const combined = buildCombinedUnit(target, sources, actor);
  await put('bultos', combined);
  for (const source of sources) {
    await dropLocalBultoFromQueue(source);
  }
  return combined;
}