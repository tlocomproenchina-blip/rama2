import React, { useEffect, useState } from 'react';
import FileViewerModal from '@/components/common/FileViewerModal';

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|heic)$/i;

// Un enlace que abriría una imagen en pestaña nueva: apunta a un archivo de imagen
// o envuelve la miniatura de esa misma imagen (enlaces firmados sin extensión).
function imageFromAnchor(a) {
  if (!a || a.target !== '_blank') return null;
  const href = a.getAttribute('href') || '';
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return null;
  const img = a.querySelector('img');
  const cleanPath = href.split('#')[0].split('?')[0];
  const isImageFile = IMAGE_EXT.test(cleanPath);
  const wrapsSameImage = !!img && (img.currentSrc === a.href || img.getAttribute('src') === href);
  if (!isImageFile && !wrapsSameImage) return null;
  return { url: a.href, title: img?.getAttribute('alt') || a.getAttribute('title') || 'Imagen' };
}

// Abre una imagen en el visor global desde código (en lugar de window.open).
export function openImageViewer(url, title = 'Imagen') {
  window.dispatchEvent(new CustomEvent('open-image-viewer', { detail: { url, title } }));
}

// Visor único de la app: cualquier imagen que antes se abría en una pestaña o
// ventana nueva se muestra aquí, dentro de la página, con zoom y descarga.
export default function GlobalImageViewer() {
  const [image, setImage] = useState(null);

  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const found = imageFromAnchor(e.target.closest?.('a[href]'));
      if (!found) return;
      e.preventDefault();
      e.stopPropagation();
      setImage(found);
    };
    const onOpen = (e) => e.detail?.url && setImage(e.detail);
    document.addEventListener('click', onClick, true);
    window.addEventListener('open-image-viewer', onOpen);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('open-image-viewer', onOpen);
    };
  }, []);

  return (
    <FileViewerModal
      open={!!image}
      fileUrl={image?.url || null}
      kind="image"
      title={image?.title || 'Imagen'}
      onClose={() => setImage(null)}
    />
  );
}