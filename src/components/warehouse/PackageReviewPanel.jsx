import React, { useRef, useState } from 'react';
import { enqueueReview } from '@/lib/reviewQueue';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardCheck, FileText, Loader2, PackagePlus, X } from 'lucide-react';
import MultiPhotoPicker from '@/components/warehouse/incidents/MultiPhotoPicker';
import IncidentDetailsFields from '@/components/warehouse/incidents/IncidentDetailsFields';
import { isOpenBox, OPEN_BOX_LABEL } from '@/lib/incidentTone';
import ExistingIncidentNotice from './ExistingIncidentNotice';

// Revisión obligatoria de cada paquete escaneado antes de añadirlo a la unidad activa.
export default function PackageReviewPanel({ review, unitLabel, client, knownContainer = '', onDone, onCancel }) {
  const { code, pkg } = review;
  const keyRef = useRef(`${code}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [container, setContainer] = useState(knownContainer);
  const [editContainer, setEditContainer] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [hasIncident, setHasIncident] = useState(false);
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [damage, setDamage] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);

  const save = async () => {
    setError('');
    if (!container.trim()) return setError('Escribe el N° de contenedor.');
    if (!photos.length) return setError('La foto del contenido es obligatoria.');
    if (hasIncident && (!type || !notes.trim())) return setError('Completa el tipo y el detalle de la incidencia.');
    setSaving(true);
    const tracking = pkg?.tracking_number || code;
    const damagePhotos = hasIncident ? damage : [];
    const email = pkg?.client_email || client?.email;
    if (hasIncident && tracking && email) {
      const chk = await base44.functions.invoke('cajaInventoryReview', { action: 'check_incident', tracking_number: tracking, client_email: email }).catch(() => null);
      if (chk?.data?.exists) {
        setExisting(chk.data);
        setSaving(false);
        return;
      }
    }
    try {
      // Se guarda en el dispositivo y se sube en segundo plano: el empaque sigue al instante.
      await enqueueReview({
        key: keyRef.current,
        contentPhoto: photos[0],
        damagePhotos,
        payload: {
          tracking_number: tracking, package_id: pkg?.id, client_email: pkg?.client_email || client?.email,
          client_name: client?.full_name || '', shipping_mark: pkg?.shipping_mark, unit_label: unitLabel,
          container_number: container, has_incident: hasIncident, incident_type: type, notes,
        },
      });
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la revisión en el dispositivo.');
      setSaving(false);
      return;
    }
    const contentUri = URL.createObjectURL(photos[0]);
    onDone(hasIncident, {
      tracking, description: pkg?.description || '', container, hasIncident, type, notes,
      contentUri, damageUris: hasIncident ? [contentUri, ...damagePhotos.map((f) => URL.createObjectURL(f))] : [],
    });
  };

  return (
    <Card className="border-primary/40 shadow-premium">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-semibold text-foreground"><ClipboardCheck className="h-4 w-4 text-primary" /> Revisar paquete</p>
            <p className="break-all font-mono text-xs text-muted-foreground">{pkg?.tracking_number || code}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onCancel} disabled={saving}><X /></Button>
        </div>
        <div className="rounded-xl border border-primary/30 bg-accent/50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"><FileText className="h-3.5 w-3.5" /> Descripción del cliente</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{pkg?.description || 'Sin descripción registrada'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {client?.full_name || pkg?.client_email || 'Cliente'}{pkg?.shipping_mark ? ` · ${pkg.shipping_mark}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">Va a: {unitLabel || 'unidad que se abra para el cliente'}</p>
        </div>
        {knownContainer && !editContainer ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
            <span>Contenedor de la caja: <b className="font-mono">{container}</b></span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditContainer(true)}>Cambiar</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>N° de contenedor (obligatorio)</Label>
            <Input value={container} onChange={(e) => setContainer(e.target.value.toUpperCase())} placeholder="Ej: TLLU1234567" />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Foto del contenido (obligatoria)</Label>
          <MultiPhotoPicker files={photos} onChange={setPhotos} max={1} hint="Fotografía el contenido del paquete. Uso interno." />
        </div>
        <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${hasIncident && !isOpenBox(type) ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
          Estado: {hasIncident ? (isOpenBox(type) ? OPEN_BOX_LABEL : 'Con incidencia') : 'Sin incidencia'}
        </p>
        <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium">
          <Checkbox checked={hasIncident} onCheckedChange={(v) => setHasIncident(!!v)} /> Hay incidencia
        </label>
        {hasIncident && <IncidentDetailsFields type={type} onType={setType} notes={notes} onNotes={setNotes} photos={damage} onPhotos={setDamage} />}
        {existing && (
          <ExistingIncidentNotice
            data={existing}
            tracking={pkg?.tracking_number || code}
            description={pkg?.description || ''}
            packing={saving}
            onPackWithExisting={(summary) => { setSaving(true); onDone(true, summary); }}
          />
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />} Guardar revisión y empacar
        </Button>
      </CardContent>
    </Card>
  );
}