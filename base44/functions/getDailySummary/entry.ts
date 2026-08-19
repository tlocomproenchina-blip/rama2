import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { fetchDailySummaryMetrics } from '../../shared/dailySummary.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const metrics = await fetchDailySummaryMetrics(base44);
    return Response.json({ success: true, ...metrics });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
}