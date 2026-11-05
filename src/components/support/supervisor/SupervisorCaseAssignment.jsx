import React, { useState } from 'react';
import { Loader2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import useSupportAdmins from '@/hooks/useSupportAdmins';
import { assignTicketDepartment, departmentPatch } from '@/lib/ticketDepartments';

const NONE = '__none__';

// Asignación del caso: departamento que lo atiende y responsable del equipo.
export default function SupervisorCaseAssignment({ ticket, user, onChange }) {
  const { departments } = useSupportDepartments(user);
  const admins = useSupportAdmins();
  const [saving, setSaving] = useState(false);

  const run = async (fn, msg) => {
    setSaving(true);
    try { await fn(); toast.success(msg); } catch { toast.error('No se pudo guardar el cambio'); }
    setSaving(false);
  };

  const changeDepartment = (id) => run(async () => {
    const dep = departments.find((d) => d.id === id) || null;
    await assignTicketDepartment(ticket.id, dep, user);
    onChange({ ...ticket, ...departmentPatch(dep) });
  }, 'Departamento actualizado');

  const changeAssignee = (email) => run(async () => {
    const assigned_to = email === NONE ? '' : email;
    await base44.entities.SupportTicket.update(ticket.id, { assigned_to });
    onChange({ ...ticket, assigned_to });
  }, 'Responsable actualizado');

  const knownAssignee = admins.some((a) => a.email === ticket.assigned_to);

  return (
    <Card className="border-border/70 shadow-card">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserCog className="h-4 w-4 text-primary" /> Asignación
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Departamento</Label>
          <Select value={ticket.department_id || NONE} onValueChange={changeDepartment} disabled={saving}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin departamento</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Responsable</Label>
          <Select value={ticket.assigned_to || NONE} onValueChange={changeAssignee} disabled={saving}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin asignar</SelectItem>
              {ticket.assigned_to && !knownAssignee && <SelectItem value={ticket.assigned_to}>{ticket.assigned_to}</SelectItem>}
              {admins.map((a) => <SelectItem key={a.email} value={a.email}>{a.full_name || a.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}