import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function VehiculoForm({ value, onChange, choferes }) {
  const handleChoferChange = (choferId) => {
    const chofer = choferes.find((item) => item.id === choferId);
    onChange({
      ...value,
      chofer_id: choferId === 'sin_chofer' ? '' : choferId,
      chofer_nombre: choferId === 'sin_chofer' ? '' : `${chofer?.nombres || ''} ${chofer?.apellidos || ''}`.trim(),
    });
  };

  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Placa</Label>
        <Input value={value.placa} onChange={(e) => onChange({ ...value, placa: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={value.tipo} onValueChange={(tipo) => onChange({ ...value, tipo })}>
          <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="camion">Camión</SelectItem>
            <SelectItem value="van">Van</SelectItem>
            <SelectItem value="moto">Moto</SelectItem>
            <SelectItem value="pickup">Pickup</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Marca</Label>
        <Input value={value.marca} onChange={(e) => onChange({ ...value, marca: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Modelo</Label>
        <Input value={value.modelo} onChange={(e) => onChange({ ...value, modelo: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Año</Label>
        <Input type="number" value={value.anio} onChange={(e) => onChange({ ...value, anio: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={value.estado} onValueChange={(estado) => onChange({ ...value, estado })}>
          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="disponible">Disponible</SelectItem>
            <SelectItem value="en_ruta">En ruta</SelectItem>
            <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
            <SelectItem value="inactivo">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Capacidad peso (kg)</Label>
        <Input type="number" value={value.capacidad_peso_kg} onChange={(e) => onChange({ ...value, capacidad_peso_kg: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Capacidad volumen (m³)</Label>
        <Input type="number" value={value.capacidad_volumen_m3} onChange={(e) => onChange({ ...value, capacidad_volumen_m3: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Chofer asignado</Label>
        <Select value={value.chofer_id || 'sin_chofer'} onValueChange={handleChoferChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona chofer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_chofer">Sin chofer</SelectItem>
            {choferes.map((chofer) => (
              <SelectItem key={chofer.id} value={chofer.id}>{`${chofer.nombres || ''} ${chofer.apellidos || ''}`.trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Observaciones</Label>
        <Textarea value={value.observaciones} onChange={(e) => onChange({ ...value, observaciones: e.target.value })} />
      </div>
    </div>
  );
}