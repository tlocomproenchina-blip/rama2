import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RutaForm({ value, onChange, vehiculos, choferes }) {
  const handleVehiculoChange = (vehiculoId) => {
    const vehiculo = vehiculos.find((item) => item.id === vehiculoId);
    onChange({
      ...value,
      vehiculo_id: vehiculoId === 'sin_vehiculo' ? '' : vehiculoId,
      vehiculo_placa: vehiculoId === 'sin_vehiculo' ? '' : vehiculo?.placa || '',
    });
  };

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
        <Label>Código de ruta</Label>
        <Input value={value.codigo_ruta} onChange={(e) => onChange({ ...value, codigo_ruta: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Tipo de ruta</Label>
        <Select value={value.tipo_ruta} onValueChange={(tipo_ruta) => onChange({ ...value, tipo_ruta })}>
          <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="urbana">Urbana</SelectItem>
            <SelectItem value="interurbana">Interurbana</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Origen</Label>
        <Input value={value.origen} onChange={(e) => onChange({ ...value, origen: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Destino</Label>
        <Input value={value.destino} onChange={(e) => onChange({ ...value, destino: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Fecha de salida</Label>
        <Input type="datetime-local" value={value.fecha_salida} onChange={(e) => onChange({ ...value, fecha_salida: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Fecha estimada de entrega</Label>
        <Input type="datetime-local" value={value.fecha_estimada_entrega} onChange={(e) => onChange({ ...value, fecha_estimada_entrega: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Vehículo</Label>
        <Select value={value.vehiculo_id || 'sin_vehiculo'} onValueChange={handleVehiculoChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona vehículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_vehiculo">Sin vehículo</SelectItem>
            {vehiculos.map((vehiculo) => (
              <SelectItem key={vehiculo.id} value={vehiculo.id}>{vehiculo.placa}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Chofer</Label>
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
      <div className="space-y-2">
        <Label>Estado</Label>
        <Select value={value.estado} onValueChange={(estado) => onChange({ ...value, estado })}>
          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="planificada">Planificada</SelectItem>
            <SelectItem value="asignada">Asignada</SelectItem>
            <SelectItem value="en_curso">En curso</SelectItem>
            <SelectItem value="completada">Completada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Total paradas</Label>
        <Input type="number" value={value.total_paradas} onChange={(e) => onChange({ ...value, total_paradas: e.target.value })} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Observaciones</Label>
        <Textarea value={value.observaciones} onChange={(e) => onChange({ ...value, observaciones: e.target.value })} />
      </div>
    </div>
  );
}