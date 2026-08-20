import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Package as PackageIcon, CheckCircle2, AlertTriangle, Truck, Loader2 } from 'lucide-react';

export default function DispatchResultCard({ result, onMarkReceived, onMarkDispatched, processing }) {
  if (!result) return null;

  if (result.error) {
    return (
      <Card className="border-rose-300 bg-rose-50">
        <CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-rose-600 shrink-0" />
          <div>
            <p className="font-semibold text-rose-700">Tracking: {result.tracking}</p>
            <p className="text-sm text-rose-600">{result.error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const clientName = result.client?.full_name || result.package?.client_email;
  const mark = result.package?.shipping_mark || result.client?.shipping_mark;

  return (
    <Card className={result.already_dispatched ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-slate-700 shrink-0" />
            <div>
              <p className="text-lg font-bold text-slate-800 break-all">{clientName}</p>
              {mark && <p className="font-mono text-sm font-semibold text-blue-700">Mark: {mark}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {result.already_dispatched ? (
              <Badge className="bg-amber-500 text-white">Despachado</Badge>
            ) : result.is_received ? (
              <Badge className="bg-blue-600 text-white">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Recibido
              </Badge>
            ) : (
              <Badge className="bg-slate-500 text-white">Pre-alerta (sin recibir)</Badge>
            )}
            {result.auto_received && (
              <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50">
                Recibido automáticamente
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <PackageIcon className="h-4 w-4 shrink-0" />
          <span className="font-mono break-all">{result.package?.tracking_number}</span>
          <span className="text-slate-400">·</span>
          <span className="truncate">{result.package?.description}</span>
        </div>

        {result.recibo_pagado && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 border border-emerald-300 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-sm leading-tight">
              <span className="font-semibold text-emerald-800">
                Recibo {result.package?.consolidation_tracking || ''} ya pagado — listo para despacho
              </span>
              {result.invoice_number && (
                <span className="text-emerald-700"> · Factura {result.invoice_number}</span>
              )}
            </div>
          </div>
        )}

        {(onMarkReceived || onMarkDispatched) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!result.is_received && onMarkReceived && (
              <Button variant="outline" disabled={processing} onClick={() => onMarkReceived(result.package?.tracking_number)}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Marcar como recibido
              </Button>
            )}
            {!result.already_dispatched && onMarkDispatched && (
              <Button disabled={processing} onClick={() => onMarkDispatched(result.package?.tracking_number)}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Marcar como despachado
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}