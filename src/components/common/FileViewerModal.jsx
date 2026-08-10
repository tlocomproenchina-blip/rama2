import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';

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

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const STEP = 0.25;

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(MIN_SCALE, +(s - STEP).toFixed(2));
      if (next === MIN_SCALE) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Reset al abrir o cambiar de archivo
  useEffect(() => {
    if (open) resetZoom();
  }, [open, fileUrl, resetZoom]);

  const handleWheel = useCallback((e) => {
    if (kind !== 'image') return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? STEP : -STEP;
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2)));
      if (next === MIN_SCALE) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, [kind]);

  const handleMouseDown = useCallback((e) => {
    if (scale <= MIN_SCALE) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  }, [scale, position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: dragStart.current.posX + (e.clientX - dragStart.current.x),
      y: dragStart.current.posY + (e.clientY - dragStart.current.y),
    });
  }, [isDragging]);

  const stopDragging = useCallback(() => setIsDragging(false), []);

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
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-lg bg-slate-100 select-none"
              style={{ height: '72vh', cursor: scale > MIN_SCALE ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDragging}
              onMouseLeave={stopDragging}
            >
              <img
                src={fileUrl}
                alt={title}
                draggable={false}
                className="max-w-full max-h-full object-contain transition-transform duration-150 ease-out"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                }}
              />
              {/* Controles de zoom */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-1.5 py-1 shadow-card backdrop-blur">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={zoomOut} disabled={scale <= MIN_SCALE} title="Alejar">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-[3rem] text-center text-xs font-medium text-slate-600">{Math.round(scale * 100)}%</span>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={zoomIn} disabled={scale >= MAX_SCALE} title="Acercar">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="mx-0.5 h-5 w-px bg-slate-200" />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={resetZoom} disabled={scale === MIN_SCALE && position.x === 0 && position.y === 0} title="Restablecer">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setScale(MAX_SCALE)} disabled={scale >= MAX_SCALE} title="Ajustar al máximo">
                  <Maximize className="h-4 w-4" />
                </Button>
              </div>
            </div>
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