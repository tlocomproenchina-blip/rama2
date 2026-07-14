import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export default function TrackingListDialog({ open, onClose, ingreso }) {
  const trackings = ingreso?.tracking_numbers || [];
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Trackings del recibo {ingreso?.invoice_number || '—'}
            <Badge variant="secondary">{trackings.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {trackings.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Sin trackings registrados</p>
          ) : (
            <ul className="divide-y">
              {trackings.map((t, idx) => (
                <li key={`${t}-${idx}`} className="flex items-center gap-3 py-2">
                  <span className="text-xs text-slate-400 w-8 text-right">{idx + 1}.</span>
                  <span className="font-mono text-xs text-blue-700 break-all">{t}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}