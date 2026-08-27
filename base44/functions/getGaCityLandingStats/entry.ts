import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Devuelve las visitas de Google Analytics a las landing pages de ciudades.
// Solo admins. Descubre la primera propiedad GA4 disponible si no se envía propertyId.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const days = Number(body?.days) > 0 ? Number(body.days) : 30;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    let propertyId = body?.propertyId ? String(body.propertyId) : null;
    let properties = [];

    const sumRes = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200', { headers });
    const sumData = await sumRes.json();
    if (!sumRes.ok) {
      return Response.json({ error: sumData?.error?.message || 'Error consultando Google Analytics' }, { status: 502 });
    }
    (sumData.accountSummaries || []).forEach((acc) => {
      (acc.propertySummaries || []).forEach((p) => {
        properties.push({ id: String(p.property || '').replace('properties/', ''), name: p.displayName });
      });
    });
    if (!propertyId) propertyId = properties[0]?.id || null;
    if (!propertyId) {
      return Response.json({ error: 'No se encontró ninguna propiedad de Google Analytics (GA4) en tu cuenta.' }, { status: 404 });
    }

    const reportRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'CONTAINS', value: 'envios-maritimos-china-' }
          }
        },
        limit: 200
      })
    });
    const report = await reportRes.json();
    if (!reportRes.ok) {
      return Response.json({ error: report?.error?.message || 'Error obteniendo el reporte de Analytics' }, { status: 502 });
    }

    const rows = (report.rows || []).map((r) => {
      const path = r.dimensionValues?.[0]?.value || '';
      const slug = path.split('envios-maritimos-china-')[1]?.replace(/\/.*$/, '') || path;
      return {
        path,
        slug,
        pageviews: Number(r.metricValues?.[0]?.value || 0),
        users: Number(r.metricValues?.[1]?.value || 0)
      };
    }).sort((a, b) => b.pageviews - a.pageviews);

    // Serie diaria por ciudad, para graficar tendencias
    const dailyRes = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }, { name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: {
          filter: {
            fieldName: 'pagePath',
            stringFilter: { matchType: 'CONTAINS', value: 'envios-maritimos-china-' }
          }
        },
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 5000
      })
    });
    const dailyReport = await dailyRes.json();
    const daily = (dailyReport.rows || []).map((r) => {
      const raw = r.dimensionValues?.[0]?.value || '';
      const path = r.dimensionValues?.[1]?.value || '';
      const slug = path.split('envios-maritimos-china-')[1]?.replace(/\/.*$/, '') || path;
      return {
        date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
        slug,
        pageviews: Number(r.metricValues?.[0]?.value || 0)
      };
    });

    return Response.json({ propertyId, properties, days, rows, daily });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}