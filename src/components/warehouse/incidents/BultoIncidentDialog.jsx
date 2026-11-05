import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import IncidentDetailsFields from './IncidentDetailsFields';

const upload = async (file) => {
  const up = await base44.integrations.Core.UploadPrivateFile({ file });
  return up?.file_uri || up?.data?.file_uri;
};

// Registro de incidencia del bulto suelto activo en la Mesa de empaque.
export default function BultoIncidentDialog({ bulto, open, onClose }) {
  const [container, setContainer] = useState('');
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setType(''); setNotes(''); setPhotos([]); setError(''); }
  }, [open]);

  const save = async () => {
    setError('');
    if (!container.trim()) return setError('Escribe el N° de contenedor.');
    if (!type || !notes.trim()) return setError('Completa el tipo y el detalle de la incidencia.');
    if (!photos.length) return setError('Agrega al menos una foto.');
    setSaving(true);
    try {
      const photo_uris = await Promise.all(photos.map(upload));
      await base44.functions.invoke('cajaInventoryReview', {
        action: 'unit_incident',
        bulto_id: /^[a-f0-9]{24}$/.test(String(bulto.id || '')) ? bulto.id : '',
        label_code: bulto.label_code,
        client_email: bulto.client_email,
        client_name: bulto.client_snapshot?.full_name || '',
        shipping_mark: bulto.shipping_mark,
        container_number: container, incident_type: type, notes, photo_uris,
      });
      toast.success('Incidencia registrada');
      onClose();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar incidencia · {bulto?.label_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="bi-container">N° de contenedor</Label>
            <Input id="bi-container" value={container} onChange={(e) => setContainer(e.target.value.toUpperCase())} placeholder="Ej: TLLU1234567" />
          </div>
          <IncidentDetailsFields type={type} onType={setType} notes={notes} onNotes={setNotes} photos={photos} onPhotos={setPhotos} />
          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar incidencia
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}