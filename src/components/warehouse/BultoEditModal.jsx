import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Package } from 'lucide-react';
import { toast } from 'sonner';

// Modal de edición completa de un bulto: paquetes incluidos, snapshot del cliente y estado.
export default function BultoEditModal({ bulto, open, onClose, onSaved }) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('activo');
  const [clientPackages, setClientPackages] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [otherBoxedIds, setOtherBoxedIds] = useState(new Set());
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState('');

  useEffect(() => {
    if (!bulto) return;
    setSnapshot({
      full_name: bulto.client_snapshot?.full_name || '',
      email: bulto.client_snapshot?.email || bulto.client_email || '',
      cedula: bulto.client_snapshot?.cedula || '',
      whatsapp: bulto.client_snapshot?.whatsapp || '',
      address: bulto.client_snapshot?.address || '',
      city: bulto.client_snapshot?.city || '',
      state: bulto.client_snapshot?.state || '',
      shipping_mark: bulto.client_snapshot?.shipping_mark || bulto.shipping_mark || '',
    });
    setStatus(bulto.status || 'activo');
    setSelectedIds(bulto.package_ids || []);
    setOrderNumbers(Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.join(', ') : '');
    setClientPackages([]);
    setOtherBoxedIds(new Set());

    // Cargar paquetes recibidos del cliente + bultos hermanos para marcar ocupados
    (async () => {
      if (!bulto.client_email) return;
      setLoadingPkgs(true);
      try {
        const [pkgs, bultos] = await Promise.all([
          base44.entities.Package.filter({ client_email: bulto.client_email }, '-received_date', 500),
          base44.entities.Bulto.filter({ client_email: bulto.client_email }, 'bulto_number', 500),
        ]);
        const received = (pkgs || []).filter((p) => p.status === 'recibido');
        setClientPackages(received);
        const boxed = new Set();
        for (const b of bultos || []) {
          if (b.id === bulto.id) continue;
          for (const pid of b.package_ids || []) boxed.add(pid);
        }
        setOtherBoxedIds(boxed);
      } catch (_) {
      } finally {
        setLoadingPkgs(false);
      }
    })();
  }, [bulto]);

  const togglePackage = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!selectedIds.length) {
      toast.error('El bulto debe tener al menos un paquete');
      return;
    }
    setSaving(true);
    try {
      const parsedOrders = orderNumbers.trim()
        ? orderNumbers.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const res = await base44.functions.invoke('updateBulto', {
        bulto_id: bulto.id,
        package_ids: selectedIds,
        client_snapshot: snapshot,
        status,
        cbm_order_numbers: parsedOrders,
      });
      if (res?.data?.error) {
        toast.error(res.data.error);
        return;
      }
      toast.success('Bulto actualizado');
      onSaved?.(res.data.bulto);
      onClose();
    } catch (e) {
      toast.error('Error al actualizar el bulto');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setSnapshot((prev) => ({ ...prev, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Editar bulto {bulto?.bulto_number}/{bulto?.total_bultos}
          </DialogTitle>
        </DialogHeader>

        {snapshot && (
          <div className="space-y-5">
            {/* Paquetes incluidos */}
            <div>
              <Label className="mb-2 block">Paquetes incluidos ({selectedIds.length})</Label>
              {loadingPkgs ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Cargando paquetes…
                </div>
              ) : clientPackages.length === 0 ? (
                <p className="text-sm text-slate-500">No hay paquetes recibidos para este cliente.</p>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                  {clientPackages.map((p) => {
                    const isOtherBoxed = otherBoxedIds.has(p.id);
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-400 bg-blue-50' : 'border-border hover:bg-muted/40'
                        } ${isOtherBoxed && !isSelected ? 'opacity-40' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isOtherBoxed && !isSelected}
                          onChange={() => togglePackage(p.id)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-slate-800 break-all">{p.tracking_number}</p>
                          {p.description && <p className="text-xs text-slate-500 truncate">{p.description}</p>}
                        </div>
                        {isOtherBoxed && !isSelected && (
                          <span className="text-xs text-slate-400 shrink-0">En otro bulto</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Snapshot del cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Nombre completo</Label>
                <Input value={snapshot.full_name} onChange={(e) => updateField('full_name', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Cédula</Label>
                <Input value={snapshot.cedula} onChange={(e) => updateField('cedula', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Teléfono / WhatsApp</Label>
                <Input value={snapshot.whatsapp} onChange={(e) => updateField('whatsapp', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Email</Label>
                <Input value={snapshot.email} onChange={(e) => updateField('email', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-xs">Dirección</Label>
                <Input value={snapshot.address} onChange={(e) => updateField('address', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Ciudad</Label>
                <Input value={snapshot.city} onChange={(e) => updateField('city', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Estado</Label>
                <Input value={snapshot.state} onChange={(e) => updateField('state', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Shipping Mark</Label>
                <Input value={snapshot.shipping_mark} onChange={(e) => updateField('shipping_mark', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Estado del bulto</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="activo">Activo</option>
                  <option value="despachado">Despachado</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-xs">Números de orden (CbmIngreso)</Label>
                <Input
                  value={orderNumbers}
                  onChange={(e) => setOrderNumbers(e.target.value)}
                  placeholder="Separar con comas si son varias"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Número(s) de orden asignado(s) en el almacén de China. Se muestran en la etiqueta y al cliente.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loadingPkgs} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}