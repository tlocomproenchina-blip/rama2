import React, { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FileViewerModal, { downloadFile } from '@/components/common/FileViewerModal';
import useSignedUri from '@/components/warehouse/incidents/useSignedUri';

// Archivo privado del módulo: se abre con un enlace firmado temporal, dentro de la
// app (con zoom en imágenes) y se puede descargar.
export default function FiscalFileLink({ uri, type, label = 'Archivo', filename }) {
  const url = useSignedUri(uri);
  const [open, setOpen] = useState(false);
  if (!uri) return <span className="text-sm text-muted-foreground">Sin archivo</span>;
  const kind = type === 'pdf' ? 'pdf' : 'image';
  const name = filename || `${label.toLowerCase().replace(/\s+/g, '-')}.${kind === 'pdf' ? 'pdf' : 'jpg'}`;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={!url} onClick={() => setOpen(true)}>
          <Eye className="h-4 w-4" /> Ver / ampliar
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!url} onClick={() => downloadFile(url, name)}>
          <Download className="h-4 w-4" /> Descargar
        </Button>
      </div>
      <FileViewerModal open={open} fileUrl={url} kind={kind} title={label} filename={name} onClose={() => setOpen(false)} />
    </>
  );
}