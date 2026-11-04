// Cola persistente (IndexedDB) de revisiones de paquetes de la Mesa de empaque.
// La revisión se guarda en el dispositivo al instante con sus fotos y se sube en
// segundo plano: primero las fotos (cada una se recuerda al subir, así un reintento
// no la vuelve a subir) y luego el registro. Sobrevive recargas y cortes de red, y
// el servidor no la duplica porque usa la misma clave de revisión.
import { base44 } from '@/api/base44Client';
import { put, getAll, del } from '@/lib/offlineDb';

const STORE = 'review_queue';
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export const onReviewQueueChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const listReviewQueue = async () =>
  (await getAll(STORE)).sort((a, b) => (a.created_at || 0) - (b.created_at || 0));

const save = async (item) => {
  await put(STORE, item);
  notify();
};

const uploadPhoto = async (blob) => {
  const file = blob instanceof File ? blob : new File([blob], 'revision.jpg', { type: blob?.type || 'image/jpeg' });
  const up = await base44.integrations.Core.UploadPrivateFile({ file });
  const uri = up?.file_uri || up?.data?.file_uri;
  if (!uri) throw new Error('No se pudo subir la foto');
  return uri;
};

async function processOne(item) {
  let cur = { ...item, status: 'syncing', error: '' };
  await save(cur);
  try {
    if (!cur.content_uri) {
      cur = { ...cur, content_uri: await uploadPhoto(cur.content_photo) };
      await save(cur);
    }
    const damage = cur.damage_photos || [];
    const uris = [...(cur.damage_uris || [])];
    for (let i = uris.length; i < damage.length; i++) {
      uris.push(await uploadPhoto(damage[i]));
      cur = { ...cur, damage_uris: [...uris] };
      await save(cur);
    }
    const p = cur.payload || {};
    await base44.functions.invoke('cajaInventoryReview', {
      ...p,
      action: 'package_review',
      review_key: cur.id,
      content_photo_uri: cur.content_uri,
      damage_photo_uris: p.has_incident ? [cur.content_uri, ...uris] : [],
    });
    await del(STORE, cur.id);
    notify();
  } catch (e) {
    await save({
      ...cur,
      status: 'error',
      attempts: (cur.attempts || 0) + 1,
      error: e?.response?.data?.error || e?.message || 'Error de conexión',
    });
  }
}

let running = null;
export function processReviewQueue() {
  if (running) return running;
  running = (async () => {
    try {
      const items = await listReviewQueue();
      for (const item of items) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) break;
        await processOne(item);
      }
    } finally {
      running = null;
      notify();
    }
  })();
  return running;
}

export async function enqueueReview({ key, payload, contentPhoto, damagePhotos = [] }) {
  await save({
    id: key,
    payload,
    content_photo: contentPhoto,
    damage_photos: damagePhotos,
    content_uri: '',
    damage_uris: [],
    status: 'pending',
    attempts: 0,
    error: '',
    created_at: Date.now(),
  });
  processReviewQueue();
}