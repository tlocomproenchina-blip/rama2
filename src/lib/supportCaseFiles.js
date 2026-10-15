import { base44 } from '@/api/base44Client';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

// Adjuntos de un caso de soporte. Las fotos van al mismo almacenamiento de
// imágenes que ya usa el soporte (enlace directo); los documentos y PDF van al
// almacenamiento privado y se abren con un enlace firmado temporal, para que no
// queden expuestos en una URL pública.
export const isImageAttachment = (file) => String(file?.type || '').startsWith('image/');

export function isImageAttachmentUrl(attachment) {
  if (attachment?.kind === 'image') return true;
  if (attachment?.kind === 'document' || attachment?.private) return false;
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(String(attachment?.url || attachment?.name || ''));
}

export async function uploadSupportCaseFiles(files, maxFiles = 5) {
  const safeFiles = Array.from(files || []).slice(0, maxFiles);
  if (safeFiles.length === 0) return [];

  return Promise.all(
    safeFiles.map(async (file) => {
      if (isImageAttachment(file)) {
        const url = await uploadImageNoCredits(file);
        return { url, name: file.name, kind: 'image' };
      }
      const res = await base44.integrations.Core.UploadPrivateFile({ file });
      const fileUri = res?.file_uri || res?.data?.file_uri;
      if (!fileUri) throw new Error(`No se pudo subir ${file.name}`);
      return { url: fileUri, name: file.name, kind: 'document', private: true };
    })
  );
}

// Devuelve un enlace usable para abrir el adjunto: los archivos privados se
// firman en el momento, el resto ya es un enlace directo.
export async function resolveSupportAttachmentUrl(attachment) {
  const url = attachment?.url || '';
  const isPrivate = attachment?.private || String(url).startsWith('private/');
  if (!url || !isPrivate) return url;
  const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url, expires_in: 3600 });
  return res?.signed_url || res?.data?.signed_url || url;
}