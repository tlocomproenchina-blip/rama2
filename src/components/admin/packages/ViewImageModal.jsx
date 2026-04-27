import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OptimizedImage from '@/components/OptimizedImage';

export default function ViewImageModal({ imageUrl, onClose }) {
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Foto del Paquete</DialogTitle>
        </DialogHeader>
        {imageUrl && (
          <OptimizedImage
            src={imageUrl}
            alt="Paquete"
            priority
            className="w-full rounded-lg aspect-[4/3]"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}