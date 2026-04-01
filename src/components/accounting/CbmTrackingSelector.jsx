import React, { useState, useEffect } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CbmTrackingSelector({ clientEmail, selectedTrackings = [], onChange }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!clientEmail) {
      setPackages([]);
      return;
    }
    loadPackages();
  }, [clientEmail]);

  const loadPackages = async () => {
    setLoading(true);
    const pkgs = await base44.entities.Package.filter(
      { client_email: clientEmail, status: 'recibido' },
      '-received_date',
      200
    );
    setPackages(pkgs || []);
    setLoading(false);
  };

  const toggle = (tracking) => {
    if (selectedTrackings.includes(tracking)) {
      onChange(selectedTrackings.filter(t => t !== tracking));
    } else {
      onChange([...selectedTrackings, tracking]);
    }
  };

  const selectAll = () => {
    const filtered = getFiltered();
    const allTrackings = filtered.map(p => p.tracking_number);
    onChange([...new Set([...selectedTrackings, ...allTrackings])]);
  };

  const deselectAll = () => {
    onChange([]);
  };

  const getFiltered = () => {
    if (!search.trim()) return packages;
    const q = search.toLowerCase();
    return packages.filter(p =>
      (p.tracking_number || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  };

  if (!clientEmail) {
    return (
      <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-500 text-center">
        Selecciona un cliente primero para ver sus trackings
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando trackings...
      </div>
    );
  }

  const filtered = getFiltered();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Package className="h-4 w-4" /> Trackings Recibidos ({packages.length})
        </Label>
        {packages.length > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={selectAll} className="text-xs text-blue-600 hover:underline">
              Seleccionar todos
            </button>
            <button type="button" onClick={deselectAll} className="text-xs text-red-500 hover:underline">
              Limpiar
            </button>
          </div>
        )}
      </div>

      {selectedTrackings.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTrackings.map(t => (
            <Badge key={t} className="bg-blue-100 text-blue-800 text-xs cursor-pointer" onClick={() => toggle(t)}>
              {t} ✕
            </Badge>
          ))}
        </div>
      )}

      {packages.length === 0 ? (
        <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700 text-center">
          Este cliente no tiene paquetes con estado "recibido"
        </div>
      ) : (
        <>
          {packages.length > 5 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar tracking..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
            {filtered.map(pkg => (
              <label
                key={pkg.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <Checkbox
                  checked={selectedTrackings.includes(pkg.tracking_number)}
                  onCheckedChange={() => toggle(pkg.tracking_number)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{pkg.tracking_number}</p>
                  <p className="text-xs text-slate-500 truncate">{pkg.description || 'Sin descripción'}</p>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {pkg.shipping_type === 'aereo' ? '✈️' : '🚢'} {pkg.shipping_type}
                </Badge>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}