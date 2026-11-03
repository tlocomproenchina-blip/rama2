import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';

// Escanea con la cámara la etiqueta de la caja o el tracking del paquete.
export default function InventoryScanDialog({ open, onOpenChange, onDetected }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear etiqueta o tracking</DialogTitle>
        </DialogHeader>
        {open ? (
          <BarcodeScannerModule
            title="Escanear"
            description="Apunta la cámara a la etiqueta de la caja o al tracking del paquete."
            placeholder="Ej: TLEC-ABC123-B1"
            actionLabel="Buscar"
            autoStartCamera
            onDetected={(code) => { onDetected(code); onOpenChange(false); }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}