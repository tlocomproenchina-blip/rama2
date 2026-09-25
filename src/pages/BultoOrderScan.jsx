import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import BarcodeScannerModule from '@/components/warehouse/BarcodeScannerModule';
import { Loader2, Save, Lock, Package, ScanLine, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

// Página standalone de escaneo de etiquetas de bultos para empleados.
// El empleado escanea el label_code, ve detalles básicos, ingresa el N° de orden
// CbmIngreso y guarda. El bulto queda order_locked=true (sin cambiar su status).
export default function BultoOrderScan({ user }) {
  const [scanValue, setScanValue] = useState('');
  const [bulto, setBulto] = useState(null);
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState('');
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setBulto(null);
    setInvoiceInfo(null);
    setOrderNumbers('');
    setScanValue('');
    setError('');
  }, []);

  const handleDetected = useCallback(async (code) => {
    const labelCode = String(code || '').trim();
    if (!labelCode) return;
    setLoading(true);
    setError('');
    setBulto(null);
    setInvoiceInfo(null);
    setOrderNumbers('');
    try {
      const res = await base44.functions.invoke('getBultoByLabelCode', { label_code: labelCode });
      if (res?.data?.error) {
        setError(res.data.error);
        toast.error(res.data.error);
        return;
      }
      const found = res?.data?.bulto;
      if (!found) {
        setError('Bulto no encontrado');
        toast.error('Bulto no encontrado');
        return;
      }
      setBulto(found);
      setInvoiceInfo({
        invoice_paid: res.data.invoice_paid,
        invoice_status: res.data.invoice_status,
        invoice_number: res.data.invoice_number,
      });
      // Si ya tiene ordenes asignadas, precargarlas para mostrarlas (solo lectura si locked)
      const existing = Array.isArray(found.cbm_order_numbers) ? found.cbm_order_numbers : [];
      if (existing.length) setOrderNumbers(existing.join(', '));
      toast.success(`Bulto ${found.label_code} encontrado`);
    } catch (e) {
      setError('Error al buscar el bulto');
      toast.error('Error al buscar el bulto');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!bulto) return;
    const parsed = orderNumbers.trim()
      ? orderNumbers.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!parsed.length) {
      toast.error('Ingresa al menos un N° de orden');
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke('assignBultoOrderNumbers', {
        bulto_id: bulto.id,
        cbm_order_numbers: parsed,
      });
      if (res?.data?.error) {
        toast.error(res.data.error);
        return;
      }
      toast.success('N° de orden asignado y bulto bloqueado');
      setBulto(res.data.bulto);
    } catch (e) {
      toast.error('Error al asignar el N° de orden');
    } finally {
      setSaving(false);
    }
  };

  const isLocked = !!bulto?.order_locked;
  const isAdmin = user?.role === 'admin';
  // Empleado no puede editar si está locked. Admin sí puede (para corregir).
  const readOnly = isLocked && !isAdmin;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-2">
        <ScanLine className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Asignar N° de Orden a Bulto</h1>
          <p className="text-sm text-slate-500">
            Escanea la etiqueta del bulto, ingresa el N° de orden CbmIngreso y guárdalo. El bulto queda bloqueado.
          </p>
        </div>
      </div>

      <BarcodeScannerModule
        title="Escanear etiqueta de bulto"
        description="Apunta la cámara al código de barras de la etiqueta o usa la lectora USB."
        placeholder="Código de etiqueta (label_code)"
        actionLabel="Buscar bulto"
        cameraLabel="Usar cámara"
        autoStartCamera
        continuous={false}
        value={scanValue}
        onValueChange={setScanValue}
        onDetected={handleDetected}
      />

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando bulto…
        </div>
      )}

      {error && !loading && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="pt-4 text-sm text-rose-700">{error}</CardContent>
        </Card>
      )}

      {bulto && !loading && (
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" /> Bulto {bulto.bulto_number}/{bulto.total_bultos}
              </span>
              {isLocked ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  <Lock className="h-3 w-3 mr-1" /> N° de orden asignado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-slate-600">Pendiente de orden</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Detalles básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Código de etiqueta</p>
                <p className="font-mono text-slate-800 break-all">{bulto.label_code}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Shipping Mark</p>
                <p className="font-mono text-slate-800">{bulto.shipping_mark}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Cliente</p>
                <p className="text-slate-800">{bulto.client_snapshot?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-slate-800 break-all">{bulto.client_email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Paquetes</p>
                <p className="text-slate-800">{(bulto.package_ids || []).length} paquete(s)</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Estado</p>
                <p className="text-slate-800 capitalize">{bulto.status?.replace('_', ' ')}</p>
              </div>
            </div>

            {/* Trackings */}
            {(bulto.package_trackings || []).length > 0 && (
              <div>
                <p className="text-xs text-slate-400 mb-1">Trackings contenidos</p>
                <div className="flex flex-wrap gap-1.5">
                  {(bulto.package_trackings || []).map((t, i) => (
                    <span key={i} className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded text-slate-700 break-all">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Estado de factura */}
            {invoiceInfo && (
              <div className="text-xs text-slate-500 flex flex-wrap gap-3">
                <span>Factura: <span className="text-slate-700">{invoiceInfo.invoice_number || 'sin factura'}</span></span>
                <span>Estado: <span className={invoiceInfo.invoice_paid ? 'text-emerald-600' : 'text-amber-600'}>{invoiceInfo.invoice_status}</span></span>
              </div>
            )}

            {/* Campo de N° de orden */}
            <div className="pt-2 border-t border-border">
              {readOnly ? (
                <div className="space-y-2">
                  <Label className="text-xs">N° de orden asignado (solo lectura)</Label>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-slate-700 font-mono break-all">
                    {(bulto.cbm_order_numbers || []).join(', ') || '—'}
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Este bulto ya fue asignado por {bulto.order_assigned_by || 'un empleado'}.
                    Solicita a un admin que lo desbloquee si necesitas corregirlo.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">N° de orden CbmIngreso</Label>
                  <Input
                    value={orderNumbers}
                    onChange={(e) => setOrderNumbers(e.target.value)}
                    placeholder="Ej: 12345 (separar con comas si son varias)"
                    inputMode="numeric"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400">
                    Ingresa el número de orden del almacén de China. Al guardar, el bulto queda bloqueado y no podrás editarlo nuevamente.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar y bloquear
                    </Button>
                    <Button variant="outline" onClick={reset}>
                      <RotateCcw className="h-4 w-4" /> Escanear otro
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Admin puede desbloquear */}
            {isLocked && isAdmin && (
              <div className="pt-2 border-t border-border">
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await base44.functions.invoke('updateBulto', {
                        bulto_id: bulto.id,
                        cbm_order_numbers: bulto.cbm_order_numbers || [],
                      });
                      if (res?.data?.error) { toast.error(res.data.error); return; }
                      // updateBulto no toca order_locked; usamos assignBultoOrderNumbers solo si está desbloqueado.
                      // Para desbloquear, hacemos un update directo vía SDK.
                      const unlocked = await base44.entities.Bulto.update(bulto.id, { order_locked: false });
                      setBulto(unlocked);
                      toast.success('Bulto desbloqueado. Ya puedes editar el N° de orden.');
                    } catch (e) {
                      toast.error('Error al desbloquear');
                    }
                  }}
                >
                  <Lock className="h-4 w-4" /> Desbloquear edición (admin)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!bulto && !loading && !error && (
        <div className="text-center text-sm text-slate-400 py-8 flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-slate-300" />
          Escanea una etiqueta de bulto para comenzar.
        </div>
      )}
    </div>
  );
}