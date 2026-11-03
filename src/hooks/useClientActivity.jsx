import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Línea de tiempo del cliente: casos, paquetes, facturas, notas y tareas,
// de lo más reciente a lo más antiguo.
function buildEvents({ tickets, packages, invoices, notes, followups }) {
  const ev = [];
  const push = (date, type, text) => { if (date) ev.push({ date, type, text }); };
  tickets.forEach((t) => {
    push(t.created_date, 'caso', `Abrió el caso ${t.ticket_number || ''}: ${t.subject || ''}`);
    if (t.escalated_date) push(t.escalated_date, 'caso', `Caso ${t.ticket_number || ''} escalado a supervisión`);
    if (t.resolved_date) push(t.resolved_date, 'caso', `Caso ${t.ticket_number || ''} resuelto`);
  });
  packages.forEach((p) => {
    push(p.created_date, 'paquete', `Pre-alerta del paquete ${p.tracking_number}`);
    if (p.received_date) push(p.received_date, 'paquete', `Paquete ${p.tracking_number} recibido en almacén`);
    if (p.dispatched_date) push(p.dispatched_date, 'paquete', `Paquete ${p.tracking_number} despachado`);
  });
  invoices.forEach((i) => {
    push(i.invoice_date || i.created_date, 'factura', `Factura ${i.invoice_number || ''} emitida por ${money(i.total)}`);
    if (i.payment_date) push(i.payment_date, 'factura', `Factura ${i.invoice_number || ''} pagada`);
  });
  notes.forEach((n) => push(n.created_date, 'nota', `Nota de ${n.author_name || n.author_email || 'el equipo'}: ${n.note || ''}`));
  followups.forEach((f) => {
    push(f.created_date, 'tarea', `Tarea para ${f.responsible_name || f.responsible_email || 'el equipo'}: ${f.next_action}`);
    if (f.status === 'hecho') push(f.updated_date, 'tarea', `Tarea cerrada: ${f.next_action}`);
  });
  return ev.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 120);
}

export default function useClientActivity(email) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!email) return undefined;
    let active = true;
    setLoading(true);
    const q = { client_email: email };
    Promise.all([
      base44.entities.SupportTicket.filter(q, '-created_date', 30),
      base44.entities.Package.filter(q, '-created_date', 40),
      base44.entities.Invoice.filter(q, '-created_date', 30),
      base44.entities.SupportClientNote.filter(q, '-created_date', 30),
      base44.entities.SupportFollowUp.filter(q, '-created_date', 30),
    ]).then(([tickets, packages, invoices, notes, followups]) => {
      if (!active) return;
      setEvents(buildEvents({ tickets, packages, invoices, notes, followups }));
      setLoading(false);
    });
    return () => { active = false; };
  }, [email]);

  return { events, loading };
}