import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, UserCheck, X } from 'lucide-react';

// Código escaneado que no corresponde a ningún paquete registrado: nunca bloquea el
// escaneo. Se puede agregar como "sin registrar" a la unidad activa o asignarlo a un
// cliente creando el registro.
export default function PendingScanCodeCard({
  code, reason, hasUnit, busy, onAddUnregistered, onAssign, onDiscard,
}) {
  if (!code) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardContent className="space-y-3 pt-4">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            El código <span className="font-mono font-semibold break-all">{code}</span> {reason}.
            Cuenta como un paquete más de la unidad activa.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onAddUnregistered} disabled={busy || !hasUnit}>
            <Package className="h-4 w-4" /> Agregar sin registrar
          </Button>
          <Button variant="outline" onClick={onAssign} disabled={busy}>
            <UserCheck className="h-4 w-4" /> Asignar a un cliente
          </Button>
          <Button variant="ghost" onClick={onDiscard} disabled={busy}>
            <X className="h-4 w-4" /> Descartar
          </Button>
        </div>
        {!hasUnit && (
          <p className="text-[11px] text-amber-800">
            Para agregarlo sin registrar, abre primero el bulto o la caja del cliente: escanea su
            código o crea una unidad nueva.
          </p>
        )}
      </CardContent>
    </Card>
  );
}