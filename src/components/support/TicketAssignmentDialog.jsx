import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TicketAssignmentDialog({
  open,
  onOpenChange,
  ticket,
  selectedRole,
  onRoleChange,
  selectedAssignee,
  onAssigneeChange,
  staffUsers,
  roleLabels,
  onConfirm,
  submitting,
}) {
  const filteredStaff = useMemo(() => {
    if (!selectedRole || selectedRole === 'all') return staffUsers;
    return staffUsers.filter((member) => (member.role === 'admin' ? 'admin' : member.custom_role) === selectedRole);
  }, [staffUsers, selectedRole]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Ticket</Label>
            <Input value={ticket?.ticket_number || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Rol / Equipo</Label>
            <Select value={selectedRole} onValueChange={onRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Empleado asignado</Label>
            <Select value={selectedAssignee} onValueChange={onAssigneeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {filteredStaff.map((member) => {
                  const roleCode = member.role === 'admin' ? 'admin' : member.custom_role;
                  return (
                    <SelectItem key={member.email} value={member.email}>
                      {(member.full_name || member.email)} · {roleLabels[roleCode] || roleCode}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={!selectedAssignee || submitting}>
            {submitting ? 'Asignando...' : 'Asignar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}