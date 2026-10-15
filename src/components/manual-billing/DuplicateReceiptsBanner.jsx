import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

// Banda de aviso: hay recibos repetidos (mismo cliente y mismo N° de contenedor).
export default function DuplicateReceiptsBanner({ groups, scanning, onOpen, onRescan, hasClient }) {
  if (!groups.length) return null;

  const blocked = groups.filter((g) => g.blocked).length;
  const orders = groups.map((g) => `N° ${g.order}`).slice(0, 4).join(', ');

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              {groups.length} recibo{groups.length > 1 ? 's' : ''} repetido{groups.length > 1 ? 's' : ''} detectado{groups.length > 1 ? 's' : ''}
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Mismo cliente y mismo N° de contenedor: {orders}{groups.length > 4 ? '…' : ''}. Al fusionarlos se suma su CBM y queda un solo recibo.
              {blocked > 0 ? ` ${blocked} requiere${blocked > 1 ? 'n' : ''} revisión manual.` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {hasClient && (
            <Button variant="outline" size="sm" onClick={onRescan} disabled={scanning} className="gap-2">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Volver a revisar
            </Button>
          )}
          <Button size="sm" onClick={onOpen} className="bg-amber-600 hover:bg-amber-700 text-white">
            Revisar y fusionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}