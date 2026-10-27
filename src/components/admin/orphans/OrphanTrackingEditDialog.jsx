import React, { useEffect, useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

// Renombra el tracking con el que quedó registrado un paquete huérfano.
export default function OrphanTrackingEditDialog({ pkg, onClose, onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(pkg?.tracking_number || '');
  }, [pkg?.id, pkg?.tracking_number]);

  if (!pkg) return null;

  const handleSave = async () => {
    const tracking = value.trim().replace(/\s+/g, '');
    if (!tracking) {
      toast.error('El tracking no puede quedar vacío');
      return;
    }
    if (tracking === pkg.tracking_number) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Package.update(pkg.id, { tracking_number: tracking });
      onSaved(pkg.id, tracking);
      toast.success('Tracking actualizado');
      onClose();
    } catch (e) {
      toast.error('No se pudo guardar: ' + (e?.message || 'error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-0 md:p-4 md:pt-24" onClick={() => !saving && onClose()}>
      <Card className="w-full md:max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-5 w-5 text-amber-600" /> Editar tracking
          </CardTitle>
          <p className="text-sm text-slate-500">Corrige el número con el que se registró esta carga.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tracking</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleSave(); }}
              className="font-mono"
              autoFocus
            />
            <p className="text-xs text-slate-500 font-mono break-all">Actual: {pkg.tracking_number}</p>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}