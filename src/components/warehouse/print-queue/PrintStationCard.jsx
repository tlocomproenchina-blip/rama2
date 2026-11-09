import React from 'react';
import { Button } from '@/components/ui/button';
import { Bluetooth, BluetoothConnected, Loader2, Power, Printer, Smartphone } from 'lucide-react';

// Estado de la estación de impresión: qué teléfono tiene la impresora y si este
// dispositivo puede tomarla. Solo una estación procesa la cola a la vez.
export default function PrintStationCard({ station, isThisDevice, runnerError, busy, onStart, onStop, onReconnect }) {
  const active = !!station?.alive;
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
          {active ? <BluetoothConnected className="h-5 w-5" /> : <Printer className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-foreground">
            {isThisDevice ? 'Este teléfono es la estación' : active ? 'Estación activa' : 'Sin estación activa'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isThisDevice
              ? 'Imprime los trabajos de todos los operadores. Mantén la app abierta y la impresora encendida.'
              : active
                ? `${station.operator_name || station.operator_email} imprime los trabajos de la cola.`
                : 'Cada teléfono imprime directo. Activa una estación para compartir la impresora.'}
          </p>
          {runnerError && <p className="mt-1 text-xs text-destructive">{runnerError}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isThisDevice ? (
          <>
            {runnerError && onReconnect && (
              <Button size="sm" onClick={onReconnect} disabled={busy}>
                <Bluetooth className="h-4 w-4" /> Reconectar impresora
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onStop} disabled={busy}>
              <Power className="h-4 w-4" /> Dejar de ser estación
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onStart} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            {active ? 'Tomar la estación aquí' : 'Usar este teléfono como estación'}
          </Button>
        )}
      </div>
    </div>
  );
}