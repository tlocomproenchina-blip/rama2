import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, ArrowUpRight } from 'lucide-react';
import { ROLE_PRESETS } from '@/lib/rolePermissions';
import SupportImageUploader from '@/components/support/SupportImageUploader';

const CATEGORIES = [
  { value: 'envio', label: 'Envío' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'pago', label: 'Pago' },
  { value: 'consolidacion', label: 'Consolidación' },
  { value: 'actualizar_datos', label: 'Actualizar datos' },
  { value: 'otro', label: 'Otro' },
];

const PRIORITIES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

function roleLabel(member) {
  if (member.role !== 'admin') return ROLE_PRESETS[member.custom_role]?.role_name || member.custom_role || 'Cliente';
  const area = ROLE_PRESETS[member.custom_role];
  return area ? area.role_name : 'Administrador';
}

// Crea el ticket del caso con la conversación, lo asigna a un supervisor y lo
// deja notificado para que continúe la atención.
export default function AssistantEscalateDialog({ open, onOpenChange, client, lastTurn, submitting, onConfirm }) {
  const [staff, setStaff] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [supervisor, setSupervisor] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('otro');
  const [priority, setPriority] = useState('media');
  const [summary, setSummary] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    const answer = lastTurn?.answer;
    setFiles([]);
    setSubject(answer?.asunto || (client ? `Caso de ${client.full_name || client.email}` : ''));
    setCategory(answer?.categoria || 'otro');
    setPriority(answer?.prioridad || 'media');
    setSummary(
      answer
        ? `Pregunta del cliente: ${lastTurn.question}\n\nDiagnóstico del asistente: ${answer.diagnostico}\n\nPaso que necesita supervisión: ${answer.paso_a_seguir}${answer.motivo_escalamiento ? `\n\nMotivo del escalamiento: ${answer.motivo_escalamiento}` : ''}`
        : lastTurn?.question || ''
    );
  }, [open, client, lastTurn]);

  useEffect(() => {
    if (!open || staff.length > 0) return;
    setLoadingStaff(true);
    base44.functions
      .invoke('listAdmins', { kind: 'all', limit: 500 })
      .then((res) => setStaff(res?.data?.admins || []))
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [open, staff.length]);

  const options = useMemo(() => {
    const sorted = [...staff].sort((a, b) => {
      const aSup = a.custom_role === 'soporte' ? 0 : a.role === 'admin' ? 1 : 2;
      const bSup = b.custom_role === 'soporte' ? 0 : b.role === 'admin' ? 1 : 2;
      return aSup - bSup || String(a.full_name || a.email).localeCompare(String(b.full_name || b.email));
    });
    return sorted.map((member) => ({ value: member.email, label: `${member.full_name || member.email} · ${roleLabel(member)}` }));
  }, [staff]);

  useEffect(() => {
    if (supervisor || options.length === 0) return;
    const preferred = staff.find((member) => member.custom_role === 'soporte') || staff.find((member) => member.role === 'admin');
    if (preferred) setSupervisor(preferred.email);
  }, [options, supervisor, staff]);

  const confirm = async () => {
    const result = await onConfirm({
      files,
      supervisor_email: supervisor,
      subject,
      category,
      priority,
      summary,
      question: lastTurn?.question || '',
      related_tracking: lastTurn?.relatedTracking || undefined,
    });
    if (result) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escalar caso a un supervisor</DialogTitle>
          <DialogDescription>
            Se crea el ticket con el caso y la conversación, se asigna al supervisor y se le notifica para que continúe la atención.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Supervisor asignado</Label>
            <Select value={supervisor} onValueChange={setSupervisor}>
              <SelectTrigger>
                <SelectValue placeholder={loadingStaff ? 'Cargando supervisores…' : 'Elige al supervisor'} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Asunto del ticket</Label>
            <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Resumen corto del caso" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Resumen para el supervisor</Label>
            <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={7} />
          </div>

          <div className="space-y-2">
            <Label>Adjuntos para el supervisor (opcional)</Label>
            <SupportImageUploader
              files={files}
              onChange={setFiles}
              disabled={submitting}
              maxFiles={5}
              accept="image/*,application/pdf"
              label="Adjuntar hasta 5 fotos o PDF"
            />
            <p className="text-[11px] text-muted-foreground">
              Los PDF quedan guardados de forma privada y se abren con un enlace temporal.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={confirm} disabled={submitting || !supervisor}>
            {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-1.5 h-4 w-4" />}
            {submitting ? 'Escalando…' : 'Crear ticket y notificar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}