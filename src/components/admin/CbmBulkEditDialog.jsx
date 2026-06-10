import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { format, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ship, MapPinned, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function CbmBulkEditDialog({ open, onOpenChange, selectedIds, onDone }) {
  const [fechaSalida, setFechaSalida] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState('');
  const [updateSalida, setUpdateSalida] = useState(false);
  const [updateDisponible, setUpdateDisponible] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!updateSalida && !updateDisponible) {
      toast.error('Selecciona al menos un campo a actualizar');
      return;
    }
    if (updateSalida && !fechaSalida) {
      toast.error('Ingresa la fecha de salida');
      return;
    }
    setSaving(true);
    const payload = {};
    if (updateSalida) {
      payload.fecha_salida = fechaSalida;
      payload.fecha_estimada_llegada = fechaLlegada || '';
    }
    if (updateDisponible) {
      payload.disponible_entrega = disponible;
    }
    for (const id of selectedIds) {
      await base44.entities.CbmIngreso.update(id, payload);
    }
    setSaving(false);
    toast.success(`${selectedIds.length} registro(s) actualizados`);
    setFechaSalida('');
    setFechaLlegada('');
    setUpdateSalida(false);
    setUpdateDisponible(false);
    setDisponible(true);
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" />
            Editar {selectedIds.length} registro(s)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Fecha de salida */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="bulk-salida" checked={updateSalida} onCheckedChange={(c) => setUpdateSalida(!!c)} />
              <Label htmlFor="bulk-salida" className="cursor-pointer flex items-center gap-2 font-medium">
                <Ship className="h-4 w-4" /> Actualizar fecha de salida
              </Label>
            </div>
            {updateSalida && (
              <div className="space-y-3 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de salida</Label>
                  <Input
                    type="date"
                    value={fechaSalida}
                    onChange={(e) => {
                      const salida = e.target.value;
                      setFechaSalida(salida);
                      setFechaLlegada(salida ? format(addDays(new Date(salida + 'T12:00:00'), 90), 'yyyy-MM-dd') : '');
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><MapPinned className="h-3 w-3" /> Fecha estimada de llegada</Label>
                  <Input type="date" value={fechaLlegada} onChange={(e) => setFechaLlegada(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">Calculado automáticamente: salida + 90 días</p>
                </div>
              </div>
            )}
          </div>

          {/* Disponible para entrega */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="bulk-disp-toggle" checked={updateDisponible} onCheckedChange={(c) => setUpdateDisponible(!!c)} />
              <Label htmlFor="bulk-disp-toggle" className="cursor-pointer font-medium text-emerald-800">
                Actualizar "Disponible para entrega"
              </Label>
            </div>
            {updateDisponible && (
              <div className="flex items-center gap-2 pl-6">
                <Checkbox id="bulk-disp-value" checked={disponible} onCheckedChange={(c) => setDisponible(!!c)} />
                <Label htmlFor="bulk-disp-value" className="cursor-pointer text-sm text-emerald-800">
                  Marcar como disponible para entrega
                </Label>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Aplicar a {selectedIds.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}