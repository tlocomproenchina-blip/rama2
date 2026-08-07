import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ImageViewerModal({ open, imageUrl, onClose, title = 'Imagen' }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={title}
            className="w-full rounded-lg object-contain max-h-[70vh]"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}