import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, X } from 'lucide-react';

// Aviso posterior a la emisión: número de la guía generada y acceso directo a
// su detalle dentro del historial.
export default function DispatchGuideEmittedNotice({ guide, onClose, onOpen }) {
  if (!guide) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
      <div className="flex min-w-0 items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">
            Guía {guide.guide_number} generada
          </p>
          <p className="text-[11px] text-emerald-700">
            {guide.totals?.clients || 0} cliente(s) · {guide.totals?.bultos || 0} bulto(s) ·{' '}
            {guide.totals?.packages || 0} paquete(s). Ya no aparecen como pendientes.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onOpen}>
          Ver detalle
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}