import React, { useState } from 'react';
import { Eye, PackagePlus, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReviewSummaryCard from './ReviewSummaryCard';
import ReprintDialog from './ReprintDialog';

const fmt = (v) => (v ? new Date(v).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// Aviso de revisión ya registrada para este cliente + tracking: permite ver el registro,
// reimprimir la etiqueta de su unidad o empacar usando la revisión existente (sin duplicarla).
export default function ExistingIncidentNotice({ data, tracking, description, onPackWithExisting, packing }) {
  const [showRecord, setShowRecord] = useState(true);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [bulto, setBulto] = useState(data.bulto || null);
  const inc = data.incident || {};
  const summary = {
    tracking, description, container: inc.container_number || data.review?.container_number || '',
    hasIncident: true, type: inc.incident_type, notes: inc.notes,
    contentUri: data.review?.content_photo_uri || inc.photo_uri || '',
    damageUris: inc.photo_uris || [],
  };

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-start gap-1.5 text-sm font-semibold text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 break-all">Esta revisión ya fue registrada para este cliente (tracking {tracking}).</span>
      </p>
      <p className="text-xs text-amber-800">
        Registrada el {fmt(inc.reported_date)} por {inc.reported_by_name || inc.reported_by || 'usuario no disponible'}.
      </p>
      {showRecord && <ReviewSummaryCard summary={summary} />}
      {bulto ? (
        <p className="text-xs text-slate-700">Unidad: <span className="break-all font-mono font-semibold">{bulto.label_code}</span></p>
      ) : (
        <p className="text-xs text-slate-700">Este paquete todavía no está en ningún bulto ni caja.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={() => setShowRecord((v) => !v)}>
          <Eye /> {showRecord ? 'Ocultar registro' : 'Ver registro'}
        </Button>
        {bulto && (
          <Button variant="outline" onClick={() => setReprintOpen(true)}>
            <Printer /> Reimprimir etiqueta
          </Button>
        )}
        {!bulto && (
          <Button onClick={() => onPackWithExisting(summary)} disabled={packing} className="sm:col-span-2">
            <PackagePlus /> Empacar con la revisión existente
          </Button>
        )}
      </div>
      {bulto && (
        <ReprintDialog
          bulto={bulto}
          open={reprintOpen}
          onClose={() => setReprintOpen(false)}
          onRegistered={(updated) => updated && setBulto((b) => ({ ...b, ...updated }))}
        />
      )}
    </div>
  );
}