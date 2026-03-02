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

        // Filtrar solo clientes con estado registrado
        const clientsWithState = clients.filter(c => typeof c.state === 'string' && c.state.trim() !== '');

        // Generar el contenido del archivo
        let content = '';
        
        for (const client of clientsWithState) {
            const firstName = client.first_name || '';
            const lastName = client.last_name || '';
            const fullName = `${firstName} ${lastName}`.trim();
            const state = client.state || '';
            const city = client.city || '';
            
            // Construir dirección completa
            const addressLine1 = client.address_line1 || '';
            const addressLine2 = client.address_line2 || '';
            let fullAddress = addressLine1;
            if (addressLine2) {
                fullAddress += (fullAddress ? ', ' : '') + addressLine2;
            }
            
            const whatsapp = client.whatsapp || '';
            const email = client.email || '';
            const shippingMark = client.shipping_mark || '';

            content += `Nombre: ${fullName}\n`;
            content += `Estado: ${state}\n`;
            content += `Ciudad: ${city}\n`;
            content += `Direccion: ${fullAddress}\n`;
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