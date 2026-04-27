import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ViewImageModal({ imageUrl, onClose }) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Foto del Paquete</DialogTitle>
        </DialogHeader>
        {imageUrl && <img src={imageUrl} alt="Paquete" className="w-full rounded-lg" />}
      </DialogContent>
    </Dialog>
  );
}