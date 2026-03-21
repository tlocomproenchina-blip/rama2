import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, History } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/common/PageHero';

function formatActionLabel(actionType) {
  const labels = {
    create: 'Creación',
    update: 'Actualización',
    delete: 'Eliminación',
  };
  return labels[actionType] || String(actionType || 'sin_accion').replaceAll('_', ' ');
}

const HIDDEN_FIELDS = new Set([
  'id',
  'app_id',
  'created_by_id',
  'is_sample',
  'is_deleted',
  'deleted_date',
  'updated_date',
  'created_date',
  'environment',
]);

const FIELD_LABELS = {
  reported: 'Reportado',
  tracking_number: 'Número de tracking',
  client_email: 'Correo del cliente',
  shipping_mark: 'Shipping Mark',
  shipping_type: 'Tipo de envío',
  description: 'Descripción',
  status: 'Estado',
  has_insurance: 'Tiene seguro',
  fob_value: 'Valor FOB',
  invoice_url: 'Factura',
  package_image_url: 'Imagen del paquete',
  package_image_urls: 'Imágenes del paquete',
  consolidation_id: 'Consolidación',
  received_date: 'Fecha de recepción',
  received_by: 'Recibido por',
  warehouse_name: 'Almacén',
  warehouse_city: 'Ciudad del almacén',
  warehouse_country: 'País del almacén',
  warehouse_location_code: 'Ubicación en almacén',
  warehouse_location_name: 'Nombre de ubicación',
  warehouse_zone: 'Zona de almacén',
  actual_weight_kg: 'Peso real (kg)',
  actual_length_cm: 'Largo real (cm)',
  actual_width_cm: 'Ancho real (cm)',
  actual_height_cm: 'Alto real (cm)',
  actual_cbm: 'Volumen real (CBM)',
  reception_notes: 'Notas de recepción',
  codigo_ruta: 'Código de ruta',
  tipo_ruta: 'Tipo de ruta',
  origen: 'Origen',
  destino: 'Destino',
  fecha_salida: 'Fecha de salida',
  fecha_estimada_entrega: 'Fecha estimada de entrega',
  vehiculo_id: 'Vehículo asignado',
  vehiculo_placa: 'Placa del vehículo',
  chofer_id: 'Chofer asignado',
  chofer_nombre: 'Nombre del chofer',
  estado: 'Estado',
  total_paradas: 'Total de paradas',
  observaciones: 'Observaciones',
};

const VALUE_LABELS = {
  reported: { true: 'Sí', false: 'No' },
  has_insurance: { true: 'Sí', false: 'No' },
  is_active: { true: 'Sí', false: 'No' },
  status: {
    pre_alerta: 'Pre-alerta',
    recibido: 'Recibido',
    consolidado: 'Consolidado',
    en_transito: 'En tránsito',
    disponible: 'Disponible',
    entregado: 'Entregado',
  },
  shipping_type: {
    aereo: 'Aéreo',
    maritimo: 'Marítimo',
  },
  tipo_ruta: {
    urbana: 'Urbana',
    interurbana: 'Interurbana',
  },
  estado: {
    planificada: 'Planificada',
    asignada: 'Asignada',
    en_curso: 'En curso',
    completada: 'Completada',
    cancelada: 'Cancelada',
    pre_alerta: 'Pre-alerta',
    recibido: 'Recibido',
    consolidado: 'Consolidado',
    en_transito: 'En tránsito',
    disponible: 'Disponible',
    entregado: 'Entregado',
  },
};

function humanizeFieldName(fieldName) {
  if (!fieldName) return '—';
  if (FIELD_LABELS[fieldName]) return FIELD_LABELS[fieldName];
  return String(fieldName)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatReadableValue(fieldName, value) {
  if (value === null || value === undefined || value === '') return '—';

  const normalized = String(value).trim();

  if (VALUE_LABELS[fieldName]?.[normalized] !== undefined) {
    return VALUE_LABELS[fieldName][normalized];
  }

  if (normalized === 'true') return 'Sí';
  if (normalized === 'false') return 'No';

  if (fieldName?.includes('_date')) {
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('es-VE');
    }
  }

  if (normalized.startsWith('http')) return 'Archivo adjunto';

  if (fieldName?.endsWith('_id')) return 'Referencia interna actualizada';

  return normalized.replaceAll('_', ' ');
}

export default function AdminActivityAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const rows = await base44.entities.ActivityAuditLog.list('-created_date', 300);
        setLogs(rows || []);
      } catch {
        toast.error('No se pudo cargar la auditoría de actividad');
      }
      setLoading(false);
    };

    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const q = String(search || '').toLowerCase();
    const matchesEntity = entityFilter === 'all' || log.entity_name === entityFilter;
    const haystack = [
      log.entity_label,
      log.actor_email,
      log.actor_name,
      log.summary,
    ].map((value) => String(value || '').toLowerCase()).join(' ');
    return matchesEntity && (!q || haystack.includes(q));
  }), [entityFilter, logs, search]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <PageHero
        icon={History}
        badge="Auditoría de actividad"
        title="Auditoría de Actividad"
        description="Revisa los cambios recientes sobre paquetes y rutas, con actor, fecha y comparación de valores."
      />

      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Historial reciente</CardTitle>
          <CardDescription>Seguimiento detallado de cambios operativos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por actor, paquete, ruta o resumen" className="pl-10" />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar entidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="Package">Paquetes</SelectItem>
                <SelectItem value="Ruta">Rutas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="border border-slate-100 bg-slate-50/60 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{log.summary}</h3>
                        <Badge className="bg-blue-100 text-blue-700">{formatActionLabel(log.action_type)}</Badge>
                        <Badge variant="outline">{log.entity_name === 'Package' ? 'Paquete' : log.entity_name === 'Ruta' ? 'Ruta' : log.entity_name}</Badge>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{new Date(log.created_date).toLocaleString('es-VE')}</p>
                    </div>
                    <div className="text-sm text-slate-600">
                      <span className="font-medium">Actor:</span> {log.actor_name || log.actor_email || 'Sistema'}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Registro afectado</p>
                    <p className="mt-1 text-sm text-slate-700">{log.entity_label || '—'}</p>
                  </div>

                  <div className="space-y-2">
                    {Array.isArray(log.changed_fields) && log.changed_fields.filter((change) => !HIDDEN_FIELDS.has(change.field_name)).length > 0 ? log.changed_fields.filter((change) => !HIDDEN_FIELDS.has(change.field_name)).map((change, index) => (
                      <div key={`${log.id}-${index}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Campo</p>
                          <p className="mt-1 text-sm font-medium text-slate-700">{humanizeFieldName(change.field_name)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Valor anterior</p>
                          <p className="mt-1 text-sm text-rose-700 break-words">{formatReadableValue(change.field_name, change.old_value)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400">Valor nuevo</p>
                          <p className="mt-1 text-sm text-emerald-700 break-words">{formatReadableValue(change.field_name, change.new_value)}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">Sin cambios relevantes para mostrar.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}