import { base44 } from '@/api/base44Client';

// Captura del escáner de bodega: la foto y el trabajo que la procesará.
//
// La pantalla solo espera a que la foto quede subida y el trabajo guardado en la
// cola; la búsqueda del paquete, la lectura del código y los avisos corren en el
// backend sin bloquear la siguiente captura.

export async function captureScanJob({ imageBase64, deviceId, hintTracking, skipPhoto }) {
  const { data } = await base44.functions.invoke('bodegaScanCapture', {
    device_id: deviceId,
    image_base64: skipPhoto ? '' : imageBase64,
    skip_photo: skipPhoto === true,
    hint_tracking: hintTracking || '',
  });
  if (!data?.job_id) throw new Error(data?.error || 'No se pudo registrar la captura');
  return data;
}

// Dispara el procesamiento sin dejar la pantalla esperando el resultado.
export function kickScanQueue(jobIds) {
  if (!jobIds?.length) return;
  base44.functions.invoke('processBodegaScanQueue', { job_ids: jobIds }).catch(() => {});
}

// Estado de las capturas en curso, para mostrarlo en la pantalla.
export async function fetchScanStatus(jobIds) {
  if (!jobIds?.length) return [];
  const { data } = await base44.functions.invoke('processBodegaScanQueue', {
    action: 'status',
    job_ids: jobIds,
  });
  return data?.jobs || [];
}

// Devuelve una captura con error a la cola para volver a intentarla.
export async function retryScanJob(jobId) {
  if (!jobId) return;
  await base44.functions.invoke('processBodegaScanQueue', { action: 'retry', job_ids: [jobId] });
}