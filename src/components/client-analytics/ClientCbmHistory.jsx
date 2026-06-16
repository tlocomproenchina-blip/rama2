import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Boxes, Ship, MessageCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';
import { base44 } from '@/api/base44Client';

const fmtDate = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');

export default function ClientCbmHistory({ ingresos, totalCbm, client, onRefresh }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [markingAvailable, setMarkingAvailable] = useState(false);

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === (ingresos?.length || 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((ingresos || []).map((i) => i.id)));
    }
  };

  const selectedItems = useMemo(
    () => (ingresos || []).filter((i) => selectedIds.has(i.id)),
    [ingresos, selectedIds]
  );

  const handleNotifyWhatsApp = () => {
    if (!client) {
      toast.error('Cliente no disponible');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Selecciona al menos una factura');
      return;
    }
    const phone = client.whatsapp || client.phone || '';
    if (!phone) {
      toast.error('Este cliente no tiene WhatsApp registrado');
      return;
    }

    const clientName = client.first_name || client.full_name || 'Cliente';
    const shippingMark = client.shipping_mark || '';
    const lines = selectedItems.map((i) => {
      const parts = [
        `• Factura ${i.invoice_number || '—'}`,
        `CBM: ${Number(i.cbm || 0).toFixed(5)}`,
        i.fecha ? `Fecha: ${fmtDate(i.fecha)}` : null,
        i.fecha_salida ? `Salida: ${i.fecha_salida}` : null,
        i.fecha_estimada_llegada ? `Llegada est.: ${i.fecha_estimada_llegada}` : null
      ].filter(Boolean);
      return parts.join(' | ');
    });

    const totalSel = selectedItems.reduce((s, i) => s + Number(i.cbm || 0), 0);
    const headerLine = shippingMark ? `${clientName} | Shipping Mark: ${shippingMark}` : clientName;
    const message = `Hola ${headerLine}, te compartimos el detalle de tus facturas/CBM:\n\n${lines.join('\n')}\n\nTotal CBM seleccionado: ${totalSel.toFixed(5)}\n\nPor favor, requerimos que nos envíes el FOB (valor de la mercancía) de cada una de estas facturas para poder continuar con el proceso. ¡Gracias!`;

    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      toast.error('Número de WhatsApp inválido');
      return;
    }
    window.open(url, '_blank');
  };

  const handleMarkAvailable = async () => {
    if (selectedItems.length === 0) {
      toast.error('Selecciona al menos un recibo');
      return;
    }
    setMarkingAvailable(true);
    try {
      await Promise.all(
        selectedItems.map((i) => base44.entities.CbmIngreso.update(i.id, { disponible_entrega: true }))
      );
      toast.success(`${selectedItems.length} recibo(s) marcado(s) como disponible(s) para entrega`);
      setSelectedIds(new Set());
      if (onRefresh) await onRefresh();
    } catch (e) {
      toast.error('No se pudo actualizar el estado');
    } finally {
      setMarkingAvailable(false);
    }
  };

  const allSelected = (ingresos?.length || 0) > 0 && selectedIds.size === ingresos.length;

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-800">Historial de CBM</h3>
            <Badge variant="secondary">{ingresos?.length || 0}</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <Badge variant="outline" className="text-slate-700">{selectedIds.size} seleccionada(s)</Badge>
            )}
            <Button
              size="sm"
              onClick={handleNotifyWhatsApp}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Notificar por WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={handleMarkAvailable}
              disabled={selectedIds.size === 0 || markingAvailable}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              {markingAvailable ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Marcar disponible para entrega
            </Button>
            <Badge className="bg-blue-100 text-blue-700 text-base">Total: {Number(totalCbm || 0).toFixed(5)} CBM</Badge>
          </div>
        </div>

        {(!ingresos || ingresos.length === 0) ? (
          <p className="text-center text-slate-500 py-6">Sin registros de CBM</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                  <th className="py-2 pr-3 w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todas" />
                  </th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">CBM</th>
                  <th className="py-2 pr-3">FOB Total</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3">Recibo</th>
                  <th className="py-2 pr-3">Disponible entrega</th>
                  <th className="py-2 pr-3">Proveedor</th>
                  <th className="py-2 pr-3">Trackings</th>
                  <th className="py-2 pr-3">Salida</th>
                  <th className="py-2 pr-3">Llegada est.</th>
                </tr>
              </thead>
              <tbody>
                {ingresos.map((i) => (
                  <tr key={i.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="py-2 pr-3">
                      <Checkbox
                        checked={selectedIds.has(i.id)}
                        onCheckedChange={() => toggleOne(i.id)}
                        aria-label={`Seleccionar ${i.invoice_number || i.id}`}
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{fmtDate(i.fecha)}</td>
                    <td className="py-2 pr-3 font-semibold text-blue-700">{Number(i.cbm || 0).toFixed(5)}</td>
                    <td className="py-2 pr-3 font-semibold text-green-700">${Number(i.fob_total || 0).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-700">{i.descripcion || '—'}</td>
                    <td className="py-2 pr-3">{i.invoice_number || '—'}</td>
                    <td className="py-2 pr-3">
                      {i.disponible_entrega ? (
                        <span className="inline-block text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">✓ Disponible para entrega</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{i.proveedor || '—'}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {(i.tracking_numbers || []).slice(0, 3).map((t) => (
                          <span key={t} className="inline-block text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{t}</span>
                        ))}
                        {(i.tracking_numbers || []).length > 3 && (
                          <span className="text-[10px] text-slate-500">+{i.tracking_numbers.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {i.fecha_salida ? (
                        <span className="flex items-center gap-1 text-emerald-600"><Ship className="h-3 w-3" />{i.fecha_salida}</span>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{i.fecha_estimada_llegada || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}