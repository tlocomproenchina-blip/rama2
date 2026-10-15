import React, { useMemo, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, Package } from 'lucide-react';
import { toast } from 'sonner';
import AccountingSyncNotice from '@/components/warehouse/AccountingSyncNotice';
import AbsorbBultosConfirmDialog from '@/components/warehouse/AbsorbBultosConfirmDialog';
import AbsorbedBultosHistory from '@/components/warehouse/AbsorbedBultosHistory';

// Modal de edición completa de un bulto: paquetes incluidos, snapshot del cliente y estado.
export default function BultoEditModal({ bulto, open, onClose, onSaved }) {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState('activo');
  const [clientPackages, setClientPackages] = useState([]);
  // Paquetes que ya están dentro del bulto (se listan aunque no estén 'recibidos').
  const [bultoPkgs, setBultoPkgs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  // Paquete → bulto del cliente que lo contiene (al marcarlo, ese bulto se fusiona).
  const [otherBultoMap, setOtherBultoMap] = useState({});
  // Paquetes de esos bultos, para poder marcarlos aunque no estén 'recibidos'.
  const [otherBultoPkgs, setOtherBultoPkgs] = useState([]);
  // Confirmación pendiente antes de fusionar el bulto que contiene el paquete marcado.
  const [pendingAbsorb, setPendingAbsorb] = useState(null);
  const [absorbedSources, setAbsorbedSources] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState('');
  // Avisos cuando el cambio no pudo aplicarse al recibo de contabilidad.
  const [syncWarnings, setSyncWarnings] = useState([]);

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
    // El estado legacy 'cerrado' ya no se usa: al abrir un bulto antiguo se
    // normaliza a 'en_almacen_ve' (en almacén, listo para facturar).
    setStatus(bulto.status === 'cerrado' ? 'en_almacen_ve' : (bulto.status || 'activo'));
    setSelectedIds(bulto.package_ids || []);
    setOrderNumbers(Array.isArray(bulto.cbm_order_numbers) ? bulto.cbm_order_numbers.join(', ') : '');
    setClientPackages([]);
    setBultoPkgs([]);
    setOtherBultoMap({});
    setOtherBultoPkgs([]);
    setAbsorbedSources([]);
    setPendingAbsorb(null);
    setSyncWarnings([]);

    // Cargar paquetes recibidos del cliente + bultos hermanos para marcar ocupados
    (async () => {
      setLoadingPkgs(true);
      try {
        // Paquetes que realmente existen dentro de este bulto. Los ids del escaneo
        // offline ('local_pkg_...') no existen: al guardar se conservan como códigos
        // sin registrar, no como paquetes fantasma.
        const ownIds = (bulto.package_ids || []).filter((id) => !String(id).startsWith('local_'));
        const ownPkgs = (await Promise.all(
          ownIds.map((id) => base44.entities.Package.get(id).catch(() => null))
        )).filter(Boolean);
        setBultoPkgs(ownPkgs);

        if (!bulto.client_email) return;
        const [pkgs, bultos] = await Promise.all([
          base44.entities.Package.filter({ client_email: bulto.client_email }, '-received_date', 500),
          base44.entities.Bulto.filter({ client_email: bulto.client_email }, 'bulto_number', 500),
        ]);
        const received = (pkgs || []).filter((p) => p.status === 'recibido');
        setClientPackages(received);

        // Bultos hermanos del cliente: los paquetes que estén dentro de ellos se pueden
        // marcar igual. Al guardar, ese bulto viejo se fusiona y se elimina.
        const receivedIds = new Set(received.map((p) => p.id));
        const sourceMap = {};
        const extraIds = [];
        for (const b of bultos || []) {
          if (b.id === bulto.id) continue;
          const boxed = (b.package_ids || []).filter((pid) => pid && !String(pid).startsWith('local_'));
          if (!boxed.length) continue;
          const usageNote = [
            Number(b.print_count || 0) > 0 ? 'su etiqueta ya fue impresa' : null,
            b.billed_invoice_id ? 'ya está en una factura' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const source = {
            id: b.id,
            label_code: b.label_code || '',
            bulto_number: b.bulto_number,
            package_count: boxed.length + ((b.unregistered_codes || []).length || 0),
            order_numbers: Array.isArray(b.cbm_order_numbers) ? b.cbm_order_numbers : [],
            status: b.status || '',
            printed: Number(b.print_count || 0) > 0,
            usage_note: usageNote,
          };
          for (const pid of boxed) {
            sourceMap[pid] = source;
            if (!receivedIds.has(pid)) extraIds.push(pid);
          }
        }
        setOtherBultoMap(sourceMap);
        setOtherBultoPkgs(
          (await Promise.all(
            extraIds.map((id) => base44.entities.Package.get(id).catch(() => null))
          )).filter(Boolean)
        );
      } catch (_) {
      } finally {
        setLoadingPkgs(false);
      }
    })();
  }, [bulto]);

  const sameSource = (a, b) => (a?.label_code || a?.id) === (b?.label_code || b?.id);

  const togglePackage = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    const source = otherBultoMap[id];
    // Un paquete que está en otro bulto se puede marcar: se pide confirmación porque al
    // guardar ese bulto viejo se fusiona y se elimina.
    if (source && !absorbedSources.some((s) => sameSource(s, source))) {
      setPendingAbsorb({ id, source });
      return;
    }
    setSelectedIds((prev) => [...prev, id]);
  };

  const confirmAbsorb = () => {
    if (!pendingAbsorb) return;
    setAbsorbedSources((prev) => [...prev, pendingAbsorb.source]);
    setSelectedIds((prev) => [...prev, pendingAbsorb.id]);
    setPendingAbsorb(null);
    toast.info(`Se fusiona el bulto ${pendingAbsorb.source.label_code || ''}`);
  };

  const handleSave = async () => {
    // Los bultos sin paquetes reales en el sistema (cajas pre-armadas o escaneos
    // offline) sí se pueden guardar: solo se edita su información.
    if (!selectedIds.length && bultoPkgs.length) {
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
      // El recibo de contabilidad se alinea con el N° de contenedor, el CBM y el conteo
      // registrados aquí (almacén de Venezuela); si hay conflicto, se avisa.
      const warnings = res?.data?.sync?.warnings || [];
      setSyncWarnings(warnings);
      toast.success('Bulto actualizado');
      if (warnings.length) toast.warning(warnings[0]);
      // Fusión: el bulto viejo que contenía los paquetes marcados se eliminó.
      const absorbed = res?.data?.absorbed || null;
      const absorbedLabels = (absorbed?.bultos || []).map((b) => b.label_code).filter(Boolean);
      if (absorbedLabels.length) {
        toast.success(`Se fusionó el bulto ${absorbedLabels.join(', ')}`);
      }
      (absorbed?.warnings || []).forEach((message) => toast.warning(message));
      onSaved?.(res.data.bulto);
      onClose();
    } catch (e) {
      toast.error('Error al actualizar el bulto');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setSnapshot((prev) => ({ ...prev, [field]: value }));

  // Paquetes del cliente + los que ya están en este bulto (aunque no estén recibidos).
  const listedPackages = useMemo(() => {
    const seen = new Set();
    return [...clientPackages, ...bultoPkgs, ...otherBultoPkgs].filter((p) => {
      if (!p?.id || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [clientPackages, bultoPkgs, otherBultoPkgs]);

  const unregisteredCodes = Array.isArray(bulto?.unregistered_codes)
    ? bulto.unregistered_codes.filter(Boolean)
    : [];

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
              ) : listedPackages.length === 0 ? (
                <p className="text-sm text-slate-500">No hay paquetes recibidos para este cliente.</p>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                  {listedPackages.map((p) => {
                    const source = otherBultoMap[p.id];
                    const isSelected = selectedIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer transition-colors ${
                          isSelected ? 'border-blue-400 bg-blue-50' : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePackage(p.id)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-slate-800 break-all">{p.tracking_number}</p>
                          {p.description && <p className="text-xs text-slate-500 truncate">{p.description}</p>}
                        </div>
                        {source && (
                          <span className="shrink-0 text-[10px] text-blue-700">
                            Fusiona bulto {source.label_code || source.bulto_number}
                          </span>
                        )}
                        {!source && p.status && p.status !== 'recibido' && (
                          <span className="text-xs text-slate-400 shrink-0">{p.status}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {unregisteredCodes.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Códigos sin registrar en el sistema ({unregisteredCodes.length}):{' '}
                  <span className="font-mono break-all">{unregisteredCodes.join(', ')}</span>
                </p>
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
                  <option value="en_almacen_ve">En Almacén Venezuela</option>
                  <option value="despachado">Despachado</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-xs">Números de contenedor (CbmIngreso)</Label>
                <Input
                  value={orderNumbers}
                  onChange={(e) => setOrderNumbers(e.target.value)}
                  placeholder="Separar con comas si son varias"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Número(s) de contenedor asignado(s) en el almacén de China. Se muestran en la etiqueta y al cliente.
                </p>
              </div>
            </div>
          </div>
        )}

        {syncWarnings.length > 0 && <AccountingSyncNotice messages={syncWarnings} />}

        <AbsorbedBultosHistory entries={bulto?.absorbed_bultos} />

        <AbsorbBultosConfirmDialog
          open={!!pendingAbsorb}
          sources={pendingAbsorb ? [pendingAbsorb.source] : []}
          codes={[]}
          clientEmail={bulto?.client_email || ''}
          onConfirm={confirmAbsorb}
          onCancel={() => setPendingAbsorb(null)}
        />

        <DialogFooter className="flex-wrap gap-2 min-w-0">
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