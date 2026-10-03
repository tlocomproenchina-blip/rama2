import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Sonda temporal: cómo crear un cliente (rol user) con la cuenta de servicio.
export default async function (req: Request): Promise<Response> {
  const out: any = {};
  const base44 = createClientFromRequest(req);

  try {
    const created = await base44.asServiceRole.entities.User.create({
      email: 'santiccvc+probe3@gmail.com',
      role: 'user',
      full_name: 'Cliente Sonda',
      cedula: 'V-00000003',
      first_name: 'Cliente',
      last_name: 'Sonda',
      city: 'Caracas',
      state: 'caracas',
      whatsapp: '584120000003',
      profile_completed: true,
    });
    out.create_with_data = { ok: true, id: created?.id, role: created?.role, full_name: created?.full_name };
  } catch (e: any) {
    out.create_with_data = { ok: false, error: e?.message };
  }

  try {
    const created2 = await base44.asServiceRole.entities.User.create({
      email: 'santiccvc+probe4@gmail.com',
      role: 'user',
      first_name: 'Sin',
      last_name: 'Fullname',
      cedula: 'V-00000004',
    });
    out.create_without_fullname = { ok: true, id: created2?.id };
  } catch (e: any) {
    out.create_without_fullname = { ok: false, error: e?.message };
  }

  try {
    const rows = await base44.asServiceRole.entities.User.filter({
      email: { $in: ['santiccvc+probe3@gmail.com', 'santiccvc+probe4@gmail.com'] },
    });
    out.found = rows.map((u: any) => ({ email: u.email, role: u.role, full_name: u.full_name }));
  } catch (e: any) {
    out.found_error = e?.message;
  }

  return Response.json(out);
}