import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import useCrmInbox from '@/hooks/useCrmInbox';
import { supervisionState } from '@/lib/supervisionState';
import CrmDepartmentBoard from '@/components/support/crm/departments/CrmDepartmentBoard';
import SupervisorCaseFile from './SupervisorCaseFile';

// CRM del supervisor: el mismo tablero por departamento que ve el ATC. Los casos
// escalados se marcan en rojo (pendiente) o verde (atendido) hasta que se cierran.
export default function SupervisorDepartmentCrm({ user, initialTicketId = '' }) {
  const deps = useSupportDepartments(user);
  const inbox = useCrmInbox();
  const [selected, setSelected] = useState(null);
  const [opening, setOpening] = useState(false);

  const openCase = async (_email, id) => {
    setOpening(true);
    const ticket = await base44.entities.SupportTicket.get(id);
    setOpening(false);
    setSelected(ticket);
  };

  // Llegada desde la notificación: ?ticketId=... abre ese caso directamente.
  useEffect(() => {
    if (!initialTicketId) return;
    base44.entities.SupportTicket.get(initialTicketId)
      .then((ticket) => ticket && setSelected(ticket))
      .catch(() => toast.error('No se encontró el caso'));
  }, [initialTicketId]);

  if (selected) {
    return (
      <SupervisorCaseFile
        ticket={selected}
        user={user}
        onBack={() => { setSelected(null); inbox.reload(); }}
        onChange={(updated) => setSelected(updated)}
      />
    );
  }

  if ((inbox.loading && !inbox.data) || deps.loading) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando casos…</p>;
  }

  const cases = inbox.data?.cases || [];
  const pending = cases.filter((c) => supervisionState(c) === 'pendiente').length;
  const attended = cases.filter((c) => supervisionState(c) === 'atendido').length;

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{cases.length} casos abiertos</span>
        <span className="flex items-center gap-1.5 font-medium text-red-700"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {pending} pendientes</span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {attended} atendidos</span>
        {opening && <Loader2 className="h-4 w-4 animate-spin" />}
      </p>
      <CrmDepartmentBoard
        cases={cases}
        profiles={inbox.data?.profiles}
        deps={deps}
        onMove={(id, dep) => inbox.moveCase(id, dep, user)}
        onOpen={openCase}
      />
    </div>
  );
}