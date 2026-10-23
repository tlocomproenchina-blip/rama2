// Número de etiqueta del almacén (un solo contador para bultos y cajas).
//
// Lo usan combineBultos (unidad nueva al fusionar) y desarmarCaja (unidad que se
// restaura cuando se deshace una caja consolidada). Se reserva con updateMany
// condicional para que dos dispositivos nunca obtengan el mismo número.
const COUNTER_KEY = 'main';
const text = (value: any) => String(value ?? '').trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function nextBultoNumber(base44: any) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const rows = await base44.asServiceRole.entities.BultoNumberCounter
      .filter({ config_key: COUNTER_KEY }, '-updated_date', 1)
      .catch(() => []);
    let counter = rows?.[0] || null;

    if (!counter) {
      const shared = await base44.asServiceRole.entities.ShippingMarkCounter
        .filter({ config_key: COUNTER_KEY }, '-updated_date', 1)
        .catch(() => []);
      const seed = Number(shared?.[0]?.last_number);
      try {
        counter = await base44.asServiceRole.entities.BultoNumberCounter.create({
          config_key: COUNTER_KEY,
          last_number: Number.isFinite(seed) ? seed : 49999,
        });
      } catch (_) {
        await sleep(60);
        continue;
      }
    }

    const oldValue = Number(counter.last_number) || 0;
    const result = await base44.asServiceRole.entities.BultoNumberCounter.updateMany(
      { config_key: COUNTER_KEY, last_number: oldValue },
      { $inc: { last_number: 1 } }
    );
    if (result?.updated >= 1) return oldValue + 1;
    await sleep(60);
  }
  return null;
}

// Código de etiqueta libre: se conserva el original si nadie lo está usando (así la
// etiqueta ya pegada sigue sirviendo); si choca con otro bulto se reserva uno nuevo.
export async function freeLabelCode(base44: any, preferredLabel: string) {
  const preferred = text(preferredLabel);
  if (preferred) {
    const rows = await base44.asServiceRole.entities.Bulto
      .filter({ label_code: preferred }, '-created_date', 1)
      .catch(() => []);
    if (!rows?.length) return { label_code: preferred, number: null };
  }

  const number = await nextBultoNumber(base44);
  if (!number) return null;
  const mark = text(preferred).replace(/-[A-Z]+\d+$/i, '') || '';
  return { label_code: mark ? `${mark}-B${number}` : `B${number}`, number };
}