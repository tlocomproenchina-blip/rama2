import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import useSupportDepartments from '@/hooks/useSupportDepartments';
import useSupervisorDepartmentCases from '@/hooks/useSupervisorDepartmentCases';
import CrmDepartmentBoard from '@/components/support/crm/departments/CrmDepartmentBoard';
import SupervisorCaseFile from './SupervisorCaseFile';

// CRM del supervisor: los casos escalados repartidos por departamento.
export default function SupervisorDepartmentCrm({ user }) {
  const deps = useSupportDepartments(user);
  const { cases, loading, moveCase, replaceCase } = useSupervisorDepartmentCases(user);
  const [selected, setSelected] = useState(null);

  if (selected) {
    return (
      <SupervisorCaseFile
        ticket={selected}
        user={user}
        onBack={() => setSelected(null)}
        onChange={(updated) => { replaceCase(updated); setSelected(updated); }}
      />
    );
  }

  if (loading || deps.loading) {
    return <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando casos escalados…</p>;
  }

  const items = cases.map((t) => ({ ...t, waiting: !t.supervisor_reply_date }));
  const pending = items.filter((t) => t.waiting).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {items.length} casos escalados abiertos · <span className="font-medium text-foreground">{pending} sin responder</span>
      </p>
      <CrmDepartmentBoard
        cases={items}
        deps={deps}
        onMove={moveCase}
        onOpen={(_email, id) => setSelected(cases.find((c) => c.id === id) || null)}
      />
    </div>
  );
}