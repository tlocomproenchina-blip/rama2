import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OctagonAlert, X } from 'lucide-react';
import { describeOwner } from '@/lib/trackingDuplicates';

// Aviso rojo de trackings que ya estaban en otra caja o bulto: no se agregaron.
export default function DuplicateTrackingAlert({ items = [], onDismiss }) {
  if (!items.length) return null;
  return (
    <Card className="border-2 border-red-500 bg-red-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-red-700">
            <OctagonAlert className="h-5 w-5 shrink-0" />
            Tracking ya registrado: no se agregó
          </p>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-700" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.code}-${item.at}`} className="rounded-lg border border-red-200 bg-card px-3 py-2 text-sm text-red-800">
              <span className="font-mono font-semibold break-all">{item.code}</span> {describeOwner(item)}.
            </li>
          ))}
        </ul>
        <p className="text-xs text-red-700">
          Para meter un bulto completo en una caja, escanea la etiqueta del bulto (-B##), no sus trackings.
        </p>
      </CardContent>
    </Card>
  );
}