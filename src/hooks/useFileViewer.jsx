import { useState } from 'react';
import FileViewerModal from '@/components/common/FileViewerModal';

// Hook reutilizable para abrir archivos adjuntos (imágenes y PDFs) en un modal
// con botón de descarga. Reemplaza a useImageViewer para vistas que pueden
// recibir PDFs además de imágenes.
export default function useFileViewer() {
  const [state, setState] = useState({ open: false, url: null, title: 'Archivo' });

  const open = (url, title = 'Archivo') => {
    if (url) setState({ open: true, url, title });
  };
  const close = () => setState((s) => ({ ...s, open: false }));

  const modal = (
    <FileViewerModal
      open={state.open}
      fileUrl={state.url}
      title={state.title}
      onClose={close}
    />
  );

  return { open, close, modal };
}