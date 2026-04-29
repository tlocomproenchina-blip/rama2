import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Pencil } from 'lucide-react';

export default function EditPackageModal({ pkg, processing, onClose, onSave }) {
  const [form, setForm] = useState({
    tracking_number: '',
    shipping_mark: '',
    description: '',
    shipping_type: 'maritimo',
    risk_category: 'general',
    package_count: 1,
    client_email: '',
  });

  useEffect(() => {
    if (pkg) {
      setForm({
        tracking_number: pkg.tracking_number || '',
        shipping_mark: pkg.shipping_mark || '',
        description: pkg.description || '',
        shipping_type: pkg.shipping_type || 'maritimo',
        risk_category: pkg.risk_category || 'general',
        package_count: pkg.package_count || 1,
        client_email: pkg.client_email || '',
      });
    }
  }, [pkg]);

  const handleSubmit = () => {
    const trackingTrimmed = (form.tracking_number || '').trim();
    if (!trackingTrimmed) return;
    onSave({
      tracking_number: trackingTrimmed,
      shipping_mark: (form.shipping_mark || '').trim(),
      description: (form.description || '').trim(),
      shipping_type: form.shipping_type,
      risk_category: form.risk_category,
      package_count: Number(form.package_count) || 1,
      client_email: (form.client_email || '').trim(),
    });
  };

  return (
    <Dialog open={!!pkg} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" /> Editar paquete
          </DialogTitle>
          <DialogDescription>
            Modifica los datos del paquete. Los cambios se guardan inmediatamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tracking *</Label>
            <Input
              value={form.tracking_number}
              onChange={(e) => setForm({ ...form, tracking_number: e.target.value })}
              placeholder="Tracking del paquete"
            />
          </div>

          <div className="space-y-2">
            <Label>Shipping Mark</Label>
            <Input
              value={form.shipping_mark}
              onChange={(e) => setForm({ ...form, shipping_mark: e.target.value })}
              placeholder="Ej: N6-TLEC-W1443S"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Email del cliente</Label>
            <Input
              type="email"
              value={form.client_email}
              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              placeholder="cliente@correo.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del paquete"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de envío</Label>
              <Select value={form.shipping_type} onValueChange={(v) => setForm({ ...form, shipping_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.risk_category} onValueChange={(v) => setForm({ ...form, risk_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="alto_riesgo">Alto riesgo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cantidad de bultos</Label>
            <Input
              type="number"
              min="1"
              value={form.package_count}
              onChange={(e) => setForm({ ...form, package_count: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}