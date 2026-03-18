import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Sparkles } from 'lucide-react';

export default function ReceivePackagePanel({ pkg, form, setForm, warehouses, locations, suggestedLocation, onSuggest, onSubmit, submitting, failed = false }) {
  return (
    <Card className={`shadow-lg transition-all ${submitting ? 'opacity-80' : ''} ${failed ? 'border-rose-200 bg-rose-50/40' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> {pkg.tracking_number}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{pkg.client_email}</Badge>
          <Badge variant="secondary">{pkg.shipping_mark || 'Sin shipping mark'}</Badge>
          <Badge variant="outline">{pkg.status}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Select value={form.warehouse_id} onValueChange={(value) => setForm({ ...form, warehouse_id: value, location_id: '' })}>
              <SelectTrigger><SelectValue placeholder="Selecciona almacén" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name} · {warehouse.city}, {warehouse.country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Peso real (kg)</Label>
            <Input type="number" min="0" step="0.01" value={form.actual_weight_kg} onChange={(e) => setForm({ ...form, actual_weight_kg: e.target.value })} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Ubicación</Label>
            <Select value={form.location_id} onValueChange={(value) => setForm({ ...form, location_id: value })}>
              <SelectTrigger><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>{location.warehouse_name} · {location.code} · {location.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>

        <div className="space-y-2">
          <Label>Notas de recepción</Label>
          <Textarea value={form.reception_notes} onChange={(e) => setForm({ ...form, reception_notes: e.target.value })} />
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
          <Button onClick={onSubmit} disabled={submitting || !form.location_id} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? 'Procesando...' : 'Recibir y ubicar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}