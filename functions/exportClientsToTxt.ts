import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Obtener todos los clientes
        const clients = await base44.asServiceRole.entities.User.filter({ role: 'user' });

        // Generar el contenido del archivo
        let content = '';
        
        for (const client of clients) {
            const firstName = client.first_name || '';
            const lastName = client.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim() || client.email;
            const city = client.city || 'N/A';
            const whatsapp = client.whatsapp || 'N/A';
            const email = client.email || 'N/A';
            const shippingMark = client.shipping_mark || '*******';

            content += `Nombre: ${fullName}\n`;
            content += `Ciudad: ${city}\n`;
            content += `WhatsApp: ${whatsapp}\n`;
            content += `Email: ${email}\n`;
            content += `Codigo asignado: ${shippingMark}\n`;
            content += `\n`;
        }

        // Retornar el archivo como texto plano
        return new Response(content, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename=clientes_${new Date().toISOString().split('T')[0]}.txt`
            }
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});