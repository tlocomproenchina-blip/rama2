import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Package, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildWhatsAppUrl } from '@/lib/whatsappContact';

const STATUS_TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'pre_alerta', label: 'Pre-alerta' },
  { key: 'recibido', label: 'Recibidos' },
  { key: 'en_consolidacion', label: 'En consolidación' },
  { key: 'en_transito', label: 'En tránsito' },
  { key: 'entregado', label: 'Entregados' },
];

const fmt = (d) => (d ? format(new Date(d), 'dd/MM/yyyy HH:mm') : '—');
const fmtShort = (d) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—');

export default function ClientPackagesTable({ packages, client }) {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const filtered = useMemo(() => {
    let list = packages || [];
    if (tab !== 'all') list = list.filter((p) => p.status === tab);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((p) =>
        [p.tracking_number, p.description, p.shipping_type, p.status].filter(Boolean).join(' ').toLowerCase().includes(s)
      );
    }
    return list;
  }, [packages, tab, q]);

  const counts = useMemo(() => {
    const map = { all: packages?.length || 0 };
    (packages || []).forEach((p) => { map[p.status] = (map[p.status] || 0) + 1; });
    return map;
  }, [packages]);

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allVisibleIds = filtered.map((p) => p.id);
    const allSelected = allVisibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const selectedItems = useMemo(
    () => (packages || []).filter((p) => selectedIds.has(p.id)),
    [packages, selectedIds]
  );

  const handleNotifyWhatsApp = () => {
    if (!client) {
      toast.error('Cliente no disponible');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Selecciona al menos un paquete');
      return;
    }
    const phone = client.whatsapp || client.phone || '';
    if (!phone) {
      toast.error('Este cliente no tiene WhatsApp registrado');
      return;
    }

    const clientName = client.first_name || client.full_name || 'Cliente';
    const lines = selectedItems.map((p) => {
      const parts = [
        `• Tracking: ${p.tracking_number || '—'}`,
        p.status ? `Estado: ${p.status}` : null,
        p.shipping_type ? `Tipo: ${p.shipping_type}` : null,
        p.package_count ? `Bultos: ${p.package_count}` : null,
        p.received_date ? `Recibido: ${fmtShort(p.received_date)}` : null,
        p.description ? `Desc.: ${p.description}` : null
      ].filter(Boolean);
      return parts.join(' | ');
    });

    const message = `Hola ${clientName}, te compartimos el detalle de tus paquetes:\n\n${lines.join('\n')}`;

    const url = buildWhatsAppUrl(phone, message);
    if (!url) {
      toast.error('Número de WhatsApp inválido');
      return;
    }
    window.open(url, '_blank');
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-800">Historial de paquetes</h3>
            <Badge variant="secondary">{packages?.length || 0}</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <Badge variant="outline" className="text-slate-700">{selectedIds.size} seleccionado(s)</Badge>
            )}
            <Button
              size="sm"
              onClick={handleNotifyWhatsApp}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Notificar por WhatsApp
            </Button>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tracking o descripción..." className="pl-10" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
              className="gap-2"
            >
              {t.label}
              <Badge variant={tab === t.key ? 'secondary' : 'outline'} className="ml-1">{counts[t.key] || 0}</Badge>
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                <th className="py-2 pr-3 w-8">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="Seleccionar todos" />
                </th>
                <th className="py-2 pr-3">Tracking</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Bultos</th>
                <th className="py-2 pr-3">CBM</th>
                <th className="py-2 pr-3">Peso (kg)</th>
                <th className="py-2 pr-3">Registrado</th>
                <th className="py-2 pr-3">Recibido</th>
                <th className="py-2 pr-3">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">Sin paquetes</td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50">
                  <td className="py-2 pr-3">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                      aria-label={`Seleccionar ${p.tracking_number || p.id}`}
                    />
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.tracking_number}</td>
                  <td className="py-2 pr-3 capitalize">{p.shipping_type || '—'}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{p.status || '—'}</Badge></td>
                  <td className="py-2 pr-3">{p.package_count || 1}</td>
                  <td className="py-2 pr-3">{Number(p.cbm || 0).toFixed(5)}</td>
                  <td className="py-2 pr-3">{Number(p.weight_kg || 0).toFixed(2)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{fmt(p.created_date)}</td>
                  <td className="py-2 pr-3 text-xs text-slate-600">{fmt(p.received_date)}</td>
                  <td className="py-2 pr-3 max-w-[260px] truncate" title={p.description}>{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}