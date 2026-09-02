import React, { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, UserX, UserCheck, Package, MapPin, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import useClientSearch from '@/hooks/useClientSearch';
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';
import moment from 'moment';

const PAGE_SIZE = 50;

export default function AdminOrphanPackages({ user }) {
  const [orphans, setOrphans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const enabledTypes = useEnabledShippingTypes();
  const { query: clientQuery, setQuery: setClientQuery, results: clientResults, setResults: setClientResults, searching: searchingClients } = useClientSearch();
  const [selectedClient, setSelectedClient] = useState(null);
  const [shippingType, setShippingType] = useState('aereo');
  const [assigning, setAssigning] = useState(false);

  const loadOrphans = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const s = reset ? 0 : skip;
      const rows = await base44.entities.Package.filter({ is_orphan: true }, '-created_date', PAGE_SIZE, s);
      setOrphans(reset ? rows : [...orphans, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      setSkip(s + rows.length);
    } catch (e) {
      toast.error('No se pudieron cargar los huérfanos');
    }
    setLoading(false);
  }, [skip, orphans]);

  useEffect(() => { loadOrphans(true); }, []);

  const filtered = orphans.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (p.tracking_number || '').toLowerCase().includes(q) || (p.shipping_mark || '').toLowerCase().includes(q);
  });

  const openAssign = (pkg) => {
    setAssignTarget(pkg);
    setSelectedClient(null);
    setClientQuery('');
    setClientResults([]);
    if (enabledTypes.aereo) setShippingType('aereo');
    else if (enabledTypes.maritimo) setShippingType('maritimo');
  };

  const handleAssign = async () => {
    if (!selectedClient || !assignTarget) return;
    setAssigning(true);
    try {
      const { data } = await base44.functions.invoke('assignOrphanPackage', {
        package_id: assignTarget.id,
        client_email: selectedClient.email,
        shipping_mark: selectedClient.shipping_mark || undefined,
        shipping_type: shippingType,
      });
      if (data?.error) throw new Error(data.error);
      toast.success(`Huérfano asignado a ${selectedClient.email}`);
      setOrphans((prev) => prev.filter((p) => p.id !== assignTarget.id));
      setAssignTarget(null);
      setSelectedClient(null);
    } catch (e) {
      toast.error(e?.message || 'No se pudo asignar el huérfano');
    }
    setAssigning(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><UserX className="h-7 w-7 text-amber-600" /> Paquetes Huérfanos</h1>
        <p className="text-slate-500">Trackings recibidos sin pre-alerta. Asignalos a un cliente o espera a que el cliente los reclame con su pre-alerta.</p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por tracking o shipping mark..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
        </CardContent>
      </Card>

      {loading && orphans.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-slate-500">
          <UserX className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-medium">No hay paquetes huérfanos</p>
          <p className="text-sm">Los paquetes que lleguen sin pre-alerta aparecerán aquí.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="shadow-sm border-amber-100">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Package className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="font-mono font-semibold text-slate-800 break-all">{p.tracking_number}</span>
                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">Sin cliente</Badge>
                    <Badge variant="secondary">{p.shipping_type === 'maritimo' ? 'Marítimo' : 'Aéreo'}</Badge>
                    {p.shipping_mark && <Badge variant="outline">SM: {p.shipping_mark}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {p.warehouse_name && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.warehouse_name}{p.warehouse_location_code ? ` · ${p.warehouse_location_code}` : ''}</span>}
                    {p.actual_weight_kg && <span>{p.actual_weight_kg} kg</span>}
                    {p.actual_cbm && <span>{p.actual_cbm.toFixed(4)} CBM</span>}
                    {p.received_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{moment(p.received_date).format('DD/MM/YYYY')}</span>}
                    {p.description && <span className="truncate max-w-[200px]">· {p.description}</span>}
                  </div>
                  {p.package_image_urls?.length > 0 && (
                    <div className="flex gap-1.5 mt-1">
                      {p.package_image_urls.map((url, i) => (
                        <img key={i} src={url} alt={`Foto ${i + 1}`} className="h-12 w-12 rounded-md object-cover border" />
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={() => openAssign(p)} className="bg-blue-600 hover:bg-blue-700 gap-2 shrink-0">
                  <UserCheck className="h-4 w-4" /> Asignar
                </Button>
              </CardContent>
            </Card>
          ))}
          {hasMore && !search && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => loadOrphans(false)} disabled={loading}>Cargar más</Button>
            </div>
          )}
        </div>
      )}

      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4" onClick={() => setAssignTarget(null)}>
          <Card className="w-full md:max-w-lg shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserCheck className="h-5 w-5 text-blue-600" /> Asignar huérfano</CardTitle>
              <p className="text-sm text-slate-500 font-mono break-all">{assignTarget.tracking_number}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedClient ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Buscar cliente</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Nombre, email o shipping mark..." value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} className="pl-10" autoFocus />
                    {searchingClients && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                  </div>
                  {clientResults.length > 0 && (
                    <div className="border rounded-lg max-h-60 overflow-y-auto divide-y">
                      {clientResults.map((c) => (
                        <button key={c.id} onClick={() => { setSelectedClient(c); setClientQuery(''); setClientResults([]); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 truncate">{c.full_name || c.first_name || c.email}</p>
                            <p className="text-xs text-slate-500 truncate">{c.email}</p>
                          </div>
                          {c.shipping_mark && <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{c.shipping_mark}</Badge>}
                        </button>
                      ))}
                    </div>
                  )}
                  {clientQuery.length >= 2 && !searchingClients && clientResults.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-2">No se encontraron clientes</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 bg-slate-50 border rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{selectedClient.full_name || selectedClient.first_name || selectedClient.email}</p>
                      <p className="text-xs text-slate-500 truncate">{selectedClient.email} {selectedClient.shipping_mark ? `· ${selectedClient.shipping_mark}` : ''}</p>
                    </div>
                    <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-red-500 text-sm shrink-0">Cambiar</button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de envío</Label>
                    <Select value={shippingType} onValueChange={setShippingType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {enabledTypes.aereo && <SelectItem value="aereo">Aéreo</SelectItem>}
                        {enabledTypes.maritimo && <SelectItem value="maritimo">Marítimo</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancelar</Button>
                <Button onClick={handleAssign} disabled={!selectedClient || assigning} className="bg-blue-600 hover:bg-blue-700 gap-2">
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Asignar huérfano
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}