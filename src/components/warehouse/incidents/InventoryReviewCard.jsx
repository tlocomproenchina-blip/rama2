import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import IncidentClientSearch from './IncidentClientSearch';
import InventoryUnitRow from './InventoryUnitRow';
import MultiPhotoPicker from './MultiPhotoPicker';
import IncidentDetailsFields from './IncidentDetailsFields';

const upload = async (file) => {
  const up = await base44.integrations.Core.UploadPrivateFile({ file });
  return up?.file_uri || up?.data?.file_uri;
};

// Revisión única: cliente, contenedor, caja, foto del contenido y, si aplica, la incidencia.
export default function InventoryReviewCard({ onChanged }) {
  const [code, setCode] = useState('');
  const [client, setClient] = useState(null);
  const [container, setContainer] = useState('');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [loading, setLoading] = useState(false);
  const [contentPhotos, setContentPhotos] = useState([]);
  const [hasIncident, setHasIncident] = useState(false);
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [damagePhotos, setDamagePhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!client?.email) { setUnits([]); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('cajaInventoryReview', { action: 'list', client_email: client.email });
      setUnits((res?.data || res)?.units || []);
    } finally {
      setLoading(false);
    }
  }, [client?.email]);

  useEffect(() => { setUnitId(''); load(); }, [load]);

  const save = async () => {
    setError('');
    if (!client || !unitId) return setError('Elige el cliente y la caja que revisas.');
    if (!container.trim()) return setError('Escribe el N° de contenedor.');
    if (!contentPhotos.length) return setError('La foto del contenido es obligatoria.');
    if (hasIncident && (!type || !notes.trim())) return setError('Completa el tipo y el detalle de la incidencia.');
    setSaving(true);
    try {
      const content_photo_uri = await upload(contentPhotos[0]);
      const damage_photo_uris = hasIncident ? [content_photo_uri, ...(await Promise.all(damagePhotos.map(upload)))] : [];
      await base44.functions.invoke('cajaInventoryReview', {
        action: 'review', bulto_id: unitId, container_number: container, content_photo_uri,
        has_incident: hasIncident, incident_type: type, notes, damage_photo_uris,
      });
      toast.success(hasIncident ? 'Revisión con incidencia guardada' : 'Revisión guardada');
      setUnitId(''); setContentPhotos([]); setHasIncident(false); setType(''); setNotes(''); setDamagePhotos([]);
      load(); onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-primary" /> Revisión de inventario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Cliente o paquete</Label>
          <IncidentClientSearch code={code} client={client} onCodeChange={setCode}
            onSelect={(item) => { setClient(item); setCode(item.shipping_mark || ''); }}
            onClear={() => setClient(null)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-container">N° de contenedor</Label>
          <Input id="inv-container" value={container} onChange={(e) => setContainer(e.target.value.toUpperCase())} placeholder="Ej: TLLU1234567" />
        </div>
        {client ? (
          <div className="space-y-2">
            <Label>Caja que revisas</Label>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !units.length ? (
              <p className="text-sm text-muted-foreground">Este cliente no tiene cajas ni bultos registrados.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {units.map((u) => <InventoryUnitRow key={u.id} unit={u} selected={u.id === unitId} onSelect={() => setUnitId(u.id)} />)}
              </div>
            )}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Foto del contenido (obligatoria)</Label>
          <MultiPhotoPicker files={contentPhotos} onChange={setContentPhotos} max={1} hint="Abre la caja y fotografía su contenido. Uso interno." />
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium">
          <Checkbox checked={hasIncident} onCheckedChange={(v) => setHasIncident(!!v)} /> Hay incidencia
        </label>
        {hasIncident ? (
          <IncidentDetailsFields type={type} onType={setType} notes={notes} onNotes={setNotes} photos={damagePhotos} onPhotos={setDamagePhotos} />
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar revisión
        </Button>
      </CardContent>
    </Card>
  );
}