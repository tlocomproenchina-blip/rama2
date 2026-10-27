import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import IncidentClientPicker from './IncidentClientPicker';
import IncidentPhotoPicker from './IncidentPhotoPicker';
import useSignedUri from './useSignedUri';

// Edición de una incidencia ya registrada: se pueden corregir contenedor,
// cliente, código y detalle, y reemplazar la foto (se sube como archivo privado).
export default function IncidentEditDialog({ incident, open, onClose, onSaved }) {
  const [container, setContainer] = useState('');
  const [client, setClient] = useState(null);
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const currentPhotoUrl = useSignedUri(incident?.photo_uri);
  const newPreviewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl); }, [newPreviewUrl]);

  useEffect(() => {
    if (!open || !incident) return;
    setContainer(incident.container_number || '');
    setCode(incident.client_code || '');
    setNotes(incident.notes || '');
    setClient(incident.client_email ? {
      email: incident.client_email,
      full_name: incident.client_name || incident.client_email,
      shipping_mark: incident.client_code || '',
    } : null);
    setFile(null);
    setError('');
  }, [open, incident]);

  const save = async () => {
    setError('');
    if (!container.trim()) {
      setError('Escribe el N° de contenedor.');
      return;
    }

    setSaving(true);
    try {
      const data = {
        container_number: container.trim().toUpperCase(),
        client_code: (code.trim() || client?.shipping_mark || '').toUpperCase(),
        client_email: client?.email || '',
        client_name: client?.full_name || '',
        notes: notes.trim(),
      };

      if (file) {
        const uploaded = await base44.integrations.Core.UploadPrivateFile({ file });
        const photoUri = uploaded?.file_uri || uploaded?.data?.file_uri;
        if (!photoUri) throw new Error('No se pudo subir la foto.');
        data.photo_uri = photoUri;
      }

      await base44.entities.WarehouseIncident.update(incident.id, data);
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la incidencia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose?.(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar incidencia</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-container">N° de contenedor</Label>
            <Input id="edit-container" value={container} onChange={(event) => setContainer(event.target.value.toUpperCase())} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-code">Código del cliente</Label>
            <Input id="edit-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente registrado</Label>
            <IncidentClientPicker
              client={client}
              onSelect={(item) => {
                setClient(item);
                if (item?.shipping_mark) setCode(item.shipping_mark);
              }}
              onClear={() => setClient(null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Foto</Label>
            <IncidentPhotoPicker file={file} previewUrl={newPreviewUrl || currentPhotoUrl} onChange={setFile} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-notes">Detalle</Label>
          <Textarea id="edit-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </div>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}