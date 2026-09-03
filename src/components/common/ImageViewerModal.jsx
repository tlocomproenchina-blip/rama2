import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const STEP = 0.25;

export default function ImageViewerModal({ open, imageUrl, onClose, title = 'Imagen' }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const imgWrapRef = useRef(null);

  const reset = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  // Reset zoom whenever the image changes or the modal closes
  useEffect(() => {
    if (!open) reset();
  }, [open, imageUrl, reset]);

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const zoomBy = (delta, originX = 0.5, originY = 0.5) => {
    setScale((prev) => {
      const next = clampScale(Math.round((prev + delta) * 100) / 100);
      if (next === 1) setPos({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? STEP : -STEP;
    zoomBy(delta);
  };

  const handlePointerDown = (e) => {
    if (scale <= 1) return;
    e.stopPropagation();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    e.stopPropagation();
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.x),
      y: dragStart.current.py + (e.clientY - dragStart.current.y),
    });
  };

  const handlePointerUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const zoomPct = Math.round(scale * 100);
  const canPan = scale > 1;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div
          ref={imgWrapRef}
          className="relative flex items-center justify-center bg-slate-900/95 overflow-hidden select-none"
          style={{ height: 'min(70vh, 620px)' }}
          onWheel={handleWheel}
          onPointerDown={(e) => canPan && handlePointerDown(e)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              draggable={false}
              className="max-w-full max-h-full object-contain transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                cursor: canPan ? (dragging ? 'grabbing' : 'grab') : 'default',
              }}
            />
          )}

          {/* Floating top-right window controls */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              disabled={scale === 1}
              className="h-9 w-9 grid place-items-center rounded-lg bg-slate-900/85 border border-slate-700 text-slate-200 backdrop-blur-md hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-40 disabled:hover:bg-slate-900/85 transition-colors"
              title="Restablecer zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {/* Bottom-center floating glass control bar */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl bg-slate-900/85 border border-slate-700 px-2 py-1.5 backdrop-blur-md shadow-lg"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); zoomBy(-STEP); }}
              disabled={scale <= MIN_SCALE}
              className="h-8 w-8 grid place-items-center rounded-lg text-slate-200 hover:bg-slate-700 hover:text-cyan-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition-colors"
              title="Alejar"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <span className="min-w-[3.5rem] text-center font-mono text-xs text-slate-200 tabular-nums">
              {zoomPct}%
            </span>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); zoomBy(STEP); }}
              disabled={scale >= MAX_SCALE}
              className="h-8 w-8 grid place-items-center rounded-lg text-slate-200 hover:bg-slate-700 hover:text-cyan-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition-colors"
              title="Acercar"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <div className="mx-1 h-5 w-px bg-slate-700" />

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              disabled={scale === 1}
              className="h-8 px-2.5 grid place-items-center rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-cyan-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition-colors"
              title="Ajustar a 100%"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Mousewheel hint / drag indicator */}
          {scale === 1 && (
            <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-slate-900/70 px-2 py-1 text-[10px] font-mono text-slate-400 backdrop-blur-sm">
              Rueda para acercar
            </div>
          )}
          {canPan && (
            <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-cyan-500/15 border border-cyan-400/40 px-2 py-1 text-[10px] font-mono text-cyan-300">
              Arrastra para mover
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}