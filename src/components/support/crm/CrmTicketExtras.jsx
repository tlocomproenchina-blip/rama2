import React from 'react';
import CrmTagBadges from './CrmTagBadges';

// Datos del CRM que se suman a cada ticket de la lista: nombre del cliente,
// si espera respuesta, departamento y etiquetas.
export default function CrmTicketExtras({ ticket, crm }) {
  if (!crm) return null;
  const c = crm.casesById?.[ticket.id];
  const name = crm.profiles?.[ticket.client_email]?.name;
  const tags = crm.tagsByEmail?.[ticket.client_email];
  const department = c?.department_name || ticket.department_name;
  if (!name && !c?.waiting && !department && !tags?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {name && <span className="text-xs font-semibold text-foreground">{name}</span>}
      {c?.waiting && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">Espera respuesta</span>}
      {department && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{department}</span>}
      <CrmTagBadges tags={tags} catalog={crm.catalog} />
    </div>
  );
}