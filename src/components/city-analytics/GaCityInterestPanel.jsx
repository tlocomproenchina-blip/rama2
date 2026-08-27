import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CITY_LANDINGS } from '@/lib/cityLandings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, BarChart3, MapPin } from 'lucide-react';

// Ciudades con mayor interés según Google Analytics (visitas a las landing pages)
export default function GaCityInterestPanel() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState(null);
  const [days, setDays] = useState('30');

  const load = useCallback(async (pid, d) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('getGaCityLandingStats', {
        days: Number(d),
        ...(pid ? { propertyId: pid } : {})
      });
      const data = res.data || {};
      if (data.error) {
        setError(data.error);
      } else {
        setRows(data.rows || []);
        setProperties(data.properties || []);
        setPropertyId(data.propertyId || null);
      }
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudieron cargar los datos de Google Analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxViews = rows.reduce((m, r) => Math.max(m, r.pageviews), 0) || 1;
  const cityName = (slug) => CITY_LANDINGS.find((c) => c.slug === slug)?.city || slug;
  const stateName = (slug) => CITY_LANDINGS.find((c) => c.slug === slug)?.state_name || '';

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-blue-600" /> Interés por ciudad (Google Analytics)
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {properties.length > 1 && (
            <Select value={propertyId || ''} onValueChange={(v) => { setPropertyId(v); load(v, days); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Propiedad" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={days} onValueChange={(v) => { setDays(v); load(propertyId, v); }}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-rose-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">
            Google Analytics aún no registra visitas a las landing pages de ciudades en este período.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.path} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-blue-500" /> {cityName(r.slug)}
                    {stateName(r.slug) && <span className="text-xs text-slate-400">· {stateName(r.slug)}</span>}
                  </span>
                  <span className="shrink-0 text-slate-600">
                    <strong className="text-slate-900">{r.pageviews}</strong> visitas · {r.users} usuarios
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((r.pageviews / maxViews) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}