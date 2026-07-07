import React, { useState } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CheckCircle2, Clock, Ship, MapPinned, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const norm = (s) => String(s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const fmt = (d) => {
  try { return format(new Date(d.includes('T') ? d : d + 'T12:00:00'), 'dd MMM yyyy', { locale: es }); } catch { return '—'; }
};

export default function CbmTrackingSearch({ userEmail, ingresos }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);

  const handleSearch = async () => {
    const q = norm(query);
    if (q.length < 4) return;
    setSearching(true);
    setResult(null);

    // 1. Buscar en órdenes CBM (recibido en China)
    const matchIngreso = (ingresos || []).find((ing) =>
      (ing.tracking_numbers || []).some((t) => {
        const nt = norm(t);
        return nt.includes(q) || q.includes(nt);
      })
    );

    if (matchIngreso) {
      setResult({ type: 'ingreso', data: matchIngreso });
      setSearching(false);
      return;
    }

    // 2. Buscar en pre-alertas / paquetes del cliente
    try {
      const packages = await base44.entities.Package.filter({ client_email: userEmail }, '-created_date', 300);
      const matchPkg = (packages || []).find((p) => {
        const nt = norm(p.tracking_number);
        return nt.includes(q) || q.includes(nt);
      });
      setResult(matchPkg ? { type: 'package', data: matchPkg } : { type: 'not_found' });
    } catch {
      setResult({ type: 'not_found' });
    }
    setSearching(false);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/60 shadow-card">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          ¿Dónde está mi paquete? Busca tu tracking
        </p>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Pega aquí tu número de tracking..."
            className="bg-white font-mono"
          />
          <Button onClick={handleSearch} disabled={searching || norm(query).length < 4} className="bg-blue-600 hover:bg-blue-700 shrink-0">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {result?.type === 'ingreso' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
            <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> ¡Sí! Tu paquete fue recibido en China
            </p>
            <div className="text-xs text-slate-700 space-y-0.5">
              {result.data.fecha && <p>📦 Recibido: <strong>{fmt(result.data.fecha)}</strong></p>}
              {result.data.invoice_number && <p>🧾 Orden N: <strong>{result.data.invoice_number}</strong></p>}
              {result.data.fecha_salida ? (
                <p className="flex items-center gap-1"><Ship className="h-3 w-3 text-emerald-600" /> Salió de China: <strong>{fmt(result.data.fecha_salida)}</strong></p>
              ) : (
                <p className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-600" /> Aún en almacén de China, pendiente de salida</p>
              )}
              {result.data.fecha_estimada_llegada && (
                <p className="flex items-center gap-1"><MapPinned className="h-3 w-3 text-blue-600" /> Llegada estimada a Venezuela: <strong>{fmt(result.data.fecha_estimada_llegada)}</strong></p>
              )}
              {result.data.disponible_entrega && (
                <p className="font-bold text-emerald-700">✓ ¡Ya está disponible para entrega!</p>
              )}
            </div>
          </div>
        )}

        {result?.type === 'package' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
            <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Tracking registrado, aún no recibido en China
            </p>
            <p className="text-xs text-slate-700">
              Tu pre-alerta está registrada{result.data.status === 'recibido' ? ' y marcada como recibida' : ''}. Te notificaremos apenas llegue a nuestro almacén en China.
            </p>
          </div>
        )}

        {result?.type === 'not_found' && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-slate-500" /> No encontramos ese tracking
            </p>
            <p className="text-xs text-slate-600">
              Aún no ha sido recibido en nuestro almacén de China o no está pre-alertado. Verifica el número o crea una pre-alerta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}