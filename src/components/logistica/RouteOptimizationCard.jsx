import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

export default function RouteOptimizationCard({ plan, onOptimize, loading }) {
  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" /> Optimización IA
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Calcula el orden sugerido de entregas por menor distancia usando estado y ciudad del cliente.</p>
        </div>
        <Button onClick={onOptimize} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Optimizar ruta
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!plan ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">Todavía no hay una optimización calculada para esta ruta.</div>
        ) : (
          <>
            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div><span className="font-medium text-slate-800">Estado:</span> {plan.status}</div>
              <div><span className="font-medium text-slate-800">Modo:</span> {plan.optimization_mode}</div>
              <div><span className="font-medium text-slate-800">Distancia:</span> {plan.total_distance_km || 0} km</div>
              <div><span className="font-medium text-slate-800">Duración:</span> {plan.estimated_duration_min || 0} min</div>
              <div><span className="font-medium text-slate-800">Paradas optimizadas:</span> {plan.optimized_stop_count || 0}</div>
              <div><span className="font-medium text-slate-800">Sin ubicación:</span> {plan.missing_location_count || 0}</div>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-900">
              {plan.summary_text || 'Sin resumen disponible'}
            </div>
            {plan.ordered_stop_labels?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800">Orden sugerido</p>
                {plan.ordered_stop_labels.map((label, index) => (
                  <div key={`${label}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-semibold">{index + 1}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}