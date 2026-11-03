import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import useCrmInbox from '@/hooks/useCrmInbox';
import CrmDepartmentBoard from '@/components/support/crm/departments/CrmDepartmentBoard';
import SupervisorCaseFile from './SupervisorCaseFile';

// CRM del supervisor: el mismo tablero por departamento que ve el ATC (mismos casos, misma ubicación).
export default function SupervisorDepartmentCrm({ user }) {
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
  const escalated = cases.filter((c) => c.escalated).length;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {cases.length} casos abiertos · <span className="font-medium text-foreground">{escalated} con supervisión</span>
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