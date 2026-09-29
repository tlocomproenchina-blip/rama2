import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, X } from 'lucide-react';

const fmtCbm = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(5);

// Aviso breve de la fusión automática de recibos repetidos del mismo cliente.
export default function ReceiptsAutoMergeNotice({ merging, summary, onDismiss }) {
  if (merging) {
    return (
      <Card className="border-border">
        <CardContent className="flex items-center gap-2 p-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Revisando recibos repetidos de este cliente…
        </CardContent>
      </Card>
    );
  }

  if (!summary?.groups?.length) return null;

  return (
    <Card className="border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
      <CardContent className="flex items-start gap-3 p-4">
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            {summary.receipts} recibo{summary.receipts === 1 ? '' : 's'} repetido{summary.receipts === 1 ? '' : 's'} del mismo cliente fusionado{summary.receipts === 1 ? '' : 's'} automáticamente
          </p>
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            {summary.groups.map((g) => `N° ${g.order} → ${fmtCbm(g.cbm)} CBM`).join(' · ')}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onDismiss} aria-label="Cerrar aviso">
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}