import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import IncidentPhotoPicker from './IncidentPhotoPicker';

const RESULT = {
  recibida: { label: 'Recibida', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  recibida_con_incidencia: { label: 'Recibida con incidencia', cls: 'border-red-200 bg-red-50 text-red-700' },
};

// Una caja del cliente: contenido declarado y acciones para confirmar o abrir incidencia.
export default function InventoryUnitRow({ unit, container, onReviewed }) {
  const [mode, setMode] = useState(null);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const result = unit.review ? RESULT[unit.review.result] : null;

  const submit = async (kind) => {
    setError('');
    if (kind === 'incidencia' && (!file || !notes.trim() || !container.trim())) {
      setError('Escribe el N° de contenedor, la diferencia y agrega la foto.');
      return;
    }
    setSaving(true);
    try {
      let photo_uri = '';
      if (kind === 'incidencia') {
        const up = await base44.integrations.Core.UploadPrivateFile({ file });
        photo_uri = up?.file_uri || up?.data?.file_uri;
      }
      await base44.functions.invoke('cajaInventoryReview', {
        action: 'review', bulto_id: unit.id, container_number: container,
        result: kind === 'incidencia' ? 'recibida_con_incidencia' : 'recibida', notes, photo_uri,
      });
      setMode(null); setNotes(''); setFile(null);
      onReviewed();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">{unit.label_code}</span>
        <Badge variant="outline" className="text-xs">{unit.is_caja ? 'Caja' : 'Bulto'}</Badge>
        {result ? <Badge variant="outline" className={`text-xs ${result.cls}`}>{result.label}</Badge> : <Badge variant="outline" className="text-xs">Sin revisar</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{unit.package_count} paquete(s)</span>
      </div>
      <ul className="space-y-1 text-xs">
        {unit.packages.map((p) => (
          <li key={p.tracking} className="rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="font-mono">{p.tracking}</span> · {p.description || 'Sin descripción'}{p.package_count > 1 ? ` · ${p.package_count} uds` : ''}
          </li>
        ))}
        {unit.unregistered_codes.map((c) => <li key={c} className="rounded-lg bg-muted/60 px-2 py-1.5 font-mono">{c} · sin registro</li>)}
        {!unit.packages.length && !unit.unregistered_codes.length && <li className="text-muted-foreground">Sin contenido declarado</li>}
      </ul>
      {unit.review?.notes ? <p className="text-xs text-red-700">{unit.review.notes}</p> : null}
      {mode === 'incidencia' ? (
        <div className="space-y-2">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Qué no coincide con lo declarado…" />
          <IncidentPhotoPicker file={file} previewUrl={previewUrl} onChange={setFile} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={saving} onClick={() => submit('incidencia')}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Registrar incidencia
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => submit('recibida')}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Coincide, recibida
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode('incidencia')}>
            <AlertTriangle className="h-4 w-4" /> No coincide
          </Button>
        </div>
      )}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}