import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, X, UserCheck } from 'lucide-react';

export default function AdminSupportBulkBar({ selectedCount, staffUsers, onStatusChange, onAssign, onClear, processing }) {
  const [assignee, setAssignee] = useState('');

  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-2 z-30 rounded-xl border border-blue-200 bg-blue-50 shadow-md px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-semibold text-blue-800">{selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}</span>

      <Select onValueChange={onStatusChange} disabled={processing} value="">
        <SelectTrigger className="h-9 w-44 bg-white">
          <SelectValue placeholder="Cambiar estado..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en_proceso">En Proceso</SelectItem>
          <SelectItem value="resuelto">Resuelto</SelectItem>
          <SelectItem value="cerrado">Cerrado</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Select value={assignee} onValueChange={setAssignee} disabled={processing}>
          <SelectTrigger className="h-9 w-56 bg-white">
            <SelectValue placeholder="Asignar a empleado..." />
          </SelectTrigger>
          <SelectContent>
            {staffUsers.map((member) => (
              <SelectItem key={member.email} value={member.email}>
                {member.full_name || member.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!assignee || processing}
          onClick={() => { onAssign(assignee); setAssignee(''); }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
          Asignar
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={onClear} disabled={processing} className="ml-auto text-slate-600">
        <X className="h-4 w-4 mr-1" />
        Limpiar
      </Button>
    </div>
  );
}