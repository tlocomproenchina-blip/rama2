import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

const STATUS = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700' },
  en_proceso: { label: 'En proceso', className: 'bg-blue-100 text-blue-700' },
  hecho: { label: 'Hecho', className: 'bg-emerald-100 text-emerald-700' },
};

const ORDER = { pendiente: 0, en_proceso: 1, hecho: 2 };

const fdate = (value) => (value
  ? new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '');

const today = () => new Date().toISOString().slice(0, 10);

// Seguimiento de un caso: a quién le toca, qué debe hacer y para cuándo. El
// equipo lo ve en el mismo panel y va marcando su avance.
export default function SupportFollowUpPanel({ clientEmail, clientName, clientCedula, shippingMark, cases = [], user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [caseId, setCaseId] = useState('general');
  const [responsible, setResponsible] = useState(user?.email || '');
  const [nextAction, setNextAction] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async () => {
    if (!clientEmail) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await base44.entities.SupportFollowUp.filter({ client_email: clientEmail }, '-created_date', 100);
      setRows(data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [clientEmail]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    base44.functions.invoke('listAdmins', { kind: 'all', limit: 500 })
      .then((res) => setStaff(res?.data?.admins || []))
      .catch(() => setStaff([]));
  }, []);

  const handleAssign = async () => {
    const action = nextAction.trim();
    if (!action) {
      toast.error('Escribe la próxima acción del seguimiento');
      return;
    }
    const linked = cases.find((item) => item.id === caseId) || null;
    const person = staff.find((member) => member.email === responsible);
    setSaving(true);
    try {
      await base44.entities.SupportFollowUp.create({
        client_email: clientEmail,
        client_name: clientName || '',
        client_cedula: clientCedula || '',
        shipping_mark: shippingMark || '',
        ticket_id: linked?.id || null,
        ticket_number: linked?.ticket_number || '',
        case_subject: linked?.subject || '',
        responsible_email: responsible,
        responsible_name: person?.full_name || responsible,
        next_action: action,
        due_date: dueDate || '',
        status: 'pendiente',
        assigned_by_email: user?.email || '',
        assigned_by_name: user?.full_name || user?.email || 'Supervisión',
      });
      setNextAction('');
      setDueDate('');
      setCaseId('general');
      toast.success('Seguimiento asignado');
      await load();
    } catch {
      toast.error('No se pudo asignar el seguimiento');
    }
    setSaving(false);
  };

  const handleStatus = async (row, status) => {
    setUpdatingId(row.id);
    try {
      await base44.entities.SupportFollowUp.update(row.id, {
        status,
        updated_by_email: user?.email || '',
        updated_by_name: user?.full_name || user?.email || 'Equipo',
      });
      await load();
    } catch {
      toast.error('No se pudo actualizar el seguimiento');
    }
    setUpdatingId(null);
  };

  const ordered = [...rows].sort((a, b) => (
    (ORDER[a.status] ?? 0) - (ORDER[b.status] ?? 0)
    || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'))
  ));
  const openCount = rows.filter((row) => row.status !== 'hecho').length;

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-primary" /> Seguimiento de casos
          {rows.length > 0 ? <Badge variant="secondary" className="ml-1">{rows.length}</Badge> : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {openCount > 0
            ? `${openCount} seguimiento(s) en curso para este cliente.`
            : 'Sin seguimientos en curso: aquí queda a quién le toca y para cuándo.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={caseId} onValueChange={setCaseId}>
              <SelectTrigger><SelectValue placeholder="Caso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Cliente en general</SelectItem>
                {cases.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.ticket_number} · {item.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
              <SelectContent>
                {staff.map((member) => (
                  <SelectItem key={member.email} value={member.email}>
                    {member.full_name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            rows={2}
            placeholder="Próxima acción concreta para sacar el caso adelante…"
            disabled={saving}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={saving}
              className="sm:max-w-[190px]"
            />
            <Button size="sm" onClick={handleAssign} disabled={saving || !nextAction.trim()}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Asignar seguimiento
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando seguimientos…
          </p>
        ) : ordered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Todavía no hay seguimientos asignados para este cliente.
          </p>
        ) : (
          <ul className="space-y-2">
            {ordered.map((row) => {
              const status = STATUS[row.status] || STATUS.pendiente;
              const overdue = row.status !== 'hecho' && row.due_date && row.due_date < today();
              return (
                <li key={row.id} className="rounded-2xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{row.responsible_name || row.responsible_email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.ticket_id ? `Caso ${row.ticket_number || 'soporte'}` : 'Cliente en general'}
                        {row.assigned_by_name ? ` · asignado por ${row.assigned_by_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {overdue ? <Badge className="bg-rose-100 text-rose-700">Vencido {fdate(row.due_date)}</Badge> : null}
                      <Badge className={status.className}>{status.label}</Badge>
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{row.next_action}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.due_date && !overdue ? `Para el ${fdate(row.due_date)}` : null}
                    {row.updated_by_name ? `${row.due_date && !overdue ? ' · ' : ''}Actualizado por ${row.updated_by_name} · ${fdate(row.updated_date)}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(STATUS).map(([value, meta]) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={row.status === value ? 'default' : 'outline'}
                        disabled={updatingId === row.id || row.status === value}
                        onClick={() => handleStatus(row, value)}
                      >
                        {updatingId === row.id && row.status !== value ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                        {meta.label}
                      </Button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}