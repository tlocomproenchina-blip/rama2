import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Reserva atómicamente un bloque de N números secuenciales de BULTO para un dispositivo.
// Usa el contador dedicado BultoNumberCounter, separado del contador de Shipping Mark
// de los clientes (ShippingMarkCounter): antes ambos compartían serie y cada bloque
// reservado por el almacén quemaba 50 números de la serie de los clientes.
// Si el contador de bultos no existe todavía, se siembra con el valor actual de la
// serie compartida para continuar la numeración sin repetir ninguna etiqueta impresa.
// Devuelve { start, end, block_id, next_number }.
// El dispositivo usa estos números localmente (offline) y los asigna a bultos.

const COUNTER_KEY = 'main';
const MAX_ATTEMPTS = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const blockSize = Math.min(Math.max(Number(body.block_size) || 50, 10), 200);
    const deviceId = String(body.device_id || '').trim() || 'unknown';

    // Punto de partida al crear el contador por primera vez: el último número ya
    // entregado por la serie compartida (así ninguna etiqueta impresa se repite).
    const seedLastNumber = async () => {
      const shared = await base44.asServiceRole.entities.ShippingMarkCounter.filter({ config_key: COUNTER_KEY }, '-updated_date', 1);
      const seed = Number(shared?.[0]?.last_number);
      return Number.isFinite(seed) ? seed : 49999;
    };

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const counters = await base44.asServiceRole.entities.BultoNumberCounter.filter({ config_key: COUNTER_KEY }, '-updated_date', 1);
      let counter = counters?.[0] || null;

      if (!counter) {
        try {
          const seed = await seedLastNumber();
          counter = await base44.asServiceRole.entities.BultoNumberCounter.create({
            config_key: COUNTER_KEY,
            last_number: seed,
          });
        } catch (_) {
          // Otro dispositivo lo creó al mismo tiempo: reintentar
          await sleep(60);
          continue;
        }
      }

      const oldValue = Number(counter.last_number) || 0;
      const start = oldValue + 1;
      const end = start + blockSize - 1;

      // Optimistic locking: solo gana quien encuentra el contador con el valor leído
      const result = await base44.asServiceRole.entities.BultoNumberCounter.updateMany(
        { config_key: COUNTER_KEY, last_number: oldValue },
        { $inc: { last_number: blockSize } }
      );

      if (result?.updated >= 1) {
        return Response.json({
          start,
          end,
          block_id: `block_${deviceId}_${Date.now()}`,
          next_number: start,
          block_size: blockSize,
        });
      }

      await sleep(60);
    }

    return Response.json({ error: 'No se pudo reservar un bloque de números de bulto tras varios intentos (concurrencia).' }, { status: 500 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}