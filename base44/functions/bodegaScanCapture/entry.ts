import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { uploadBase64ToBunny } from '../../shared/bunnyUpload.ts';

// Captura del almacén de China: sube la foto y deja el trabajo en la cola.
//
// Es lo único que espera la pantalla del escáner: la foto queda guardada en Bunny
// y el trabajo persistido con estado 'pendiente'. La búsqueda del paquete, la
// lectura del código, la asignación al cliente y los avisos corren después, en
// processBodegaScanQueue, sin bloquear la siguiente captura.
//
// Igual que el escaneo de siempre, va por dispositivo (device_id) y no exige
// sesión: la pantalla del almacén se usa desde el dispositivo registrado.
// Recibe: { device_id, image_base64, hint_tracking? }
// Devuelve: { queued, job_id, photo_url, upload_ms, queue_ms }
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const deviceId = String(body.device_id || '').trim();
    if (!deviceId) return Response.json({ error: 'device_id requerido' }, { status: 400 });

    const skipPhoto = body.skip_photo === true;
    const imageBase64 = String(body.image_base64 || '');
    if (!skipPhoto && !imageBase64) {
      return Response.json({ error: 'image_base64 es requerido' }, { status: 400 });
    }

    const startedAt = Date.now();
    let photoUrl: string | null = null;

    if (!skipPhoto) {
      try {
        photoUrl = await uploadBase64ToBunny(imageBase64);
      } catch (err: any) {
        // La foto no se pierde en silencio: la pantalla avisa y deja la captura
        // lista para reintentar la subida.
        return Response.json(
          { error: err?.message || 'No se pudo subir la foto', upload_failed: true },
          { status: err?.status || 502 },
        );
      }
    }
    const uploadMs = Date.now() - startedAt;

    const job = await base44.asServiceRole.entities.BodegaScanJob.create({
      device_id: deviceId,
      photo_url: photoUrl,
      hint_tracking: String(body.hint_tracking || '').trim(),
      status: 'pendiente',
      attempts: 0,
      queued_date: new Date().toISOString(),
      upload_ms: uploadMs,
    });

    return Response.json({
      queued: true,
      job_id: job.id,
      photo_url: photoUrl,
      upload_ms: uploadMs,
      queue_ms: Date.now() - startedAt,
    });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}