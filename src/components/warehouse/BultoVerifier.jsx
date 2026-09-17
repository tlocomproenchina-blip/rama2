import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Package, CheckCircle2, XCircle, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';

export default function BultoVerifier() {
  const [labelCode, setLabelCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const verify = async (code) => {
    const codeToSearch = (code ?? labelCode).trim();
    if (!codeToSearch) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('getBultoByLabelCode', { label_code: codeToSearch });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        setResult(null);
      } else if (data?.bulto) {
        setResult(data);
      } else {
        toast.error('Bulto no encontrado');
      }
    } catch (e) {
      toast.error('Error al buscar el bulto');
    } finally {
      setLoading(false);
    }
  };

  const cs = result?.bulto?.client_snapshot || {};

  return (
    <div className="space-y-4">
      <Card className="shadow-sm border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4" /> Verificar bulto
          </CardTitle>
          <p className="text-sm text-slate-500">Escanea o escribe el código de la etiqueta del bulto para ver su contenido y estado de pago.</p>
        </CardHeader>
        <CardContent>
          <BarcodeScannerModule
            title="Escanear etiqueta de bulto"
            description="El código tiene formato SHIPPINGMARK-B## (ej: TLEC-ABC123-B1)."
            placeholder="Ej: TLEC-ABC123-B1"
            actionLabel="Verificar"
            value={labelCode}
            onValueChange={setLabelCode}
            onDetected={verify}
          />
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      )}

      {result?.bulto && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Bulto {result.bulto.bulto_number}/{result.bulto.total_bultos}
              </span>
              {result.invoice_paid ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" /> Factura pagada</Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" /> Factura pendiente</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Shipping Mark</p>
                <p className="font-mono font-bold text-slate-800 break-all">{result.bulto.shipping_mark}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Label code</p>
                <p className="font-mono text-sm text-slate-700 break-all">{result.bulto.label_code}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Cliente</p>
                <p className="font-medium text-slate-800">{cs.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Cédula</p>
                <p className="font-medium text-slate-800">{cs.cedula || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Dirección</p>
                <p className="font-medium text-slate-800">{[cs.address, cs.city, cs.state].filter(Boolean).join(', ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Teléfono</p>
                <p className="font-medium text-slate-800">{cs.whatsapp || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Factura</p>
                <p className="font-medium text-slate-800">{result.invoice_number || 'Sin factura'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                Contenido del bulto ({result.bulto.package_trackings?.length || 0} paquetes)
              </p>
              <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1 max-h-48 overflow-y-auto">
                {(result.bulto.package_trackings || []).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm font-mono text-slate-700">
                    <Package className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="break-all">{t}</span>
                  </div>
                ))}
                {!result.bulto.package_trackings?.length && (
                  <p className="text-sm text-slate-400">Sin paquetes registrados</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}