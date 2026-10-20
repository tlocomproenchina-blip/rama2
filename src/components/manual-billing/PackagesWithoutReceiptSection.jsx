import React, { useMemo, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PackageX, ShieldCheck, FileText, Layers } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PackagesWithoutReceiptSection({ packages, onChange, availableReceipts, onAssignReceipt }) {
  const [bulkReceiptId, setBulkReceiptId] = useState('');

  // Todos los recibos disponibles del cliente (no facturados)
  const receipts = useMemo(
    () => (availableReceipts || []).filter((r) => r.invoice_number && r.invoice_number !== '—'),
    [availableReceipts]
  );

  // ID de recibo → N° visible, para etiquetar cada paquete ya asignado
  const receiptNumberById = useMemo(() => {
    const map = {};
    receipts.forEach((r) => { map[r.id] = r.invoice_number; });
    return map;
  }, [receipts]);

  // Los paquetes ya asignados a un recibo salen de esta lista: la asignación se conserva
  // en el estado del padre y se integra al recibo al generar la factura.
  const pendingPackages = useMemo(
    () => (packages || []).filter((p) => !p.assigned_receipt_id),
    [packages]
  );

  if (pendingPackages.length === 0) return null;

  const updatePkg = (id, patch) => {
    onChange(packages.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const selectAll = (val) => {
    onChange(packages.map((p) => (p.assigned_receipt_id ? p : { ...p, selected: !!val })));
  };

  const selectedCount = pendingPackages.filter((p) => p.selected).length;
  const allSelected = pendingPackages.length > 0 && selectedCount === pendingPackages.length;

  const handleAssign = (pkgId, receiptId) => {
    updatePkg(pkgId, { assigned_receipt_id: receiptId });
    if (onAssignReceipt) onAssignReceipt(receiptId);
    const num = receiptNumberById[receiptId];
    toast.success(`Paquete asignado al recibo ${num || ''}`.trim());
  };

  const applyBulkAssign = () => {
    if (!bulkReceiptId) return;
    const count = pendingPackages.filter((p) => p.selected).length;
    onChange(packages.map((p) => (p.assigned_receipt_id || !p.selected ? p : { ...p, assigned_receipt_id: bulkReceiptId })));
    if (onAssignReceipt) onAssignReceipt(bulkReceiptId);
    const num = receiptNumberById[bulkReceiptId] || '';
    setBulkReceiptId('');
    toast.success(`${count} paquete(s) asignados al recibo ${num}`.trim());
  };

  return (
    <Card className="border-amber-200 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(c) => selectAll(!!c)}
            />
            <PackageX className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-800">Paquetes sin recibo</h3>
            <span className="text-xs text-slate-500">({pendingPackages.length})</span>
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpiar selección ({selectedCount})
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Estos paquetes no tienen recibo registrado. Selecciona los que deseas facturar y asígnalos a un recibo ya seleccionado en la lista principal.
          Al generar la factura, el paquete se integrará al recibo elegido.
        </p>
        {selectedCount > 0 && receipts.length === 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50/50 p-2 text-xs text-amber-700">
            Este cliente no tiene recibos disponibles.
          </div>
        )}
        {selectedCount > 0 && receipts.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-medium text-blue-800">
                Asignar los {selectedCount} paquetes seleccionados a un mismo recibo
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bulkReceiptId} onValueChange={setBulkReceiptId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Elegir recibo..." />
                </SelectTrigger>
                <SelectContent>
                  {receipts.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.invoice_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                onClick={applyBulkAssign}
                disabled={!bulkReceiptId}
              >
                Asignar a todos
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {pendingPackages.map((pkg) => {
            return (
              <div
                key={pkg.id}
                className={`rounded-lg border p-3 transition-colors ${
                  pkg.selected ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={pkg.selected}
                    onCheckedChange={(c) => updatePkg(pkg.id, { selected: !!c })}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm text-slate-700 break-all">{pkg.tracking_number}</p>
                    {pkg.fob_value > 0 && (
                      <p className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="h-3 w-3" /> FOB ${Number(pkg.fob_value).toFixed(2)}
                      </p>
                    )}
                    {pkg.selected && (
                      <div className="mt-2 max-w-[260px]">
                        <Label className="text-xs flex items-center gap-1 mb-1"><FileText className="h-3 w-3" /> Asignar a recibo</Label>
                        <Select
                          value={pkg.assigned_receipt_id || ''}
                          onValueChange={(val) => handleAssign(pkg.id, val)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={receipts.length === 0 ? "Sin recibos disponibles" : "Elegir recibo..."} />
                          </SelectTrigger>
                          <SelectContent>
                            {receipts.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.invoice_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}