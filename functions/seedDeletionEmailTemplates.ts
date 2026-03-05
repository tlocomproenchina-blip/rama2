import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const ensure = async (name, subject, body) => {
      const found = await base44.asServiceRole.entities.EmailTemplate.filter({ name });
      if (!found || found.length === 0) {
        await base44.asServiceRole.entities.EmailTemplate.create({
          name,
          description: 'Plantilla del sistema',
          category: 'system',
          subject,
          body,
          is_default: true,
          variables: ['user_name','deletion_date','days_left']
        });
        return 'created';
      }
      return 'exists';
    };

    const r1 = await ensure(
      'AccountDeletionConfirmation',
      'Confirmación de solicitud de eliminación de cuenta',
      'Hola {user_name},\n\nHemos recibido tu solicitud para eliminar tu cuenta. Tu cuenta se eliminará automáticamente en 7 días ({deletion_date}) a menos que la canceles desde tu Perfil.\n\nSi cambias de opinión, puedes cancelar la solicitud en cualquier momento antes del plazo.\n\nGracias.'
    );

    const r2 = await ensure(
      'AccountDeletionReminder',
      'Recordatorio: tu cuenta se eliminará en 24 horas',
      'Hola {user_name},\n\nSolicitaste eliminar tu cuenta hace {days_left} días. Si no cancelas en 24 horas, tu cuenta será eliminada.\n\nPara cancelar, inicia sesión y ve a Perfil → Eliminar cuenta.'
    );

    return Response.json({ success: true, templates: { confirmation: r1, reminder: r2 } });
  } catch (error) {
    return Response.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
});