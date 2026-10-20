import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, History } from 'lucide-react';
import ContainersExportHistoryEntry from '@/components/containers-by-client/ContainersExportHistoryEntry';

// Historial de informes de contenedores exportados: qué clientes y qué
// contenedores salieron en cada uno.
export default function ContainersExportHistoryDialog({ open, onOpenChange }) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    base44.entities.ContainersReportExport.filter({}, { sort: '-exported_date', limit: 100 })
      .then((page) => {
        if (!active) return;
        setEntries(page?.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial de exportaciones
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Todavía no se ha exportado ningún informe.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <ContainersExportHistoryEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}