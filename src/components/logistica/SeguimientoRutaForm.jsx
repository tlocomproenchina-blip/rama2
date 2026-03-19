import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SeguimientoRutaForm({ value, onChange, rutas, cargas }) {
  const cargasFiltradas = value.ruta_id ? cargas.filter((item) => item.ruta_id === value.ruta_id) : cargas;

  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Ruta</Label>
        <Select value={value.ruta_id || 'sin_ruta'} onValueChange={(ruta_id) => onChange({ ...value, ruta_id: ruta_id === 'sin_ruta' ? '' : ruta_id, carga_ruta_id: '' })}>
          <SelectTrigger><SelectValue placeholder="Selecciona ruta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_ruta">Sin ruta</SelectItem>
            {rutas.map((ruta) => (
              <SelectItem key={ruta.id} value={ruta.id}>{`${ruta.codigo_ruta} · ${ruta.origen} → ${ruta.destino}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Carga relacionada</Label>
        <Select value={value.carga_ruta_id || 'sin_carga'} onValueChange={(carga_ruta_id) => onChange({ ...value, carga_ruta_id: carga_ruta_id === 'sin_carga' ? '' : carga_ruta_id })}>
          <SelectTrigger><SelectValue placeholder="Selecciona carga" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_carga">Sin carga específica</SelectItem>
            {cargasFiltradas.map((carga) => (
              <SelectItem key={carga.id} value={carga.id}>{carga.tracking_number || carga.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Fecha y hora</Label>
        <Input type="datetime-local" value={value.fecha_hora} onChange={(e) => onChange({ ...value, fecha_hora: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={value.estado} onValueChange={(estado) => onChange({ ...value, estado })}>
          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="salida">Salida</SelectItem>
            <SelectItem value="en_transito">En tránsito</SelectItem>
            <SelectItem value="detenido">Detenido</SelectItem>
            <SelectItem value="entrega_parcial">Entrega parcial</SelectItem>
            <SelectItem value="entregada">Entregada</SelectItem>
            <SelectItem value="incidencia">Incidencia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Ubicación</Label>
        <Input value={value.ubicacion} onChange={(e) => onChange({ ...value, ubicacion: e.target.value })} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Comentario</Label>
        <Textarea value={value.comentario} onChange={(e) => onChange({ ...value, comentario: e.target.value })} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>URL de evidencia</Label>
        <Input value={value.evidencia_url} onChange={(e) => onChange({ ...value, evidencia_url: e.target.value })} placeholder="https://..." />
      </div>
    </div>
  );
}