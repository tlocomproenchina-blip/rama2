import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PackageOpen } from 'lucide-react';
import IncidentClientPicker from './IncidentClientPicker';
import IncidentPhotoPicker from './IncidentPhotoPicker';

// Registro de una incidencia: foto del paquete abierto, N° de contenedor y el
// cliente con su código. La foto se guarda en almacenamiento privado y en el
// registro queda solo el identificador del archivo.
export default function IncidentFormCard({ onSaved }) {
  const { user } = useAuth();
  const [container, setContainer] = useState('');
  const [client, setClient] = useState(null);
  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const reset = () => {
    setContainer('');
    setClient(null);
    setCode('');
    setNotes('');
    setFile(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!container.trim()) {
      setError('Escribe el N° de contenedor.');
      return;
    }
    if (!file) {
      setError('Agrega la foto del paquete abierto.');
      return;
    }

    setSaving(true);
    try {
      const uploaded = await base44.integrations.Core.UploadPrivateFile({ file });
      const photoUri = uploaded?.file_uri || uploaded?.data?.file_uri;
      if (!photoUri) throw new Error('No se pudo subir la foto.');

      await base44.entities.WarehouseIncident.create({
        container_number: container.trim().toUpperCase(),
        client_code: (code.trim() || client?.shipping_mark || '').toUpperCase(),
        client_email: client?.email || '',
        client_name: client?.full_name || '',
        photo_uri: photoUri,
        notes: notes.trim(),
        reported_date: new Date().toISOString(),
        reported_by: user?.email || '',
        reported_by_name: user?.full_name || '',
      });

      reset();
      setSuccess('Incidencia registrada.');
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la incidencia.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageOpen className="h-4 w-4 text-primary" /> Registrar paquete abierto
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="incident-container">N° de contenedor</Label>
              <Input
                id="incident-container"
                value={container}
                onChange={(event) => setContainer(event.target.value.toUpperCase())}
                placeholder="Ej: TLLU1234567"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="incident-code">Código del cliente</Label>
              <Input
                id="incident-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="Shipping mark del cliente"
              />
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
              <Label>Foto del paquete</Label>
              <IncidentPhotoPicker file={file} previewUrl={previewUrl} onChange={setFile} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="incident-notes">Detalle</Label>
            <Textarea
              id="incident-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Qué se encontró abierto, faltante o dañado…"
              rows={3}
            />
          </div>

          {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          {success ? <p className="text-sm font-medium text-emerald-600">{success}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar incidencia
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}