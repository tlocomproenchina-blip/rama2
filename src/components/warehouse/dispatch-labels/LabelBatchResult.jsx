import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, RefreshCw } from 'lucide-react';

// Resultado del lote: la guía que nació al imprimir, o el aviso de que las etiquetas ya
// salieron y solo falta reintentar la guía.
export default function LabelBatchResult({ guide, excluded = [], printedCount = 0, creating = false, onRetryCreate, onOpenGuides }) {
  if (!guide && creating) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Creando la guía con las unidades del lote…
        </CardContent>
      </Card>
    );
  }

  if (!guide && !printedCount) return null;

  if (!guide) {
    return (
      <Card className="border-amber-200 bg-amber-50/80">
        <CardContent className="space-y-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {printedCount} etiqueta(s) impresas, guía pendiente
          </p>
          <p className="text-xs text-amber-700">
            Las etiquetas ya salieron. Vuelve a crear la guía con esas mismas unidades, sin reimprimir.
          </p>
          <Button size="sm" onClick={onRetryCreate} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reintentar crear la guía
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/80">
      <CardContent className="space-y-2 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Guía {guide.guide_number} creada
        </p>
        <p className="text-xs text-emerald-700">
          {guide.totals?.bultos || 0} unidad(es) · {guide.totals?.packages || 0} paquete(s) ·{' '}
          {Number(guide.totals?.cbm || 0).toFixed(3)} CBM
        </p>
        {excluded.length > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 p-2 text-[11px] text-amber-800">
            {excluded.length} unidad(es) quedaron fuera porque ya estaban en otra guía:{' '}
            {excluded.map((item) => `${item.code}${item.guide_number ? ` (${item.guide_number})` : ''}`).join(', ')}
          </p>
        )}
        <Button size="sm" variant="outline" className="gap-2" onClick={onOpenGuides}>
          <ClipboardList className="h-4 w-4" /> Ver en Guías de Despacho
        </Button>
      </CardContent>
    </Card>
  );
}