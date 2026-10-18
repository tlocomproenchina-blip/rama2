import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Boxes, Loader2 } from 'lucide-react';
import ClientBultoRow from '@/components/admin/clients/ClientBultoRow';

// Bultos y cajas consolidadas en almacén de un cliente (vista de administrador).
export default function ClientCargoPanel({ client }) {
  const [loading, setLoading] = useState(true);
  const [bultos, setBultos] = useState([]);
  const [packagesById, setPackagesById] = useState({});

  useEffect(() => {
    if (client?.email) loadBultos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.email, client?.shipping_mark]);

  const loadBultos = async () => {
    setLoading(true);
    const mark = (client.shipping_mark || '').trim();
    const query = mark ? { $or: [{ client_email: client.email }, { shipping_mark: mark }] } : { client_email: client.email };

    const page = await base44.entities.Bulto.filter(query, { sort: '-created_date', limit: 200 });
    const list = page.items || [];
    setBultos(list);

    // Los ids del escaneo offline ('local_pkg_...') no existen como registro y hacen
    // fallar la consulta de paquetes, así que se descartan antes de pedirlos.
    const ids = [...new Set(list.flatMap((b) => b.package_ids || []))]
      .filter((id) => id && !String(id).startsWith('local_'))
      .slice(0, 300);
    if (ids.length) {
      const pkgPage = await base44.entities.Package.filter(
        { id: { $in: ids } },
        { limit: 300, fields: ['tracking_number', 'description', 'status'] }
      );
      const map = {};
      (pkgPage.items || []).forEach((p) => { map[p.id] = p; });
      setPackagesById(map);
    } else {
      setPackagesById({});
    }
    setLoading(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-slate-500" />
          Bultos y cajas consolidadas en almacén
          <span className="text-xs font-normal text-slate-500">({bultos.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        ) : bultos.length === 0 ? (
          <p className="text-sm text-slate-400 bg-slate-50 rounded-lg px-4 py-3">Este cliente no tiene bultos ni cajas registrados.</p>
        ) : (
          bultos.map((bulto) => (
            <ClientBultoRow
              key={bulto.id}
              bulto={bulto}
              packages={(bulto.package_ids || []).map((id) => packagesById[id]).filter(Boolean)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}