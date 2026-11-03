import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Package as PackageIcon, User, MapPin, FileText } from 'lucide-react';

// Muestra el resultado instantáneo del lookup local (paquete + cliente + datos para etiqueta).
// Aparece en <200ms tras escanear, sin spinners de carga.
export default function OfflineScanResult({ scanResult, client }) {
  if (!scanResult) return null;

  const { pkg, already_received, auto_received } = scanResult;
  const clientData = client || pkg?.client_snapshot || {};
  const shippingMark = pkg?.shipping_mark || clientData?.shipping_mark || '';

  return (
    <Card className={`border-2 ${already_received ? 'border-blue-200 bg-blue-50/40' : 'border-green-200 bg-green-50/40'}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header de estado */}
        <div className="flex items-center gap-2">
          {already_received ? (
            <>
              <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
              <p className="font-semibold text-sm text-blue-700">Paquete ya recibido</p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="font-semibold text-sm text-green-700">
                {auto_received ? 'Recibido y empacado' : 'Empacado'}
              </p>
            </>
          )}
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Offline
          </span>
        </div>

        {/* Unidad donde quedó el paquete */}
        {scanResult.unit?.label_code && (
          <div className={`rounded-lg border px-3 py-2 ${scanResult.unit.is_caja ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">
              {scanResult.unit.is_caja ? 'Quedó dentro de la caja consolidada' : 'Quedó en el bulto suelto'}
            </p>
            <p className="font-mono text-sm font-semibold text-slate-800 break-all">{scanResult.unit.label_code}</p>
          </div>
        )}

        {/* Tracking */}
        <div className="rounded-lg bg-white/80 border border-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Tracking</p>
          <p className="font-mono text-sm font-semibold text-slate-800 break-all">
            {pkg?.tracking_number || '(sin tracking)'}
          </p>
        </div>

        {/* Datos del cliente para la etiqueta */}
        <div className="grid grid-cols-1 gap-2">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">
                {clientData?.full_name || clientData?.email || pkg?.client_email || '(sin cliente)'}
              </p>
              {shippingMark && (
                <p className="text-xs font-mono text-blue-600">{shippingMark}</p>
              )}
            </div>
          </div>

          {(clientData?.city || clientData?.state) && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                {[clientData?.city, clientData?.state].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {clientData?.cedula && (
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">C.I. {clientData.cedula}</p>
            </div>
          )}
        </div>

        {/* Descripción del paquete */}
        {pkg?.description && (
          <div className="flex items-start gap-2 pt-1 border-t border-border/60">
            <PackageIcon className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 line-clamp-2">{pkg.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}