import React, { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Pencil, Search, User as UserIcon, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PackageBillingInfo from '@/components/admin/packages/PackageBillingInfo';

export default function EditPackageModal({ pkg, processing, onClose, onSave }) {
  const [form, setForm] = useState({
    tracking_number: '',
    shipping_mark: '',
    description: '',
    shipping_type: 'maritimo',
    risk_category: 'general',
    package_count: 1,
    client_email: '',
  });

  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (pkg) {
      setForm({
        tracking_number: pkg.tracking_number || '',
        shipping_mark: pkg.shipping_mark || '',
        description: pkg.description || '',
        shipping_type: pkg.shipping_type || 'maritimo',
        risk_category: pkg.risk_category || 'general',
        package_count: pkg.package_count || 1,
        client_email: pkg.client_email || '',
      });
      setClientSearch('');
      setClientResults([]);
      setShowResults(false);
    }
  }, [pkg]);

  // Búsqueda de clientes con debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = clientSearch.trim();
    if (!term || term.length < 2) {
      setClientResults([]);
      return;
    }
    setSearchingClients(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await base44.functions.invoke('listClientsForSupport', {
          q: term,
          limit: 20,
          skip: 0,
          includeCounts: false,
        });
        const list = res?.data?.data || [];
        // Filtrado estricto en el cliente: solo mostrar si el término aparece en
        // email, nombre completo o shipping mark (ignora dígitos sueltos en otros campos)
        const t = term.toLowerCase();
        const tAlnum = t.replace(/[^a-z0-9]/g, '');
        const strict = (Array.isArray(list) ? list : []).filter((c) => {
          const email = (c.email || '').toLowerCase();
          const name = `${c.first_name || ''} ${c.last_name || ''} ${c.full_name || ''}`.toLowerCase();
          const sm = (c.shipping_mark || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return email.includes(t) || name.includes(t) || (tAlnum && sm.includes(tAlnum));
        });
        setClientResults(strict);
        setShowResults(true);
      } catch (_) {
        setClientResults([]);
      }
      setSearchingClients(false);
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [clientSearch]);

  const handleSelectClient = (client) => {
    setForm((prev) => ({
      ...prev,
      client_email: client.email || '',
      shipping_mark: client.shipping_mark || prev.shipping_mark,
    }));
    setClientSearch('');
    setClientResults([]);
    setShowResults(false);
  };

  const handleSubmit = () => {
    const trackingTrimmed = (form.tracking_number || '').trim();
    if (!trackingTrimmed) return;
    onSave({
      tracking_number: trackingTrimmed,
      shipping_mark: (form.shipping_mark || '').trim(),
      description: (form.description || '').trim(),
      shipping_type: form.shipping_type,
      risk_category: form.risk_category,
      package_count: Number(form.package_count) || 1,
      client_email: (form.client_email || '').trim(),
    });
  };

  return (
    <Dialog open={!!pkg} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-blue-600" /> Editar paquete
          </DialogTitle>
          <DialogDescription>
            Modifica los datos del paquete. Los cambios se guardan inmediatamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {pkg?.tracking_number && <PackageBillingInfo tracking={pkg.tracking_number} />}
          <div className="space-y-2">
            <Label>Tracking *</Label>
            <Input
              value={form.tracking_number}
              onChange={(e) => setForm({ ...form, tracking_number: e.target.value })}
              placeholder="Tracking del paquete"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <Label className="flex items-center gap-2 text-blue-800">
              <Search className="h-4 w-4" /> Cambiar cliente
            </Label>
            <p className="text-xs text-slate-600">Busca por nombre, email o shipping mark. Al seleccionar se actualizan email y shipping mark.</p>
            <div className="relative">
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                onFocus={() => clientResults.length > 0 && setShowResults(true)}
                placeholder="Buscar cliente..."
                className="pr-8"
              />
              {searchingClients && (
                <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
              )}
              {!searchingClients && clientSearch && (
                <button
                  type="button"
                  onClick={() => { setClientSearch(''); setClientResults([]); setShowResults(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {showResults && clientResults.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {clientResults.map((c) => (
                    <button
                      key={c.id || c.email}
                      type="button"
                      onClick={() => handleSelectClient(c)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 border-b border-slate-100 last:border-0 flex items-start gap-2"
                    >
                      <UserIcon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {c.full_name || c.first_name || c.email}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{c.email}</p>
                        {c.shipping_mark && (
                          <p className="text-xs font-mono text-blue-600 truncate">{c.shipping_mark}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showResults && !searchingClients && clientSearch.length >= 2 && clientResults.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-sm text-slate-500">
                  Sin resultados
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Shipping Mark</Label>
            <Input
              value={form.shipping_mark}
              onChange={(e) => setForm({ ...form, shipping_mark: e.target.value })}
              placeholder="Ej: N6-TLEC-W1443S"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label>Email del cliente</Label>
            <Input
              type="email"
              value={form.client_email}
              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              placeholder="cliente@correo.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Descripción del paquete"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de envío</Label>
              <Select value={form.shipping_type} onValueChange={(v) => setForm({ ...form, shipping_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="maritimo">Marítimo</SelectItem>
                  <SelectItem value="aereo">Aéreo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.risk_category} onValueChange={(v) => setForm({ ...form, risk_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="alto_riesgo">Alto riesgo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cantidad de bultos</Label>
            <Input
              type="number"
              min="1"
              value={form.package_count}
              onChange={(e) => setForm({ ...form, package_count: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}