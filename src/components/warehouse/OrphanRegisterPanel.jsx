import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Sparkles, Upload, Loader2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/components/api/ApiQueueManager';
import { uploadImageNoCredits } from '@/lib/imgbbUpload';

export default function OrphanRegisterPanel({ tracking, warehouses, locations, onSuggest, suggestedLocation, onDone }) {
  const [form, setForm] = useState({
    warehouse_id: '',
    location_id: '',
    shipping_type: 'aereo',
    risk_category: 'general',
    shipping_mark: '',
    actual_weight_kg: '',
    actual_length_cm: '',
    actual_width_cm: '',
    actual_height_cm: '',
    description: '',
    reception_notes: '',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredLocations = locations.filter((l) => !form.warehouse_id || l.warehouse_id === form.warehouse_id);

  const handlePhoto = async () => {
    if (!photoFile) return null;
    try {
      return await uploadImageNoCredits(photoFile);
    } catch {
      toast.error('No se pudo subir la foto del paquete');
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!form.warehouse_id || !form.location_id) {
      toast.error('Selecciona almacén y ubicación');
      return;
    }
    setSubmitting(true);
    try {
      const photoUrl = await handlePhoto();
      const payload = {
        tracking_number: tracking,
        warehouse_id: form.warehouse_id,
        location_id: form.location_id,
        shipping_type: form.shipping_type,
        risk_category: form.risk_category,
        shipping_mark: form.shipping_mark || undefined,
        actual_weight_kg: form.actual_weight_kg || undefined,
        actual_length_cm: form.actual_length_cm || undefined,
        actual_width_cm: form.actual_width_cm || undefined,
        actual_height_cm: form.actual_height_cm || undefined,
        description: form.description || undefined,
        reception_notes: form.reception_notes || undefined,
        package_image_url: photoUrl || undefined,
        package_image_urls: photoUrl ? [photoUrl] : undefined,
      };
      const { data } = await base44.functions.invoke('registerOrphanPackage', payload);
      if (data?.error) throw new Error(data.error);
      toast.success('Paquete huérfano registrado y ubicado');
      setForm({ warehouse_id: '', location_id: '', shipping_type: 'aereo', risk_category: 'general', shipping_mark: '', actual_weight_kg: '', actual_length_cm: '', actual_width_cm: '', actual_height_cm: '', description: '', reception_notes: '' });
      setPhotoFile(null);
      if (typeof onDone === 'function') onDone(data?.package);
    } catch (e) {
      toast.error(e?.message || 'No se pudo registrar el huérfano');
    }
    setSubmitting(false);
  };

  return (
    <Card className="shadow-lg border-amber-200/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <UserX className="h-5 w-5" /> Registrar huérfano: {tracking}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-sm text-amber-800">
          Este tracking no existe en el sistema. Si llegó sin pre-alerta, regístralo como <b>huérfano</b> (sin cliente). Cuando el cliente haga su pre-alerta con el mismo tracking, se le asignará automáticamente.
        </div>

        {tracking.length > 5 && /\d$/.test(tracking) && (
          <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-3 text-sm text-blue-800">
            ⚠️ Este código podría ser un <b>sub-tracking</b> (tracking master + dígitos extra). Al registrar, el sistema verificará automáticamente si el tracking master ya existe.
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Sin cliente</Badge>
          <Badge variant="secondary">{form.shipping_type === 'maritimo' ? 'Marítimo' : 'Aéreo'}</Badge>
          <Badge variant="outline">{form.risk_category === 'alto_riesgo' ? 'Alto riesgo' : 'General'}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Almacén *</Label>
            <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v, location_id: '' })}>
              <SelectTrigger><SelectValue placeholder="Selecciona almacén" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name} · {w.city}, {w.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Ubicación *</Label>
            <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger>
              <SelectContent>
                {filteredLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.code} · {l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de envío</Label>
            <Select value={form.shipping_type} onValueChange={(v) => setForm({ ...form, shipping_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aereo">Aéreo</SelectItem>
                <SelectItem value="maritimo">Marítimo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de carga</Label>
            <Select value={form.risk_category} onValueChange={(v) => setForm({ ...form, risk_category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="alto_riesgo">Alto riesgo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Shipping Mark (si está visible en la caja)</Label>
            <Input value={form.shipping_mark} onChange={(e) => setForm({ ...form, shipping_mark: e.target.value })} placeholder="Opcional — para buscar después" />
          </div>
          <div className="space-y-2">
            <Label>Peso real (kg)</Label>
            <Input type="number" min="0" step="0.01" value={form.actual_weight_kg} onChange={(e) => setForm({ ...form, actual_weight_kg: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Largo (cm)</Label>
            <Input type="number" min="0" step="0.01" value={form.actual_length_cm} onChange={(e) => setForm({ ...form, actual_length_cm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Ancho (cm)</Label>
            <Input type="number" min="0" step="0.01" value={form.actual_width_cm} onChange={(e) => setForm({ ...form, actual_width_cm: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Alto (cm)</Label>
            <Input type="number" min="0" step="0.01" value={form.actual_height_cm} onChange={(e) => setForm({ ...form, actual_height_cm: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descripción</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción del contenido (opcional)" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notas de recepción</Label>
            <Textarea value={form.reception_notes} onChange={(e) => setForm({ ...form, reception_notes: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Foto del paquete</Label>
            <div className="border-2 border-dashed rounded-xl p-4 text-center border-slate-200 hover:border-amber-400">
              <input type="file" accept="image/*" className="hidden" id="orphan-photo" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              <label htmlFor="orphan-photo" className="cursor-pointer">
                {photoFile ? (
                  <div className="space-y-2">
                    <img src={URL.createObjectURL(photoFile)} alt="Preview" className="max-h-28 mx-auto rounded-lg object-contain" />
                    <p className="text-sm text-emerald-600">{photoFile.name}</p>
                  </div>
                ) : (
                  <div className="text-slate-500">
                    <Upload className="h-7 w-7 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">Click para subir foto del paquete</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Ubicación sugerida</p>
            <p className="text-sm text-slate-500">{suggestedLocation ? `${suggestedLocation.code} · ${suggestedLocation.name}` : 'Aún no calculada'}</p>
          </div>
          <Button variant="outline" onClick={onSuggest} className="gap-2">
            <Sparkles className="h-4 w-4" /> Sugerir ubicación
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || !form.warehouse_id || !form.location_id} className="bg-amber-600 hover:bg-amber-700">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando...</> : <><UserX className="h-4 w-4 mr-2" /> Registrar huérfano</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}