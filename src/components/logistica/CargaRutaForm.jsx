import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function CargaRutaForm({ value, onChange, rutas, packages }) {
  const handleRutaChange = (rutaId) => {
    onChange({ ...value, ruta_id: rutaId === 'sin_ruta' ? '' : rutaId });
  };

  const handleTipoCargaChange = (tipo_carga) => {
    onChange({
      ...value,
      tipo_carga,
      package_id: tipo_carga === 'paquete' ? value.package_id : '',
      tracking_number: tipo_carga === 'paquete' ? value.tracking_number : '',
    });
  };

  const handlePackageChange = (packageId) => {
    const pkg = packages.find((item) => item.id === packageId);
    onChange({
      ...value,
      package_id: packageId === 'sin_paquete' ? '' : packageId,
      tracking_number: packageId === 'sin_paquete' ? '' : pkg?.tracking_number || '',
      cliente_email: packageId === 'sin_paquete' ? value.cliente_email : pkg?.client_email || '',
      descripcion: packageId === 'sin_paquete' ? value.descripcion : pkg?.description || '',
    });
  };

  return (
    <div className="grid gap-4 py-2 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Ruta</Label>
        <Select value={value.ruta_id || 'sin_ruta'} onValueChange={handleRutaChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona ruta" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_ruta">Sin ruta</SelectItem>
            {rutas.map((ruta) => (
              <SelectItem key={ruta.id} value={ruta.id}>{`${ruta.codigo_ruta} · ${ruta.origen} → ${ruta.destino}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tipo de carga</Label>
        <Select value={value.tipo_carga} onValueChange={handleTipoCargaChange}>
          <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="paquete">Paquete</SelectItem>
            <SelectItem value="carga_completa">Carga completa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.tipo_carga === 'paquete' ? (
        <div className="space-y-2">
          <Label>Paquete</Label>
          <Select value={value.package_id || 'sin_paquete'} onValueChange={handlePackageChange}>
            <SelectTrigger><SelectValue placeholder="Selecciona paquete" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sin_paquete">Sin paquete</SelectItem>
              {packages.map((pkg) => (
                <SelectItem key={pkg.id} value={pkg.id}>{pkg.tracking_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Tracking / referencia</Label>
          <Input value={value.tracking_number} onChange={(e) => onChange({ ...value, tracking_number: e.target.value })} />
        </div>
      )}

      <div className="space-y-2 md:col-span-2">
        <Label>Descripción</Label>
        <Input value={value.descripcion} onChange={(e) => onChange({ ...value, descripcion: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Cliente</Label>
        <Input value={value.cliente_email} onChange={(e) => onChange({ ...value, cliente_email: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Estado de entrega</Label>
        <Select value={value.estado_entrega} onValueChange={(estado_entrega) => onChange({ ...value, estado_entrega })}>
          <SelectTrigger><SelectValue placeholder="Selecciona estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="en_transito">En tránsito</SelectItem>
            <SelectItem value="entrega_parcial">Entrega parcial</SelectItem>
            <SelectItem value="entregada">Entregada</SelectItem>
            <SelectItem value="incidencia">Incidencia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Peso (kg)</Label>
        <Input type="number" value={value.peso_kg} onChange={(e) => onChange({ ...value, peso_kg: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Volumen (m³)</Label>
        <Input type="number" value={value.volumen_m3} onChange={(e) => onChange({ ...value, volumen_m3: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label>Cantidad de bultos</Label>
        <Input type="number" value={value.cantidad_bultos} onChange={(e) => onChange({ ...value, cantidad_bultos: e.target.value })} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Destino de entrega</Label>
        <Input value={value.destino_entrega} onChange={(e) => onChange({ ...value, destino_entrega: e.target.value })} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Observaciones</Label>
        <Textarea value={value.observaciones} onChange={(e) => onChange({ ...value, observaciones: e.target.value })} />
      </div>
    </div>
  );
}