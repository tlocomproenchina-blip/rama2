import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    console.log('📨 Webhook received:', body.substring(0, 200));
    
    // Parse events
    const events = JSON.parse(body);
    
    const base44 = createClientFromRequest(req);
    
    // Process each event
    for (const event of events) {
      const email = event.email;
      const eventType = event.event;
      const timestamp = new Date(event.timestamp * 1000).toISOString();
      
      // Find the email log
      const logs = await base44.asServiceRole.entities.EmailLog.filter({ 
        recipient_email: email 
      });
      
      if (logs.length === 0) continue;
      
      // Find the most recent log that matches (or use sg_message_id if available)
      let log = logs[0];
      if (event.sg_message_id) {
        const matchingLog = logs.find(l => l.sg_message_id === event.sg_message_id);
        if (matchingLog) log = matchingLog;
      } else {
        // Get the most recent one
        log = logs.sort((a, b) => new Date(b.sent_date) - new Date(a.sent_date))[0];
      }
      
      // Update based on event type
      const updates = {};
      
      switch (eventType) {
        case 'delivered':
          updates.status = 'delivered';
          updates.delivered_date = timestamp;
          break;
          
        case 'open':
          if (log.status !== 'clicked') {
            updates.status = 'opened';
          }
          updates.opened_date = timestamp;
          updates.open_count = (log.open_count || 0) + 1;
          break;
          
        case 'click':
          updates.status = 'clicked';
          updates.clicked_date = timestamp;
          updates.click_count = (log.click_count || 0) + 1;
          break;
          
        case 'bounce':
        case 'dropped':
          updates.status = 'bounced';
          updates.bounced_date = timestamp;
          updates.bounce_reason = event.reason || event.type || 'Unknown';
          break;
          
        case 'deferred':
          // Temporarily failed, will retry
          break;
          
        case 'processed':
          // Email has been received and is ready to be delivered
          break;
          
        default:
          console.log('Unknown event type:', eventType);
      }
      
      // Update the log if we have changes
      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.EmailLog.update(log.id, updates);
        
        // Update campaign statistics if this email is part of a campaign
        if (log.campaign_id) {
          const campaign = await base44.asServiceRole.entities.MarketingCampaign.get(log.campaign_id);
          if (campaign) {
            const campaignUpdates = {};
            
            if (eventType === 'open' && log.status !== 'opened' && log.status !== 'clicked') {
              campaignUpdates.opened_count = (campaign.opened_count || 0) + 1;
            }
            
            if (eventType === 'click') {
              campaignUpdates.clicked_count = (campaign.clicked_count || 0) + 1;
            }
            
            if (Object.keys(campaignUpdates).length > 0) {
              await base44.asServiceRole.entities.MarketingCampaign.update(log.campaign_id, campaignUpdates);
            }
          }
        }
      }
    }
    
    return Response.json({ success: true, processed: events.length });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});