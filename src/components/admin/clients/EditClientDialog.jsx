import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Phone, Tag, X, Save, Loader2, IdCard } from 'lucide-react';

export default function EditClientDialog({
  open, onOpenChange,
  editData, setEditData,
  stateConfigs,
  saving,
  onSave,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto sm:max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>
            Actualiza la información del cliente y asigna o modifica su Shipping Mark
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={editData.first_name}
                onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                placeholder="Nombre"
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input
                value={editData.last_name}
                onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                placeholder="Apellido"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IdCard className="h-4 w-4" /> Cédula
            </Label>
            <Input
              value={editData.cedula || ''}
              onChange={(e) => setEditData({ ...editData, cedula: e.target.value })}
              placeholder="V-12345678"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Estado
            </Label>
            <Select
              value={editData.state}
              onValueChange={(val) => setEditData({ ...editData, state: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                {stateConfigs.map((state) => (
                  <SelectItem key={state.state_code} value={state.state_code}>
                    {state.state_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Ciudad
            </Label>
            <Input
              value={editData.city}
              onChange={(e) => setEditData({ ...editData, city: e.target.value })}
              placeholder="Ciudad de entrega"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Dirección
            </Label>
            <Textarea
              value={editData.address}
              onChange={(e) => setEditData({ ...editData, address: e.target.value })}
              placeholder="Dirección completa"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> WhatsApp
            </Label>
            <Input
              value={editData.whatsapp}
              onChange={(e) => setEditData({ ...editData, whatsapp: e.target.value })}
              placeholder="+58 412 1234567"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Shipping Mark
            </Label>
            <Input
              value={editData.shipping_mark || ''}
              onChange={(e) => setEditData({ ...editData, shipping_mark: e.target.value })}
              placeholder="Ingresa el Shipping Mark completo"
              className="font-mono"
            />
          </div>
        </div>

        <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-200">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}