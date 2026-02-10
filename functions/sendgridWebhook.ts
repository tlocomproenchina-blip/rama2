import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        // Verify webhook secret from query parameter
        const url = new URL(req.url);
        const providedSecret = url.searchParams.get('secret');
        const expectedSecret = Deno.env.get('SENDGRID_WEBHOOK_SECRET');

        if (!providedSecret || providedSecret !== expectedSecret) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse SendGrid event payload
        const events = await req.json();

        if (!Array.isArray(events)) {
            return Response.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const base44 = createClientFromRequest(req);

        // Process each event
        for (const event of events) {
            const email = event.email;
            const eventType = event.event; // delivered, open, click, bounce, etc.
            const timestamp = event.timestamp ? new Date(event.timestamp * 1000).toISOString() : new Date().toISOString();

            // Find the email log by recipient email and update status
            const emailLogs = await base44.asServiceRole.entities.EmailLog.filter({
                recipient_email: email
            }, '-sent_date', 50);

            if (emailLogs.length > 0) {
                // Update the most recent email log for this recipient
                const logToUpdate = emailLogs[0];
                const updates = {};

                switch (eventType) {
                    case 'delivered':
                        updates.status = 'delivered';
                        updates.delivered_date = timestamp;
                        break;
                    
                    case 'open':
                        updates.status = 'opened';
                        updates.opened_date = timestamp;
                        updates.open_count = (logToUpdate.open_count || 0) + 1;
                        break;
                    
                    case 'click':
                        updates.status = 'clicked';
                        updates.clicked_date = timestamp;
                        updates.click_count = (logToUpdate.click_count || 0) + 1;
                        break;
                    
                    case 'bounce':
                    case 'dropped':
                        updates.status = 'bounced';
                        updates.bounced_date = timestamp;
                        updates.bounce_reason = event.reason || event.type || 'Unknown';
                        break;
                    
                    case 'spamreport':
                        updates.status = 'bounced';
                        updates.bounce_reason = 'Marked as spam';
                        break;
                }

                if (Object.keys(updates).length > 0) {
                    await base44.asServiceRole.entities.EmailLog.update(logToUpdate.id, updates);
                }
            }
        }

        return Response.json({ success: true, processed: events.length });
    } catch (error) {
        console.error('SendGrid webhook error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});