import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2, UserPlus, X, Plane, Ship } from 'lucide-react';
import { toast } from 'sonner';
import { useEnabledShippingTypes } from '@/components/ShippingTypeFilter';

export default function QuickPreAlertForm({ trackingNumber, onCreated, onCancel }) {
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [shippingType, setShippingType] = useState('');
  const [creating, setCreating] = useState(false);
  const searchTimeout = useRef(null);
  const enabledTypes = useEnabledShippingTypes();

  // Build available options and auto-select if only one
  const shippingOptions = [];
  if (enabledTypes.aereo) shippingOptions.push({ value: 'aereo', label: 'Aéreo', icon: Plane });
  if (enabledTypes.maritimo) shippingOptions.push({ value: 'maritimo', label: 'Marítimo', icon: Ship });

  useEffect(() => {
    if (enabledTypes.loading) return;
    if (shippingOptions.length === 1 && shippingType !== shippingOptions[0].value) {
      setShippingType(shippingOptions[0].value);
    } else if (shippingOptions.length > 1 && !shippingType) {
      setShippingType(shippingOptions[0].value);
    }
  }, [enabledTypes.loading, shippingOptions.length]);

  useEffect(() => {
    if (!clientSearch || clientSearch.length < 2) {
      setClientResults([]);
      return;
    }
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        let allUsers = [];
        let skip = 0;
        while (true) {
          const batch = await base44.entities.User.list('-created_date', 200, skip);
          if (!batch || batch.length === 0) break;
          allUsers = allUsers.concat(batch);
          if (batch.length < 200) break;
          skip += 200;
        }
        const q = clientSearch.toLowerCase();
        const matches = allUsers.filter(u => u.role === 'user' && (
          (u.full_name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.shipping_mark || '').toLowerCase().includes(q) ||
          (u.first_name || '').toLowerCase().includes(q) ||
          (u.last_name || '').toLowerCase().includes(q)
        )).slice(0, 8);
        setClientResults(matches);
      } catch (_) {
        setClientResults([]);
      }
      setSearching(false);
    }, 400);
    return () => clearTimeout(searchTimeout.current);
  }, [clientSearch]);

  const handleCreate = async () => {
    if (!selectedClient || !trackingNumber) return;
    setCreating(true);
    try {
      await base44.entities.Package.create({
        tracking_number: trackingNumber.trim(),
        client_email: selectedClient.email,
        shipping_mark: selectedClient.shipping_mark || '',
        shipping_type: shippingType,
        description: 'Pre-alerta rápida (admin)',
        status: 'pre_alerta',
      });
      toast.success(`Pre-alerta creada para ${trackingNumber}`);
      if (typeof onCreated === 'function') onCreated(selectedClient);
    } catch (e) {
      toast.error('No se pudo crear la pre-alerta');
    }
    setCreating(false);
  };

  return (
    <div className="ml-0 mt-1 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-700">Pre-alerta rápida para: <span className="font-mono">{trackingNumber}</span></p>
        {onCancel && (
          <button onClick={onCancel} className="h-5 w-5 flex items-center justify-center rounded-full text-blue-400 hover:text-red-500 hover:bg-red-50">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!selectedClient ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar cliente: nombre, email o shipping mark..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className="pl-10 h-9 text-sm bg-white"
            autoFocus
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
          )}
          {clientResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-y-auto">
              {clientResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{c.full_name || c.first_name || c.email}</p>
                    <p className="text-xs text-slate-500 truncate">{c.email}</p>
                  </div>
                  {c.shipping_mark && <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{c.shipping_mark}</Badge>}
                </button>
              ))}
            </div>
          )}
          {clientSearch.length >= 2 && !searching && clientResults.length === 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-center text-xs text-slate-500">
              No se encontraron clientes
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-white border rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{selectedClient.full_name || selectedClient.first_name || selectedClient.email}</p>
              <p className="text-xs text-slate-500 truncate">{selectedClient.email} {selectedClient.shipping_mark ? `· ${selectedClient.shipping_mark}` : ''}</p>
            </div>
            <button onClick={() => setSelectedClient(null)} className="h-6 w-6 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {shippingOptions.length > 1 ? (
              <Select value={shippingType} onValueChange={setShippingType}>
                <SelectTrigger className="h-9 text-sm bg-white flex-1">
                  <SelectValue placeholder="Tipo de envío" />
                </SelectTrigger>
                <SelectContent>
                  {shippingOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-slate-600 bg-white border rounded-xl px-3 h-9 flex-1">
                {shippingOptions[0]?.value === 'aereo' ? <Plane className="h-3.5 w-3.5" /> : <Ship className="h-3.5 w-3.5" />}
                {shippingOptions[0]?.label || 'Cargando...'}
              </div>
            )}
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-700 gap-1 h-9"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              Crear
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}