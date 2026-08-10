import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText } from 'lucide-react';

// Detecta el tipo de archivo desde la URL o el nombre
export function getFileKind(url) {
  if (!url) return 'unknown';
  const clean = String(url).split('?')[0].toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(clean)) return 'image';
  if (/\.(pdf)$/.test(clean)) return 'pdf';
  return 'other';
}

// Fuerza la descarga del archivo (sin abrir nueva pestaña)
function downloadFile(url, filename) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'archivo';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (_) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function guessFilename(url, title) {
  try {
    const u = new URL(url);
    const name = u.pathname.split('/').filter(Boolean).pop();
    return name || title || 'archivo';
  } catch (_) {
    return title || 'archivo';
  }
}

/**
 * Visor universal de archivos adjuntos.
 * - Imágenes: se muestran inline (zoom natural, scroll si es muy alta).
 * - PDFs: se embeben en un <iframe>.
 * - Otros: mensaje con botón de descarga.
 * Siempre incluye un botón de descarga en el header.
 */
export default function FileViewerModal({ open, fileUrl, onClose, title = 'Archivo' }) {
  const kind = getFileKind(fileUrl);
  const filename = fileUrl ? guessFilename(fileUrl, title) : title;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pr-2">
          <DialogTitle className="truncate pr-2">{title}</DialogTitle>
          <div className="flex items-center gap-2 shrink-0">
            {fileUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile(fileUrl, filename)}
                >
                  <Download className="h-4 w-4 mr-1" /> Descargar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir
                  </a>
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {!fileUrl && (
            <p className="text-sm text-slate-500 py-8 text-center">Sin archivo adjunto.</p>
          )}

          {fileUrl && kind === 'image' && (
            <img
              src={fileUrl}
              alt={title}
              className="w-full h-auto rounded-lg object-contain max-h-[72vh] mx-auto"
            />
          )}

          {fileUrl && kind === 'pdf' && (
            <iframe
              src={fileUrl}
              title={title}
              className="w-full h-[72vh] rounded-lg border border-slate-200"
            />
          )}

          {fileUrl && kind === 'other' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <FileText className="h-12 w-12 text-slate-400" />
              <p className="text-sm text-slate-600">
                Este tipo de archivo no se puede previsualizar.
              </p>
              <Button onClick={() => downloadFile(fileUrl, filename)}>
                <Download className="h-4 w-4 mr-2" /> Descargar archivo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}