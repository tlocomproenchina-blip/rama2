import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CITY_LANDINGS } from '@/lib/cityLandings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MapPin, Eye, UserCheck, TrendingUp } from 'lucide-react';

export default function AdminCityAnalytics() {
  const [stats, setStats] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRows, allUsers] = await Promise.all([
        base44.entities.CityLandingStats.list('-visit_count', 100),
        base44.entities.User.list('-created_date', 500)
      ]);
      setStats(statsRows);
      setUsers(allUsers);
    } catch (e) {
      console.error('Error loading city analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  // Registros por ciudad (desde origin_city en el perfil del usuario)
  const registrationsByCity = {};
  users.forEach((u) => {
    const slug = u.origin_city;
    if (slug) registrationsByCity[slug] = (registrationsByCity[slug] || 0) + 1;
  });

  // Unir datos de visitas + registros por ciudad
  const rows = CITY_LANDINGS.map((c) => {
    const stat = stats.find((s) => s.slug === c.slug);
    return {
      ...c,
      visit_count: stat?.visit_count || 0,
      registration_count: registrationsByCity[c.slug] || 0,
      last_visit: stat?.last_visit_date
    };
  }).sort((a, b) => b.visit_count - a.visit_count);

  const totalVisits = rows.reduce((acc, r) => acc + r.visit_count, 0);
  const totalRegistrations = rows.reduce((acc, r) => acc + r.registration_count, 0);
  const topCity = rows[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Analítica de Ciudades</h1>
        <p className="text-sm text-slate-500">Visitas y registros por ciudad de origen en las landing pages marítimas.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-blue-100 p-2.5"><Eye className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Visitas totales</p>
              <p className="text-2xl font-bold text-slate-900">{totalVisits}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-emerald-100 p-2.5"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Registros por landing</p>
              <p className="text-2xl font-bold text-slate-900">{totalRegistrations}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="rounded-xl bg-orange-100 p-2.5"><TrendingUp className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Ciudad top</p>
              <p className="text-lg font-bold text-slate-900 truncate">{topCity?.visit_count > 0 ? topCity.city : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla por ciudad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle por ciudad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Ciudad</th>
                  <th className="py-2 pr-4 font-semibold">Estado</th>
                  <th className="py-2 pr-4 font-semibold text-right">Visitas</th>
                  <th className="py-2 pr-4 font-semibold text-right">Registros</th>
                  <th className="py-2 pr-4 font-semibold">Última visita</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.slug} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <MapPin className="h-3.5 w-3.5 text-blue-500" /> {r.city}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{r.state_name}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-slate-800">{r.visit_count}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-emerald-700">{r.registration_count}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-400">
                      {r.last_visit ? new Date(r.last_visit).toLocaleDateString('es-VE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}