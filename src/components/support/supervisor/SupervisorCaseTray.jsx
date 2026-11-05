import React, { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { supervisionState } from '@/lib/supervisionState';
import SupervisorTrayFilters from './SupervisorTrayFilters';
import SupervisorCaseRow from './SupervisorCaseRow';

const INITIAL = { search: '', supervision: 'all', priority: 'all', department: 'all', assignee: 'all' };
const PRIORITY_RANK = { urgente: 0, alta: 1, media: 2, baja: 3 };

// Bandeja de casos abiertos con búsqueda y filtros. Los escalados pendientes van primero.
export default function SupervisorCaseTray({ cases, profiles = {}, departments, admins, onOpen }) {
  const [filters, setFilters] = useState(INITIAL);
  const adminName = useMemo(() => Object.fromEntries(admins.map((a) => [a.email, a.full_name || a.email])), [admins]);
  const nameOf = (c) => profiles[c.client_email]?.name || c.client_email;

  const rows = useMemo(() => {
    const known = new Set(departments.map((d) => d.id));
    const q = filters.search.trim().toLowerCase();
    const rank = (c) => ({ pendiente: 0, atendido: 1 }[supervisionState(c)] ?? 2);
    return cases
      .filter((c) => {
        const sup = supervisionState(c) || 'none';
        if (filters.supervision !== 'all' && sup !== filters.supervision) return false;
        if (filters.priority !== 'all' && c.priority !== filters.priority) return false;
        if (filters.department === 'none' && known.has(c.department_id)) return false;
        if (!['all', 'none'].includes(filters.department) && c.department_id !== filters.department) return false;
        if (filters.assignee === 'none' && c.assigned_to) return false;
        if (!['all', 'none'].includes(filters.assignee) && c.assigned_to !== filters.assignee) return false;
        if (!q) return true;
        return [c.ticket_number, c.subject, c.client_email, nameOf(c), c.assigned_to, adminName[c.assigned_to]]
          .some((v) => String(v || '').toLowerCase().includes(q));
      })
      .sort((a, b) => rank(a) - rank(b) || (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2)
        || String(a.escalated_date || a.created_date).localeCompare(String(b.escalated_date || b.created_date)));
  }, [cases, filters, departments, adminName, profiles]);

  return (
    <div className="space-y-3">
      <SupervisorTrayFilters filters={filters} setFilters={setFilters} departments={departments} admins={admins} />
      <p className="text-xs text-muted-foreground">{rows.length} de {cases.length} casos</p>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-sm text-muted-foreground">
          <Inbox className="h-6 w-6" /> No hay casos con estos filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <SupervisorCaseRow key={c.id} item={c} name={nameOf(c)} assigneeName={adminName[c.assigned_to] || c.assigned_to} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}