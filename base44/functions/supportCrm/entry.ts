import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { computeAutoTags } from './autoTags.ts';

// CRM de atención al cliente.
//   inbox  -> indicadores de la jornada, agenda de seguimientos y casos abiertos,
//             con las etiquetas de cada cliente. Filtros: tag ('auto:x' | 'manual:x') y mine.
//   client -> etiquetas, saldo pendiente y casos abiertos de un cliente.

const OPEN = ['abierto', 'en_proceso'];
const PRIORITY = { urgente: 0, alta: 1, media: 2, baja: 3 };

const caracasToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

function lastMessage(ticket) {
  const msgs = Array.isArray(ticket.messages) ? ticket.messages : [];
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (!msgs[i]?.is_system) return msgs[i];
  }
  return null;
}

// El caso espera al equipo cuando lo último que se escribió lo escribió el cliente.
function isWaiting(ticket) {
  const last = lastMessage(ticket);
  return !last || (!last.is_admin && !last.is_ai);
}

async function manualTagsFor(base44, emails) {
  if (!emails.length) return {};
  const rows = await base44.entities.ClientTagAssignment.filter({ client_email: { $in: emails } }, '-updated_date', 1000);
  const map = {};
  (rows || []).forEach((r) => { map[r.client_email] = r.tags || []; });
  return map;
}

function mergeTags(emails, auto, manual) {
  const out = {};
  emails.forEach((e) => {
    out[e] = [
      ...(auto[e] || []).map((t) => `auto:${t}`),
      ...(manual[e] || []).map((t) => `manual:${t}`),
    ];
  });
  return out;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'inbox';
    const sr = base44.asServiceRole;
    const catalog = await base44.entities.ClientTag.list('name', 200);

    if (action === 'client') {
      const email = String(body.email || '').trim();
      if (!email) return Response.json({ error: 'email is required' }, { status: 400 });
      const [auto, manual, openCases] = await Promise.all([
        computeAutoTags(sr, [email]),
        manualTagsFor(base44, [email]),
        base44.entities.SupportTicket.count({ client_email: email, status: { $in: OPEN } }),
      ]);
      return Response.json({
        tags: mergeTags([email], auto.tags, manual)[email],
        manual_tags: manual[email] || [],
        balance: auto.balances[email] || 0,
        open_cases: openCases,
        catalog,
      });
    }

    if (action !== 'inbox') return Response.json({ error: 'Unknown action' }, { status: 400 });

    const today = caracasToday();
    const followQuery = { status: { $in: ['pendiente', 'en_proceso'] } };
    if (body.mine) followQuery.responsible_email = user.email;

    const [tickets, followups, openTotal] = await Promise.all([
      base44.entities.SupportTicket.filter({ status: { $in: OPEN } }, '-updated_date', 200),
      base44.entities.SupportFollowUp.filter(followQuery, 'due_date', 300),
      base44.entities.SupportTicket.count({ status: { $in: OPEN } }),
    ]);

    const emails = [...new Set([...tickets, ...followups].map((r) => r.client_email).filter(Boolean))];
    const [auto, manual] = await Promise.all([computeAutoTags(sr, emails), manualTagsFor(base44, emails)]);
    const tagsByEmail = mergeTags(emails, auto.tags, manual);

    const tag = String(body.tag || '');
    const keep = (email) => !tag || (tagsByEmail[email] || []).includes(tag);

    const cases = tickets
      .filter((t) => keep(t.client_email))
      .map((t) => {
        const last = lastMessage(t);
        return {
          id: t.id,
          ticket_number: t.ticket_number,
          subject: t.subject,
          client_email: t.client_email,
          priority: t.priority || 'media',
          status: t.status,
          escalated: !!t.escalated,
          assigned_to: t.assigned_to || '',
          department_id: t.department_id || '',
          department_name: t.department_name || '',
          waiting: isWaiting(t),
          last_message: last ? {
            message: String(last.message || '').slice(0, 2000),
            sender_name: last.sender_name || '',
            timestamp: last.timestamp || t.updated_date,
            is_admin: !!last.is_admin || !!last.is_ai,
          } : null,
          updated_date: t.updated_date,
        };
      })
      .sort((a, b) => {
        if (a.waiting !== b.waiting) return a.waiting ? -1 : 1;
        if (a.waiting) return String(a.last_message?.timestamp || '').localeCompare(String(b.last_message?.timestamp || ''));
        return (PRIORITY[a.priority] ?? 2) - (PRIORITY[b.priority] ?? 2)
          || String(b.updated_date).localeCompare(String(a.updated_date));
      });

    const agenda = followups
      .filter((f) => keep(f.client_email))
      .map((f) => ({
        ...f,
        overdue: !!f.due_date && f.due_date < today,
        is_today: f.due_date === today,
      }))
      .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));

    const kpis = {
      waiting_clients: new Set(cases.filter((c) => c.waiting).map((c) => c.client_email)).size,
      overdue: agenda.filter((f) => f.overdue).length,
      today: agenda.filter((f) => f.is_today).length,
      supervision: cases.filter((c) => c.escalated).length,
      open_cases: tag ? cases.length : openTotal,
    };

    return Response.json({ kpis, cases, agenda, tags_by_email: tagsByEmail, profiles: auto.profiles, catalog, today });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}