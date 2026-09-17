import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search, Package, PackageCheck, Printer, Boxes, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import useWarehouseAccess from '@/hooks/useWarehouseAccess';
import BluetoothPrinter from '@/components/warehouse/BluetoothPrinter';
import BultoVerifier from '@/components/warehouse/BultoVerifier';

export default function WarehouseBultos({ user }) {
  const { allowed, loading: loadingAccess } = useWarehouseAccess(user, 'WarehouseBultos');
  const [tab, setTab] = useState('empacar');

  // Empacar state
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [clientPackages, setClientPackages] = useState([]);
  const [clientBultos, setClientBultos] = useState([]);
  const [activeClient, setActiveClient] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState(null); // bulto data for immediate print
  const [printAllBultos, setPrintAllBultos] = useState([]); // all bultos of client for batch print

  const boxedIds = useMemo(() => {
    const set = new Set();
    for (const b of clientBultos) {
      for (const id of b.package_ids || []) set.add(id);
    }
    return set;
  }, [clientBultos]);

  const searchClient = async () => {
    const term = searchTerm.trim();
    if (!term) return;
    setSearching(true);
    setClientPackages([]);
    setClientBultos([]);
    setActiveClient(null);
    setSelectedIds([]);
    setLastCreated(null);
    try {
      // Try by shipping_mark first, then by email
      let pkgs = await base44.entities.Package.filter({ shipping_mark: term }, '-received_date', 500);
      if (!pkgs.length) {
        pkgs = await base44.entities.Package.filter({ client_email: term.toLowerCase() }, '-received_date', 500);
      }
      if (!pkgs.length) {
        toast.error('No se encontraron paquetes para ese shipping mark o email');
        return;
      }
      const email = pkgs[0].client_email;
      const sm = pkgs[0].shipping_mark || term;
      setActiveClient({ email, shipping_mark: sm });
      setClientPackages(pkgs);

      // Fetch existing bultos for this client
      const bultos = await base44.entities.Bulto.filter({ client_email: email }, 'bulto_number', 500);
      setClientBultos(bultos || []);
    } catch (e) {
      toast.error('Error al buscar paquetes');
    } finally {
      setSearching(false);
    }
  };

  const receivedPackages = useMemo(
    () => clientPackages.filter((p) => p.status === 'recibido'),
    [clientPackages]
  );

  const togglePackage = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAllReceived = () => {
    const unboxedReceived = receivedPackages.filter((p) => !boxedIds.has(p.id));
    setSelectedIds((prev) => {
      const allSelected = unboxedReceived.every((p) => prev.includes(p.id));
      if (allSelected) {
        return prev.filter((id) => !unboxedReceived.map((p) => p.id).includes(id));
      }
      return Array.from(new Set([...prev, ...unboxedReceived.map((p) => p.id)]));
    });
  };

  const handleCreateBulto = async () => {
    if (!selectedIds.length) {
      toast.error('Selecciona al menos un paquete');
      return;
    }
    setCreating(true);
    try {
      const res = await base44.functions.invoke('createBulto', { package_ids: selectedIds });
      const data = res?.data;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`Bulto ${data.bulto_number}/${data.total_bultos} creado`);
      setLastCreated(data);
      // Refresh bultos and packages
      const bultos = await base44.entities.Bulto.filter({ client_email: activeClient.email }, 'bulto_number', 500);
      setClientBultos(bultos || []);
      setSelectedIds([]);
    } catch (e) {
      toast.error('Error al crear el bulto');
    } finally {
      setCreating(false);
    }
  };

  const handlePrintAll = () => {
    if (!clientBultos.length) return;
    setPrintAllBultos(clientBultos);
  };

  const bultosToPrint = useMemo(() => {
    if (lastCreated) return [lastCreated];
    return [];
  }, [lastCreated]);

  if (loadingAccess) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }
  if (!allowed) {
    return <Card><CardContent className="p-8 text-center text-slate-500">No tienes acceso a este módulo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
          <Boxes className="h-7 w-7" /> Empaque de Bultos
        </h1>
        <p className="text-slate-500">Agrupa paquetes recibidos en bultos físicos e imprime etiquetas térmicas 100×100 mm vía Bluetooth.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="empacar">Empacar</TabsTrigger>
          <TabsTrigger value="verificar">Verificar</TabsTrigger>
        </TabsList>

        <TabsContent value="empacar" className="space-y-4">
          {/* Bluetooth printer reminder */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-sm">Cierra la app de la impresora antes de imprimir por Bluetooth para evitar conflictos de conexión.</p>
          </div>

          {/* Search */}
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchClient()}
                    placeholder="Shipping mark o email del cliente"
                    className="pl-10"
                  />
                </div>
                <Button onClick={searchClient} disabled={searching || !searchTerm.trim()} className="bg-blue-600 hover:bg-blue-700">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          {activeClient && (
            <>
              {/* Client summary + existing bultos */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 min-w-0">
                      <PackageCheck className="h-5 w-5 shrink-0" />
                      <span className="truncate">{activeClient.shipping_mark}</span>
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-normal text-slate-500">{clientBultos.length} bulto(s)</span>
                      {clientBultos.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handlePrintAll}>
                          <Printer className="h-4 w-4" /> Imprimir todos
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {clientBultos.length > 0 ? (
                    <div className="space-y-2">
                      {clientBultos.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">Bulto {b.bulto_number}/{b.total_bultos}</p>
                            <p className="text-xs text-slate-500 font-mono break-all">{b.label_code}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500">{b.package_trackings?.length || 0} paq.</span>
                            {b.invoice_paid ? (
                              <span className="text-xs text-green-600 font-medium">Pagada</span>
                            ) : (
                              <span className="text-xs text-red-600 font-medium">Pendiente</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Aún no hay bultos creados para este cliente.</p>
                  )}

                  {/* Batch print all */}
                  {printAllBultos.length > 0 && (
                    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-medium text-blue-800 mb-2">Imprimir todas las etiquetas ({printAllBultos.length})</p>
                      <BluetoothPrinter
                        bultos={printAllBultos}
                        onPrinted={() => setPrintAllBultos([])}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Received packages selection */}
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2"><Package className="h-5 w-5" /> Paquetes recibidos</span>
                    <Button variant="ghost" size="sm" onClick={toggleAllReceived}>
                      <CheckCircle2 className="h-4 w-4" /> Seleccionar todos
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {receivedPackages.length === 0 ? (
                    <p className="text-sm text-slate-500">No hay paquetes con estado "recibido" para este cliente.</p>
                  ) : (
                    receivedPackages.map((p) => {
                      const isBoxed = boxedIds.has(p.id);
                      const isSelected = selectedIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                            isSelected ? 'border-blue-400 bg-blue-50' : 'border-border hover:bg-muted/40'
                          } ${isBoxed ? 'opacity-50' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isBoxed}
                            onChange={() => togglePackage(p.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm text-slate-800 break-all">{p.tracking_number}</p>
                            {p.description && <p className="text-xs text-slate-500 truncate">{p.description}</p>}
                          </div>
                          {isBoxed && <span className="text-xs text-slate-400 shrink-0">Ya en bulto</span>}
                        </label>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Create + Print */}
              {selectedIds.length > 0 && (
                <Card className="shadow-sm border-blue-200">
                  <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{selectedIds.length} paquete(s) seleccionado(s)</p>
                      <p className="text-sm text-slate-500">Se creará un nuevo bulto con estos paquetes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={handleCreateBulto} disabled={creating} className="bg-blue-600 hover:bg-blue-700">
                        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
                        Crear bulto
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Print just-created bulto */}
              {lastCreated && (
                <Card className="shadow-sm border-green-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <p className="font-medium">Bulto {lastCreated.bulto_number}/{lastCreated.total_bultos} creado: {lastCreated.label_code}</p>
                    </div>
                    <BluetoothPrinter
                      bultos={[lastCreated]}
                      onPrinted={() => setLastCreated(null)}
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!activeClient && !searching && (
            <Card><CardContent className="p-10 text-center text-slate-500">Busca un cliente por shipping mark o email para empezar a empacar.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="verificar">
          <BultoVerifier />
        </TabsContent>
      </Tabs>
    </div>
  );
}